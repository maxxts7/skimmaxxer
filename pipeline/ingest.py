"""Stage 0 ingest: PDF -> section text, page renders, figure/table crops, item inventory.

Heuristics assume a single-column layout with figure captions below their
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

CAP_RE = re.compile(r"^(Figure|Table)\s+(\d+)\s*:")
HEAD_RE = re.compile(r"^(\d+(?:\.\d+)*)\s+([A-Z].{2,60})$")
# Unnumbered headings worth treating as sections. Extend per paper via
# papers/<id>/headings.json (a JSON list of strings).
NAMED_HEADS = {"Abstract", "Introduction", "References", "Acknowledgements",
               "Acknowledgments", "Conclusion", "Conclusions", "Discussion",
               "Related Work", "Appendix", "Methods", "Results"}
BOLD = 16  # pymupdf span flag bit

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


def text_blocks(page):
    return [b for b in page.get_text("blocks") if b[6] == 0]


def image_blocks(page):
    return [b for b in page.get_text("blocks") if b[6] == 1]


def find_headings(doc):
    """(page_index, y, id, title) for every numbered/named heading.
    Heading number and title can arrive as separate dict lines at the same y,
    so lines are bucketed by vertical position and joined left-to-right."""
    heads = []
    for pno, page in enumerate(doc):
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
                    "size": max(s["size"] for s in line["spans"]),
                    "bold": any(s["flags"] & BOLD for s in line["spans"]),
                })
        lines.sort(key=lambda l: (l["y"], l["x"]))
        groups = []
        for l in lines:
            if groups and abs(l["y"] - groups[-1][0]["y"]) < 3:
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
            m = HEAD_RE.match(txt)
            if m:
                heads.append((pno, g[0]["y"], m.group(1), m.group(2).strip()))
            elif txt in NAMED_HEADS:
                heads.append((pno, g[0]["y"], txt.lower().replace(" ", "-"), txt))
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


def is_stopper(b, cap_bboxes):
    """A block that ends a figure/table band: body paragraph, heading, or another caption."""
    t = norm(b[4]).strip()
    r = pymupdf.Rect(b[:4])
    for cb in cap_bboxes:
        if abs(r.y0 - cb.y0) < 2 and abs(r.x0 - cb.x0) < 2:
            return True  # another caption
    if HEAD_RE.match(t.replace("\n", " ")) and len(t) < 80:
        return True
    # Body paragraphs have long visual lines; table bodies are many short cells.
    # avg_line does the separating: measured across two papers, body prose runs
    # 73-94 and table content tops out at 36.5. The length floor only guards
    # against short stray lines, so it is set well below the shortest real
    # paragraph seen (147 chars) - at 180 it let two-line paragraphs through,
    # and a swallowed block is dropped from the section text as well as being
    # drawn into the crop.
    avg_line = len(t) / max(1, t.count("\n") + 1)
    return (r.width > 300 and len(t) > 120 and avg_line > 50 and not CAP_RE.match(t))


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


def crop_rect(page, cap_block, kind, cap_bboxes):
    """Band between the caption and the nearest stopper block, pixel-trimmed."""
    cap = pymupdf.Rect(cap_block[:4])
    others = [b for b in text_blocks(page) if pymupdf.Rect(b[:4]) != cap]
    if kind == "figure":  # content above the caption
        stop_y = 44.0
        for b in others:
            r = pymupdf.Rect(b[:4])
            if r.y1 <= cap.y0 + 2 and is_stopper(b, cap_bboxes):
                stop_y = max(stop_y, r.y1)
        band = pymupdf.Rect(40, stop_y + 4, page.rect.width - 40, cap.y1 + 2)
    else:  # table: content below the caption
        stop_y = min(page.rect.height - 40, 718)
        for b in others:
            r = pymupdf.Rect(b[:4])
            if r.y0 >= cap.y1 - 2 and is_stopper(b, cap_bboxes):
                stop_y = min(stop_y, r.y0)
        band = pymupdf.Rect(40, cap.y0 - 2, page.rect.width - 40, stop_y - 4)
    return pixel_trim(page, band)


def read_json(path, default):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else default


EQUATIONS = read_json(os.path.join(PAPER, "equations.json"), [])
NAMED_HEADS |= set(read_json(os.path.join(PAPER, "headings.json"), []))


def main():
    os.makedirs(os.path.join(ASSETS, "pages"), exist_ok=True)
    os.makedirs(os.path.join(ING, "sections"), exist_ok=True)
    doc = pymupdf.open(os.path.join(PAPER, "paper.pdf"))

    overrides = read_json(os.path.join(PAPER, "crops.json"), {})

    # ---- page renders (for agent reference) ----
    for pno, page in enumerate(doc):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
        pix.save(os.path.join(ASSETS, "pages", f"page-{pno + 1:02d}.png"))

    # ---- figure/table crops ----
    caps = find_captions(doc)
    items = []
    for pno, block, kind, num, cap_text in caps:
        item_id = f"{'fig' if kind == 'figure' else 'table'}-{num}"
        page = doc[pno]
        cap_bboxes = [pymupdf.Rect(b[:4]) for p2, b, *_ in caps if p2 == pno]
        if item_id in overrides:
            rect = pymupdf.Rect(overrides[item_id]["rect"])
        else:
            rect = crop_rect(page, block, kind, cap_bboxes)
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
    hpos = 0
    for pno, page in enumerate(doc):
        page_heads = [h for h in heads if h[0] == pno]
        for b in sorted(text_blocks(page), key=lambda b: (b[1], b[0])):
            r = pymupdf.Rect(b[:4])
            if r.y0 > 715 and len(b[4].strip()) < 25:
                continue  # page number / footer
            if any(cr.contains(pymupdf.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
                   for cr in crop_rects.get(pno, [])):
                continue  # inside a figure/table crop
            while hpos < len(heads) and (heads[hpos][0] < pno or
                    (heads[hpos][0] == pno and heads[hpos][1] <= r.y0 + 1)):
                h = heads[hpos]
                sections.append({"id": h[2], "title": h[3], "text": ""})
                hpos += 1
            sections[-1]["text"] += norm(b[4]).strip() + "\n\n"

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

    print(f"pages: {len(doc)}")
    print("sections:")
    for s in sections:
        print(f"  [{s['id']}] {s['title']}  ({len(s['text'])} chars)")
    print("items:")
    for it in items:
        print(f"  {it['id']}: p{it['page']} rect={it.get('rect')} | {it['caption'][:60]}")


if __name__ == "__main__":
    main()
