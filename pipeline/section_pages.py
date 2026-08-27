"""Map each paper section to the PDF page range it occupies.

Reuses the heading detection from ingest.py so the two stay consistent.
Emits data/ingest/section-pages.json.
"""
import json
import os
import sys

import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingest import find_headings  # noqa: E402

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()

# A paper published as a web page has no pages to map to, and ingest_web.py
# has already written section-pages.json with anchors in their place. This is
# a PDF-only stage, so on a web paper it is finished before it starts rather
# than a failure to work around.
PDF = os.path.join(ROOT, "papers", MAIN, "paper.pdf")
if not os.path.exists(PDF):
    out = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "section-pages.json")
    if os.path.exists(out):
        n = len(json.load(open(out, encoding="utf-8")))
        print(f"{MAIN} has no PDF - web-ingested, {n} sections already mapped to anchors. Nothing to do.")
        raise SystemExit(0)
    raise SystemExit(f"{MAIN} has neither paper.pdf nor a section-pages.json from the web ingest.")

doc = pymupdf.open(PDF)
heads = find_headings(doc)          # (page_index, y, id, title), document order
n_pages = len(doc)

sections = {"front": {"title": "Title & authors", "start": 1, "end": 1}}
for i, (pno, y, sid, title) in enumerate(heads):
    start = pno + 1
    # a section runs until the next heading starts; if that heading is on the
    # same page, the section still touches that page, so end >= start
    end = heads[i + 1][0] + 1 if i + 1 < len(heads) else n_pages
    sections[sid] = {"title": title, "start": start, "end": max(start, end)}

json.dump(sections,
          open(os.path.join(ROOT, "papers", MAIN, "data", "ingest", "section-pages.json"),
               "w", encoding="utf-8"), indent=1, ensure_ascii=False)

print(f"{len(sections)} sections over {n_pages} pages")
for sid, s in sections.items():
    span = f"p{s['start']}" if s["start"] == s["end"] else f"p{s['start']}-{s['end']}"
    print(f"  {sid:<12} {span:<8} {s['title']}")
