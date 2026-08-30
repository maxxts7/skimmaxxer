"""Stage 0 ingest: PDF -> section text, page renders, figure/table crops, item inventory.

Handles single- and two-column layouts, with figure captions below their
figure and table captions above their table. Verify the crops by eye before
any agent reads them - these fail quietly.

Per-paper overrides, both optional:
  papers/<id>/crops.json      { "<item-id>": {"rect": [x0, y0, x1, y1]} }  (PDF points)
  papers/<id>/equations.json  [ {"id": "eq-...", "name": "...", "section": "3.2"} ]

Equations get no crop - they are re-typeset by the per-equation agents in
stage 2 - so they are inventoried rather than detected.
"""
import json
import os
import re

import numpy as np
import pymupdf

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAPER_ID = paper_id()
PAPER = os.path.join(ROOT, "papers", PAPER_ID)
ASSETS = os.path.join(PAPER, "assets")
DATA = os.path.join(PAPER, "data")
ING = os.path.join(DATA, "ingest")

# A caption separator is a colon or a period, because house styles differ:
# "Figure 1: ..." and "Figure 1. ...". The period costs a guard - text must
# follow it on the same block - or a sentence ending in a cross-reference
# ("... shown in Figure 14.") is read as the caption of a figure that is
# somewhere else entirely.
# A caption block can also arrive with its subfigure labels glued to the
# front - "(a) (b) Figure 26. ..." - because they typeset as one block.
CAP_RE = re.compile(r"^(?:\((?:[a-z]|[ivx]+)\)\s*)*(Figure|Table)\s+(\d+)\s*[:.]\s+\S")
# The number may carry a trailing period too - "1. Introduction", "2.1. Method"
# - which is the same house-style split. Both are safe here because a heading
# has already had to be bold or oversized to be considered at all, so a
# numbered list item in body text never reaches this test.
HEAD_RE = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+([A-Z].{2,60})$")
# Appendices are lettered rather than numbered. A bare capital is far too weak
# a signal on its own, so a match only counts after the References heading,
# which is where an appendix can actually start.
APPENDIX_RE = re.compile(r"^([A-Z](?:\.\d+)*)\.?\s+([A-Z].{2,60})$")
# Unnumbered headings worth treating as sections. Extend per paper via
# papers/<id>/headings.json (a JSON list of strings).
NAMED_HEADS = {"Abstract", "Introduction", "References", "Acknowledgements",
               "Acknowledgments", "Conclusion", "Conclusions", "Discussion",
               "Related Work", "Appendix", "Methods", "Results"}
BOLD = 16  # pymupdf span flag bit
PROSE_DENSITY = 0.12  # characters per point of width, above which a block is prose

# Some PDFs encode fi/fl/ff as single ligature glyphs, so extracted text reads
# "ﬁne-tuning" - one character where the reader sees two. Nothing errors:
# ids silently lose letters, and "fine" is not found in "ﬁne". Mapped
# explicitly rather than via NFKC, which would also rewrite superscripts,
# fractions and math symbols that carry meaning in a paper.
LIGATURES = str.maketrans({
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl",
    "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
})


def norm(s):
    """Every string extracted from the PDF passes through here."""
    return s.translate(LIGATURES)


def norm_rect(r, page):
    """A rect as fractions of the page it sits on.

    The reader draws these over a rendered PDF page at whatever size it happens
    to be showing. Fractions scale to any zoom by multiplication, so nothing in
    the viewer has to know about PDF units or which corner the origin is in."""
    w, h = page.rect.width, page.rect.height
    return [round(r.x0 / w, 5), round(r.y0 / h, 5), round(r.x1 / w, 5), round(r.y1 / h, 5)]


def text_blocks(page):
    return [b for b in page.get_text("blocks") if b[6] == 0]


def image_blocks(page):
    return [b for b in page.get_text("blocks") if b[6] == 1]


# A two-column paper breaks every heuristic that reads a page top-to-bottom: a
# heading in one column sits at the same height as body text in the other, so
# bucketing lines by y alone glues them together, and ordering blocks by y
# alone interleaves the columns line by line. Everything below exists to give
# each block a reading-order position instead of a raw y.
COL_TOL = 12.0  # how far a block may cross the midline and still be one column
PROSE_MIN = 200  # chars: below this a block is a caption or a label, not a paragraph


