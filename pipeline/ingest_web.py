"""Stage 0 for a paper published as a web page rather than a PDF.

Produces what ingest.py produces - a section list, one text file per section,
an item inventory with an image per figure, and the regions the reader sits
beside - so every stage after this one runs unchanged.

Two things genuinely differ, and both are recorded rather than faked:

  - There are no pages. Sections and items carry an anchor into the frozen
    copy where a PDF paper carries a page number.
  - Figures on the web routinely have no caption at all. Where there is none,
    the sentence that introduces the image becomes the caption and the item is
    marked captionInferred, so nothing downstream mistakes an inferred caption
    for the author's own words.

The frozen copy is the artefact every citation points into:
papers/<id>/paper.html, with the images pulled out into assets/ and an id on
every block the reader can sit beside. The live page is fetched once into
tmp/fetch/ (gitignored) and re-used on every re-run.

Source URL: SKIM_URL, else papers/<id>/source.json {"url": ...}, else the
paper's "source" in register.json.
"""
import base64
import json
import os
import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, NavigableString, Tag

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPER_ID = paper_id()
PAPER = os.path.join(ROOT, "papers", PAPER_ID)
ASSETS = os.path.join(PAPER, "assets")
DATA = os.path.join(PAPER, "data")
ING = os.path.join(DATA, "ingest")
SITE = os.path.join(PAPER, "site")          # the page's own css/js/bib
CACHE = os.path.join(ROOT, "tmp", "fetch")  # gitignored

UA = {"User-Agent": "Mozilla/5.0 (compatible; skimmaxxer ingest)"}

# Block-level things a reader can sit beside. A block is emitted whole and its
# descendants are never emitted again, so a <p> inside a <figcaption> belongs
# to the figure and does not also become a paragraph of its own.
#
# d-math is here for the displayed equation that stands on its own rather than
# sitting inside a sentence. Without it the equation is in no block, so it is
# in no section, and it vanishes from the text entirely - which is how a
# paper's central equation goes missing without anything erroring.
BLOCKS = ("p", "li", "blockquote", "pre", "figure", "table", "d-code", "d-math")
HEADS = ("h1", "h2", "h3", "h4", "h5", "h6")
# Dropped outright: chrome, not content.
DROP = ("script", "style", "noscript", "nav", "header", "footer", "form",
        "d-bibliography")
IMG_EXT = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
           "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg"}


def read_json(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def slug(s, n=60):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")
    return s[:n].strip("-") or "x"


def flat(s):
    return re.sub(r"\s+", " ", s or "").strip()


def mark(el, rid):
    """Tag a block in the saved copy so the reader can find it again.

    The page's own scripts still run inside the frame and some of them assign
    ids as they go, so what the reader anchors on is an attribute of ours that
    nothing else touches. An id is set as well, but only where the page has
    not set one itself.
    """
    el["data-skim"] = rid
    if not el.get("id"):
        el["id"] = rid


def source_url():
    v = os.environ.get("SKIM_URL")
    if v:
        return v.strip()
    p = os.path.join(PAPER, "source.json")
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))["url"]
    reg = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    if PAPER_ID in reg and reg[PAPER_ID].get("source", "").startswith("http"):
        return reg[PAPER_ID]["source"]
    raise SystemExit("No source URL. Set SKIM_URL, write papers/<id>/source.json, "
                     "or add the paper to register.json with an http source.")


def fetch(url, binary=False):
    """Fetched once, cached under tmp/. Re-running ingest never re-fetches."""
    os.makedirs(CACHE, exist_ok=True)
    tail = urlparse(url).path.rsplit("/", 1)[-1] or "index"
    path = os.path.join(CACHE, slug(PAPER_ID) + "--" + slug(tail, 80))
    if not os.path.exists(path):
        r = requests.get(url, headers=UA, timeout=180)
        r.raise_for_status()
        open(path, "wb").write(r.content)
        print(f"  fetched {len(r.content):,} bytes  {url}")
    b = open(path, "rb").read()
    return b if binary else b.decode("utf-8", errors="replace")