def column_mid(doc):
    """The x that splits a two-column layout, or None for a single-column one.

    Decided once for the document rather than per page. A single-column paper
    has pages whose only narrow blocks are strays - a displayed equation, a
    page number - and reordering those would break a layout that already reads
    correctly, so the single-column path stays exactly as it was.
    """
    xs0, xs1 = [], []
    for page in doc:
        for b in text_blocks(page):
            if len(norm(b[4]).strip()) < 20:
                continue
            xs0.append(b[0])
            xs1.append(b[2])
    if len(xs0) < 20:
        return None
    # Percentiles rather than min/max. An arXiv stamp is printed sideways in
    # the left margin, and that one block drags the midline ~30pt off centre -
    # far enough that the wider left-column lines read as spanning, which
    # splits a heading's number from its title and drops the heading entirely.
    mid = (float(np.percentile(xs0, 5)) + float(np.percentile(xs1, 95))) / 2
    # The vote counts paragraphs, and only over the pages that hold enough of
    # them to show a layout at all. Both halves of that were learned the hard
    # way. Counting every page sank a paper whose body was two-column
    # throughout but whose appendix - full-page figures, wide tables, pages of
    # transcripts - was more than half the document. Counting short blocks as
    # evidence flipped a single-column paper the other way, on the strength of
    # its side-by-side figure panels and their captions.
    two = eligible = 0
    for page in doc:
        left = right = 0
        for b in text_blocks(page):
            if len(norm(b[4]).strip()) < PROSE_MIN:
                continue  # captions, axis labels, page numbers, stray labels
            if b[2] <= mid + COL_TOL:
                left += 1
            elif b[0] >= mid - COL_TOL:
                right += 1
        if left + right >= 4:
            eligible += 1
        if left >= 2 and right >= 2:
            two += 1
    return mid if two >= max(2, eligible // 2) else None


def col_of(rect, mid):
    """0 left column, 1 right column, -1 spanning the page."""
    if mid is None:
        return -1
    if rect.x1 <= mid + COL_TOL:
        return 0
    if rect.x0 >= mid - COL_TOL:
        return 1
    return -1


def page_bands(page, mid):
    """Band-start y values for a page.

    A full-width element - the title block, a wide figure, a table that spans
    both columns - separates what is read before it from what is read after.
    Within a band the left column is read top to bottom, then the right.
    """
    if mid is None:
        return [0.0]
    ys = [0.0]
    for b in text_blocks(page) + image_blocks(page):
        r = pymupdf.Rect(b[:4])
        if col_of(r, mid) == -1 and r.height > 4:
            ys.append(r.y0)
    return sorted(set(ys))


def order_key(rect, mid, bands):
    """Reading-order sort key for one rect on one page."""
    band = 0
    for i, y in enumerate(bands):
        if rect.y0 >= y - 1:
            band = i
    c = col_of(rect, mid)
    # within a band the spanning element comes first, then left, then right
    return (band, 0 if c == -1 else 1, max(c, 0),
            round(rect.y0, 1), round(rect.x0, 1))


def find_headings(doc):
    """(page_index, order_key, id, title) for every numbered/named heading.
    Heading number and title can arrive as separate dict lines at the same y,
    so lines are bucketed by vertical position and joined left-to-right - but
    only within one column, or a heading picks up the body text sitting beside
    it in the other one and stops matching HEAD_RE at all."""
    heads, apps = [], []
    mid = column_mid(doc)
    for pno, page in enumerate(doc):
        bands = page_bands(page, mid)
        lines = []
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                txt = norm("".join(s["text"] for s in line["spans"])).strip()
                if not txt:
                    continue
                lines.append({
                    "y": line["bbox"][1], "x": line["bbox"][0], "txt": txt,
                    "rect": pymupdf.Rect(line["bbox"]),
                    "col": col_of(pymupdf.Rect(line["bbox"]), mid),
                    "size": max(s["size"] for s in line["spans"]),
                    "bold": any(s["flags"] & BOLD for s in line["spans"]),
                })
        lines.sort(key=lambda l: (l["col"], l["y"], l["x"]))
        groups = []
        for l in lines:
            if (groups and groups[-1][0]["col"] == l["col"]
                    and abs(l["y"] - groups[-1][0]["y"]) < 3):
                groups[-1].append(l)
            else:
                groups.append([l])
        for g in groups:
            g.sort(key=lambda l: l["x"])
            txt = " ".join(l["txt"] for l in g)
            size = max(l["size"] for l in g)
            bold = any(l["bold"] for l in g)
            if not (size > 11 or bold):
                continue
            key = order_key(g[0]["rect"], mid, bands)
            m = HEAD_RE.match(txt)
            ma = APPENDIX_RE.match(txt)
            if m:
                heads.append((pno, key, m.group(1), m.group(2).strip()))
            elif txt in NAMED_HEADS:
                heads.append((pno, key, txt.lower().replace(" ", "-"), txt))
            elif ma:
                apps.append((pno, key, ma.group(1), ma.group(2).strip()))
    # A long appendix usually gets a contents page, and every entry on it is
    # indistinguishable from the heading it points at - same letter, same
    # title, bold, after the references. Left alone it produces a second
    # section with the same id, which the gate rejects and the section writer
    # silently overwrites. Drop the page that lists them rather than the later
    # heading, so each appendix section still starts where its text does.
    listed = {a[0] for a in apps}
    for pno in sorted(listed):
        ids = {a[2] for a in apps if a[0] == pno}
        if len(ids) >= 3 and all(
                any(a[2] == i and a[0] > pno for a in apps) for i in ids):
            apps = [a for a in apps if a[0] != pno]

    heads.sort(key=lambda h: (h[0], h[1]))
    ref = next((h for h in heads if h[2] == "references"), None)
    if apps and ref is not None:
        after = [a for a in apps if (a[0], a[1]) > (ref[0], ref[1])]
        if after:
            heads.extend(after)
            heads.sort(key=lambda h: (h[0], h[1]))
    return heads


def find_captions(doc):
    """(page_index, block, kind, number, caption_text)"""
    caps = []
    for pno, page in enumerate(doc):
        for b in text_blocks(page):
            t = norm(b[4]).strip().replace("\n", " ")
            m = CAP_RE.match(t)
            if m:
                caps.append((pno, b, m.group(1).lower(), int(m.group(2)), t))
    return caps


def is_stopper(b, cap_bboxes, min_w=300):
    """A block that ends a figure/table band: body paragraph, heading, or another caption."""
    t = norm(b[4]).strip()
    r = pymupdf.Rect(b[:4])
    for cb in cap_bboxes:
        if abs(r.y0 - cb.y0) < 2 and abs(r.x0 - cb.x0) < 2:
            return True  # another caption
    if HEAD_RE.match(t.replace("\n", " ")) and len(t) < 80:
        return True
    # Body paragraphs fill their measure; table bodies are short cells with
    # gaps between them. Characters per point of block width does the
    # separating, and unlike a raw line length it does not move with the
    # column: single-column prose runs 73-94 chars over a 465pt measure and
    # two-column prose 33-41 over 218pt, which is the same density, while
    # table content sits at less than half of it either way. The length floor
    # only guards against short stray lines, so it is set well below the
    # shortest real paragraph seen (147 chars) - at 180 it let two-line
    # paragraphs through, and a swallowed block is dropped from the section
    # text as well as being drawn into the crop.
    # min_w is the width above which a block counts as a full measure of
    # prose. It is a fraction of the column in two columns, where a body
    # paragraph is around 225pt and would never clear a fixed 300 - so no
    # paragraph stops the band and the crop runs the whole column, taking that
    # paragraph out of the section text with it.
    avg_line = len(t) / max(1, t.count("\n") + 1)
    density = avg_line / max(1.0, r.width)
    return (r.width > min_w and len(t) > 120 and density > PROSE_DENSITY
            and not CAP_RE.match(t))


def has_ink(page, rect):
    """Is there anything drawn in this region? Rendered rather than asked of
    the drawing API, which misses figures embedded as Form XObjects."""
    rect = rect & page.rect
    if rect.height < 6 or rect.width < 6:
        return False
    pix = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), clip=rect)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    return bool((arr[:, :, :3] < 240).any())


def pixel_trim(page, band):
    """Render the band and shrink it to the bounding box of non-white pixels.
    Robust to figures embedded as Form XObjects, which get_drawings() misses."""
    z = 2
    pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=band)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    mask = (arr[:, :, :3] < 240).any(axis=2)
    rows, cols = mask.any(axis=1), mask.any(axis=0)
    if not rows.any():
        return band
    y0, y1 = np.argmax(rows), len(rows) - np.argmax(rows[::-1])
    x0, x1 = np.argmax(cols), len(cols) - np.argmax(cols[::-1])
    r = pymupdf.Rect(band.x0 + x0 / z - 6, band.y0 + y0 / z - 6,
                     band.x0 + x1 / z + 6, band.y0 + y1 / z + 6)
    return r & page.rect


def crop_rect(page, cap_block, kind, cap_bboxes, mid=None, side=None):
    """Band between the caption and the nearest stopper block, pixel-trimmed.

    In two columns the band is the caption's own column, and only blocks in
    that column - or spanning both - can stop it. Otherwise a paragraph in the
    other column, at a y that happens to fall just past the caption, collapses
    the band to nothing."""
    cap = pymupdf.Rect(cap_block[:4])
    # The band stops at the gutter itself, not at the tolerance either side of
    # it: COL_TOL is slack for deciding which column a block belongs to, and
    # using it as a crop edge reaches far enough to catch the first characters
    # of the column next door.
    c = col_of(cap, mid)
    if c == 0:
        x_lo, x_hi = 40, mid
    elif c == 1:
        x_lo, x_hi = mid, page.rect.width - 40
    else:
        x_lo, x_hi = 40, page.rect.width - 40
    others = [b for b in text_blocks(page)
              if pymupdf.Rect(b[:4]) != cap
              and (c == -1 or col_of(pymupdf.Rect(b[:4]), mid) in (c, -1))]
    # Measured against a column, never against the band. A caption that spans
    # both columns is still stopped by ordinary column-width paragraphs, and
    # sizing this off the spanning band asks them to be wider than they can
    # be - so nothing stops the band and the crop takes the rest of the page.
    min_w = 300 if mid is None else 0.65 * (mid - 40)
    def above():
        stop_y = 44.0
        for b in others:
            r = pymupdf.Rect(b[:4])
            if r.y1 <= cap.y0 + 2 and is_stopper(b, cap_bboxes, min_w):
                stop_y = max(stop_y, r.y1)
        return pymupdf.Rect(x_lo, stop_y + 4, x_hi, cap.y1 + 2)

    def below():
        stop_y = min(page.rect.height - 40, 718)
        for b in others:
            r = pymupdf.Rect(b[:4])
            if r.y0 >= cap.y1 - 2 and is_stopper(b, cap_bboxes, min_w):
                stop_y = min(stop_y, r.y0)
        return pymupdf.Rect(x_lo, cap.y0 - 2, x_hi, stop_y - 4)

    def body_of(band, side):
        """The band without the caption itself - what the crop is actually for.
        The side has to be passed: both bands run up to the caption, so it
        cannot be recovered from the band's own coordinates."""
        if side == "below":
            return pymupdf.Rect(band.x0, cap.y1 + 2, band.x1, band.y1)
        return pymupdf.Rect(band.x0, band.y0, band.x1, cap.y0 - 2)

    # Figures normally caption below their content and tables above it, until
    # a paper does the opposite - BERT captions its tables below. `side` is
    # that paper's own convention, learned by caption_sides(); the ink test
    # then overrides it for a single caption that genuinely sits the other way
    # round. Both matter: a caption with content on only one side is fixed by
    # looking, but one with content on BOTH sides - a column running table,
    # caption, table, caption - can only be resolved by the convention, and
    # getting it wrong pairs a caption with the next item's numbers, which
    # reads as a perfectly good crop.
    primary = side or ("above" if kind == "figure" else "below")
    other = "below" if primary == "above" else "above"
    make = {"above": above, "below": below}
    band = make[primary]()
    if not has_ink(page, body_of(band, primary)):
        alt = make[other]()
        if has_ink(page, body_of(alt, other)):
            band = alt
    out = pixel_trim(page, band)
    if c != -1:
        # pixel_trim pads by 6pt, which is enough to cross the gutter again.
        out = out & pymupdf.Rect(x_lo, out.y0, x_hi, out.y1)
    return out