# ---------------------------------------------------------------- text

def inline_text(el):
    """An element's readable text, with the markup that carries meaning kept.

    Maths becomes its LaTeX between dollars, a citation becomes its key, and a
    footnote is folded inline in parentheses. All three are things the paper
    says, and dropping them silently leaves sentences that do not parse.
    """
    if isinstance(el, NavigableString):
        return str(el)
    if not isinstance(el, Tag):
        return ""
    n = el.name
    if n in ("script", "style"):
        return ""
    if n == "d-math":
        return " $" + flat(el.get_text()) + "$ "
    if n == "d-cite":
        return " [cite: " + (el.get("key") or "?") + "] "
    if n == "d-footnote":
        return " (note: " + flat("".join(inline_text(c) for c in el.children)) + ")"
    if n == "br":
        return "\n"
    return "".join(inline_text(c) for c in el.children)


def block_text(el):
    if el.name == "table":
        rows = []
        for tr in el.find_all("tr"):
            cells = [flat(inline_text(td)) for td in tr.find_all(["th", "td"])]
            if any(cells):
                rows.append(" | ".join(cells))
        return "\n".join(rows)
    return flat(inline_text(el))


# ---------------------------------------------------------------- structure

def chrome(soup):
    """Everything that is furniture rather than the paper.

    Marked rather than removed. The saved copy has to stay the page as
    published - its own nav, its own contents list, and above all its own
    scripts, which are what make its plots move - so nothing here is deleted.
    """
    body = soup.body or soup
    out = set()
    for t in body.find_all(DROP):
        out.add(id(t))
        out.update(id(d) for d in t.find_all(True))
    return out


def content_roots(soup, ignore):
    """The parts of the page that hold the article.

    Descends while one child holds nearly all the prose, and stops where the
    prose splits across siblings - which is what an article with a separate
    appendix looks like. Anything with no prose in it at all is furniture.
    """
    body = soup.body or soup

    def prose(el):
        return sum(1 for p in el.find_all("p") if id(p) not in ignore)

    total = prose(body)
    if not total:
        raise SystemExit("No paragraphs found - this does not look like an article.")
    node = body
    while True:
        kids = [k for k in node.children if isinstance(k, Tag)]
        big = [k for k in kids if prose(k) >= 0.9 * total]
        if len(big) == 1:
            node = big[0]
            continue
        roots = [k for k in kids if prose(k) >= max(3, 0.05 * total)]
        return roots or [node]


def walk_blocks(roots, ignore):
    """Every heading and block in document order, each emitted exactly once."""
    out, consumed = [], set()
    for ri, root in enumerate(roots):
        direct = {id(k) for k in root.children if isinstance(k, Tag)}
        for el in root.find_all(True):
            if id(el) in consumed or id(el) in ignore:
                continue
            if el.name in HEADS:
                out.append(("head", el, id(el) in direct, ri))
            elif el.name in BLOCKS:
                out.append(("block", el, False, ri))
            else:
                continue
            consumed.update(id(d) for d in el.find_all(True))
    return out


def number_sections(levels):
    """Dotted section numbers from heading depth.

    Depth comes from the run of headings rather than the tag name, because a
    page whose first section is an h3 and whose next is an h2 is common, and
    means the h3 was top-level all along.

    Nesting also stops at the edge of each part of the page. An appendix is
    written with the same heading levels as the article and would otherwise
    read as a subsection of whatever section happened to come last.
    """
    stack, ids, part = [], [], None
    for lvl, ri in levels:
        if ri != part:
            part, stack = ri, []
        while stack and stack[-1][0] >= lvl:
            stack.pop()
        if not stack:
            sid = str(sum(1 for s in ids if "." not in s) + 1)
        else:
            parent = stack[-1][1]
            n = sum(1 for s in ids if s.startswith(parent + ".") and
                    s.count(".") == parent.count(".") + 1) + 1
            sid = f"{parent}.{n}"
        stack.append((lvl, sid))
        ids.append(sid)
    return ids