def caption_sides(doc, caps, mid):
    """Which side of its caption a figure's or table's content sits on, per
    kind, learned from this paper's unambiguous captions.

    A caption with content on exactly one side votes for that side. Captions
    with content on both sides are the ones that need the answer and cannot
    supply it, so they do not vote."""
    votes = {"figure": {"above": 0, "below": 0}, "table": {"above": 0, "below": 0}}
    for pno, block, kind, num, _ in caps:
        page = doc[pno]
        cap = pymupdf.Rect(block[:4])
        c = col_of(cap, mid)
        if c == 0:
            x_lo, x_hi = 40, mid
        elif c == 1:
            x_lo, x_hi = mid, page.rect.width - 40
        else:
            x_lo, x_hi = 40, page.rect.width - 40
        up = has_ink(page, pymupdf.Rect(x_lo, max(44.0, cap.y0 - 260), x_hi, cap.y0 - 4))
        dn = has_ink(page, pymupdf.Rect(x_lo, cap.y1 + 4, x_hi, min(718.0, cap.y1 + 260)))
        if up and not dn:
            votes[kind]["above"] += 1
        elif dn and not up:
            votes[kind]["below"] += 1
    out = {}
    for kind, default in (("figure", "above"), ("table", "below")):
        v = votes[kind]
        out[kind] = default if v["above"] == v["below"] else max(v, key=v.get)
    return out