def introducing_sentence(prev):
    """The caption a figure with no caption gets: the sentence leading into it.

    Web figures are introduced by the prose above them, usually a sentence
    ending in a colon. The whole paragraph if it is short enough to be one
    thought, otherwise its last sentence.
    """
    # Citation keys and folded-in footnotes belong in the section text, not in
    # something that has to read as a caption - and a sentence split lands
    # inside them, which is how a caption ends up starting mid-bracket.
    prev = flat(re.sub(r"\s*\[cite:[^\]]*\]|\s*\(note:[^)]*\)", "", prev or ""))
    if not prev:
        return ""
    if len(prev) <= 220:
        return prev
    parts = re.split(r"(?<=[.:!?])\s+", prev)
    tail = parts[-1] if parts else prev
    if len(tail) < 40 and len(parts) > 1:
        tail = " ".join(parts[-2:])
    return tail[-300:]


def bibtex_lines(bib):
    """One plain line per reference - enough for an agent to identify a citation."""
    out = []
    for m in re.finditer(r"@\w+\s*\{\s*([^,]+),(.*?)\n\}", bib, re.S):
        key, body = m.group(1).strip(), m.group(2)
        f = {k.lower(): flat(v) for k, v in
             re.findall(r"(\w+)\s*=\s*[{\"](.+?)[}\"]\s*,?\s*\n", body, re.S)}
        out.append(f"[{key}] {f.get('author', '?')} ({f.get('year', '?')}). "
                   f"{f.get('title', '?')}. "
                   f"{f.get('journal', f.get('booktitle', ''))} {f.get('url', '')}".strip())
    return "\n".join(out)


# ---------------------------------------------------------------- images

def save_image(img, base, item_id):
    """The author's own image file, decoded or downloaded. Never a screenshot."""
    src = img.get("src") or img.get("data-src") or ""
    if src.startswith("data:"):
        head, _, payload = src.partition(",")
        mime = head[5:].split(";")[0].lower()
        ext = IMG_EXT.get(mime, "png")
        blob = base64.b64decode(payload) if "base64" in head.lower() else payload.encode()
    elif src:
        url = urljoin(base, src)
        blob = fetch(url, binary=True)
        end = url.rsplit(".", 1)[-1].lower()
        ext = end if len(end) <= 4 and end.isalpha() else "png"
    else:
        return None
    name = f"{item_id}.{ext}"
    open(os.path.join(ASSETS, name), "wb").write(blob)
    img["src"] = "assets/" + name
    # Decoded off the main thread and only when wanted. A full-resolution PNG
    # decoded while the reader is scrolling past it is a dropped frame, and a
    # long article has dozens of them.
    img["loading"] = "lazy"
    img["decoding"] = "async"
    # The intrinsic size has to be on the tag. Without it a lazy image occupies
    # nothing until it loads, the article measures short, and the reader fits
    # the frame to a height that is wrong - which silently moves every block
    # offset it later relies on.
    try:
        from PIL import Image
        import io
        w, h = Image.open(io.BytesIO(blob)).size
        img["width"], img["height"] = str(w), str(h)
    except Exception:
        img["loading"] = "eager"       # cannot reserve the space, so do not defer
    return "assets/" + name


def captured(item_id):
    """A figure that is a live widget has no image file to take.

    It still runs inside the frozen copy, so the reader loses nothing - but a
    figure page has to stand on its own, and for that it needs a still. One
    dropped into assets/ by hand is picked up here; re-running ingest leaves
    it alone.
    """
    for ext in ("png", "jpg", "webp"):
        if os.path.exists(os.path.join(ASSETS, f"{item_id}.{ext}")):
            return f"assets/{item_id}.{ext}"
    return None