def read_json(path, default):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default


EQUATIONS = read_json(os.path.join(PAPER, "equations.json"), [])
NAMED_HEADS |= set(read_json(os.path.join(PAPER, "headings.json"), []))


def main():
    os.makedirs(os.path.join(ASSETS, "pages"), exist_ok=True)
    os.makedirs(os.path.join(ING, "sections"), exist_ok=True)
    doc = pymupdf.open(os.path.join(PAPER, "paper.pdf"))

    overrides = read_json(os.path.join(PAPER, "crops.json"), {})
    mid = column_mid(doc)
    print("layout:", "two-column" if mid else "single-column")

    # ---- page renders (for agent reference) ----
    for pno, page in enumerate(doc):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
        pix.save(os.path.join(ASSETS, "pages", f"page-{pno + 1:02d}.png"))

    # ---- figure/table crops ----
    caps = find_captions(doc)
    sides = caption_sides(doc, caps, mid)
    print("captions:", ", ".join(f"{k} content {v}" for k, v in sides.items()))
    items = []
    for pno, block, kind, num, cap_text in caps:
        item_id = f"{'fig' if kind == 'figure' else 'table'}-{num}"
        page = doc[pno]
        cap_bboxes = [pymupdf.Rect(b[:4]) for p2, b, *_ in caps if p2 == pno]
        if item_id in overrides:
            rect = pymupdf.Rect(overrides[item_id]["rect"])
        else:
            rect = crop_rect(page, block, kind, cap_bboxes, mid, sides[kind])
        z = 200 / 72
        pix = page.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=rect)
        asset = f"assets/{item_id}.png"
        pix.save(os.path.join(PAPER, "assets", f"{item_id}.png"))
        items.append({
            "id": item_id, "kind": kind, "number": num, "caption": cap_text,
            "page": pno + 1, "asset": asset,
            "rect": [round(v, 1) for v in rect],
        })

    for eq in EQUATIONS:
        items.append({"id": eq["id"], "kind": "equation", "number": None,
                      "caption": eq["name"], "page": None, "asset": None,
                      "section": eq["section"]})

    # ---- sections ----
    heads = find_headings(doc)

    # Equations are inventoried rather than detected, so they arrive with no
    # page. Take it from the section they were declared in - an agent asked to
    # check notation against the page image needs the right page.
    sec_page = {h[2]: h[0] + 1 for h in heads}
    for it in items:
        if it["kind"] == "equation" and it.get("section") in sec_page:
            it["page"] = sec_page[it["section"]]
    crop_rects = {}  # page -> list of rects to exclude from section text
    for it in items:
        if it["kind"] != "equation":
            crop_rects.setdefault(it["page"] - 1, []).append(pymupdf.Rect(it["rect"]))

    sections = [{"id": "front", "title": "Title & authors", "text": ""}]
    regions = []  # the same blocks again, with where they sit on the page
    hpos = 0
    for pno, page in enumerate(doc):
        bands = page_bands(page, mid)
        ordered = sorted(text_blocks(page),
                         key=lambda b: order_key(pymupdf.Rect(b[:4]), mid, bands))
        for b in ordered:
            r = pymupdf.Rect(b[:4])
            if r.y0 > 715 and len(b[4].strip()) < 25:
                continue  # page number / footer
            if any(cr.contains(pymupdf.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
                   for cr in crop_rects.get(pno, [])):
                continue  # inside a figure/table crop
            bkey = order_key(r, mid, bands)
            while hpos < len(heads) and (heads[hpos][0] < pno or
                    (heads[hpos][0] == pno and heads[hpos][1] <= bkey)):
                h = heads[hpos]
                sections.append({"id": h[2], "title": h[3], "text": ""})
                hpos += 1
            txt = norm(b[4]).strip()
            sections[-1]["text"] += txt + "\n\n"
            sec = sections[-1]
            sec["n"] = sec.get("n", 0) + 1
            regions.append({
                "id": f"p-{sec['id']}-{sec['n']:02d}",
                "kind": "paragraph",
                "sectionId": sec["id"],
                "page": pno + 1,
                "rect": norm_rect(r, page),
                "text": txt,
            })

    # Section filenames carry their index and their title, so both move when a
    # heading fix changes the split. Re-running ingest would otherwise leave
    # the previous run's files in place beside the new ones, and every agent
    # downstream reads this directory - it would be handed the old broken
    # split and the new one at once, with nothing to tell them apart.
    for stale in os.listdir(os.path.join(ING, "sections")):
        if stale.endswith(".txt"):
            os.remove(os.path.join(ING, "sections", stale))

    for i, s in enumerate(sections):
        slug = re.sub(r"[^a-z0-9.]+", "-", s["title"].lower()).strip("-")
        fname = f"{i:02d}-{s['id']}-{slug}.txt"
        s["file"] = f"data/ingest/sections/{fname}"
        with open(os.path.join(ING, "sections", fname), "w", encoding="utf-8") as f:
            f.write(f"[{s['id']}] {s['title']}\n\n{s['text']}")

    json.dump({"paperId": PAPER_ID, "sections": [
        {k: s[k] for k in ("id", "title", "file")} | {"chars": len(s["text"])}
        for s in sections]},
        open(os.path.join(ING, "sections.json"), "w", encoding="utf-8"), indent=1)
    json.dump({"paperId": PAPER_ID, "items": items},
              open(os.path.join(ING, "items.json"), "w", encoding="utf-8"), indent=1)

    # ---- regions: where the reader draws ----
    # Title block and reference list are not read paragraph by paragraph, so
    # they get no region and the reader simply shows nothing alongside them.
    regions = [g for g in regions if g["sectionId"] not in ("front", "references")]

    # A section's heading is a block like any other. Named as one here so the
    # reader can render it as a heading and the ranking stage can skip it,
    # rather than both having to guess from how short the text is.
    titles = {s["id"]: s["title"] for s in sections}
    flat = lambda t: re.sub(r"\s+", " ", t).strip().lower()
    seen = set()
    for g in regions:
        sid = g["sectionId"]
        if sid in seen:
            continue
        seen.add(sid)
        if flat(g["text"]) in (flat(f"{sid} {titles.get(sid, '')}"), flat(titles.get(sid, ""))):
            g["kind"] = "heading"

    for it in items:
        if it.get("rect") and it.get("page"):
            regions.append({
                "id": it["id"], "kind": "item", "sectionId": None,
                "page": it["page"],
                "rect": norm_rect(pymupdf.Rect(it["rect"]), doc[it["page"] - 1]),
            })
    regions.sort(key=lambda g: (g["page"], g["rect"][1]))
    json.dump({"paperId": PAPER_ID, "pages": len(doc), "regions": regions},
              open(os.path.join(ING, "regions.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)

    print(f"pages: {len(doc)}")
    print("sections:")
    for s in sections:
        print(f"  [{s['id']}] {s['title']}  ({len(s['text'])} chars)")
    print(f"regions: {sum(1 for g in regions if g['kind'] == 'paragraph')} paragraphs, "
          f"{sum(1 for g in regions if g['kind'] == 'item')} items")
    print("items:")
    for it in items:
        print(f"  {it['id']}: p{it['page']} rect={it.get('rect')} | {it['caption'][:60]}")


if __name__ == "__main__":
    main()