def localise(soup, base):
    """Pull the page's own css/js alongside the copy so it still renders."""
    os.makedirs(SITE, exist_ok=True)
    pairs = [(t, "src") for t in soup.find_all(["script", "img", "iframe",
                                                "d-bibliography"])]
    pairs += [(t, "href") for t in soup.find_all("link")]
    for el, attr in pairs:
        u = el.get(attr)
        if not u or u.startswith(("data:", "#", "javascript:", "assets/", "site/")):
            continue
        url = urljoin(base, u)
        if urlparse(url).scheme not in ("http", "https"):
            continue
        try:
            blob = fetch(url, binary=True)
        except Exception as e:                       # a missing asset is not fatal
            print(f"  ! could not fetch {url}: {e}")
            continue
        # The extension has to survive: a stylesheet or a script served as
        # something else is simply not loaded by the browser.
        tail = urlparse(url).path.rsplit("/", 1)[-1] or "asset"
        stem, dot, ext = tail.rpartition(".")
        name = slug(stem or tail, 80) + ("." + slug(ext, 8) if dot else "")
        open(os.path.join(SITE, name), "wb").write(blob)
        el[attr] = "site/" + name


# ---------------------------------------------------------------- main

def main():
    url = source_url()
    os.makedirs(ASSETS, exist_ok=True)
    os.makedirs(os.path.join(ING, "sections"), exist_ok=True)
    print(f"source: {url}")
    raw = fetch(url)
    soup = BeautifulSoup(raw, "lxml")

    bib_el = soup.find("d-bibliography")
    bib_src = bib_el.get("src") if bib_el else None

    ignore = chrome(soup)
    roots = content_roots(soup, ignore)
    print("content roots:", ", ".join(
        f"<{r.name}{'.' + '.'.join(r.get('class')) if r.get('class') else ''}> "
        f"{len(r.find_all('p'))}p" for r in roots))

    blocks = walk_blocks(roots, ignore)
    use_direct = sum(1 for k, el, d, ri in blocks if k == "head" and d) >= 3
    numbers = number_sections([(int(el.name[1]), ri) for k, el, d, ri in blocks
                               if k == "head" and (d or not use_direct)])

    title = flat(soup.title.get_text()) if soup.title else PAPER_ID
    sections = [{"id": "front", "title": "Title & authors",
                 "text": title + "\n\n", "anchor": None}]
    items, regions = [], []
    counts = {"figure": 0, "table": 0}
    prev_prose = ""
    hi = 0

    for kind, el, is_direct, _ri in blocks:
        if kind == "head" and (is_direct or not use_direct):
            sid = numbers[hi]
            hi += 1
            rid = "s-" + sid.replace(".", "-")
            mark(el, rid)
            sections.append({"id": sid, "title": flat(inline_text(el)), "text": "",
                             "anchor": rid, "level": int(el.name[1])})
            regions.append({"id": rid, "kind": "heading", "sectionId": sid,
                            "anchor": rid, "text": flat(inline_text(el))})
            continue

        cur = sections[-1]
        txt = block_text(el)

        if el.name == "figure" or (el.name == "table" and el.find("tr")):
            ikind = "figure" if el.name == "figure" else "table"
            counts[ikind] += 1
            item_id = ("fig-" if ikind == "figure" else "table-") + str(counts[ikind])
            mark(el, item_id)
            cap_el = el.find("figcaption")
            caption = flat(inline_text(cap_el)) if cap_el else ""
            inferred = not caption
            if inferred:
                caption = introducing_sentence(prev_prose)
            img = el.find("img")
            asset = save_image(img, url, item_id) if img else captured(item_id)
            items.append({"id": item_id, "kind": ikind, "number": counts[ikind],
                          "caption": caption, "captionInferred": inferred,
                          "page": None, "anchor": item_id, "asset": asset,
                          "section": cur["id"],
                          "text": txt if ikind == "table" else None})
            regions.append({"id": item_id, "kind": "item", "sectionId": cur["id"],
                            "anchor": item_id, "text": caption})
            cur["text"] += f"[{item_id}] {caption}\n\n"
            if ikind == "table":
                cur["text"] += txt + "\n\n"
            continue

        if not txt:
            continue
        cur["n"] = cur.get("n", 0) + 1
        rid = f"p-{cur['id'].replace('.', '-')}-{cur['n']:02d}"
        mark(el, rid)
        cur["text"] += txt + "\n\n"
        regions.append({"id": rid, "kind": "paragraph", "sectionId": cur["id"],
                        "anchor": rid, "text": txt})
        prev_prose = txt

    # ---- equations, inventoried rather than detected ----
    # Same contract as the PDF path: papers/<id>/equations.json names the few
    # displayed equations that carry weight, and they enter the inventory with
    # no image, because they are re-typeset later from their own source.
    for eq in read_json(os.path.join(PAPER, "equations.json"), []):
        items.append({"id": eq["id"], "kind": "equation", "number": None,
                      "caption": eq["name"], "captionInferred": False,
                      "page": None, "anchor": eq.get("anchor"), "asset": None,
                      "section": eq.get("section"), "text": None})

    # ---- the bibliography, so citation-chasing has reference text ----
    if bib_src:
        try:
            sections.append({"id": "references", "title": "References",
                             "text": bibtex_lines(fetch(urljoin(url, bib_src))),
                             "anchor": None})
        except Exception as e:
            print(f"  ! bibliography: {e}")

    localise(soup, url)
    open(os.path.join(PAPER, "paper.html"), "w", encoding="utf-8").write(str(soup))

    # ---- the same files ingest.py writes ----
    for stale in os.listdir(os.path.join(ING, "sections")):
        if stale.endswith(".txt"):
            os.remove(os.path.join(ING, "sections", stale))
    for i, s in enumerate(sections):
        fname = f"{i:02d}-{s['id']}-{slug(s['title'])}.txt"
        s["file"] = f"data/ingest/sections/{fname}"
        with open(os.path.join(ING, "sections", fname), "w", encoding="utf-8") as f:
            f.write(f"[{s['id']}] {s['title']}\n\n{s['text']}")

    def wr(name, obj):
        json.dump(obj, open(os.path.join(ING, name), "w", encoding="utf-8"),
                  indent=1, ensure_ascii=False)

    wr("sections.json", {"paperId": PAPER_ID, "sections": [
        {k: s[k] for k in ("id", "title", "file")} | {"chars": len(s["text"])}
        for s in sections]})
    wr("items.json", {"paperId": PAPER_ID, "items": items})
    wr("regions.json", {"paperId": PAPER_ID, "pages": None, "kind": "web",
                        "regions": regions})
    wr("section-pages.json", {s["id"]: {"title": s["title"], "start": None,
                                        "end": None, "anchor": s.get("anchor")}
                              for s in sections})
    wr("web-source.json", {"url": url, "kind": "web", "copy": "paper.html"})

    size = os.path.getsize(os.path.join(PAPER, "paper.html"))
    print(f"\ncopy: paper.html ({size:,} bytes)")
    print("sections:")
    for s in sections:
        print(f"  [{s['id']:<6}] {s['title'][:58]:<60} ({len(s['text']):,} chars)")
    print(f"items: {counts['figure']} figures, {counts['table']} tables, "
          f"{sum(1 for i in items if i['captionInferred'])} captions inferred")
    print(f"regions: {sum(1 for g in regions if g['kind'] == 'paragraph')} paragraphs, "
          f"{sum(1 for g in regions if g['kind'] == 'heading')} headings, "
          f"{sum(1 for g in regions if g['kind'] == 'item')} items")


if __name__ == "__main__":
    main()
