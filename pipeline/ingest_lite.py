"""Narrow ingest for cited papers: PDF -> single fulltext.txt with page markers."""
import os
import sys

import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for pid in sys.argv[1:]:
    pdir = os.path.join(ROOT, "papers", pid)
    doc = pymupdf.open(os.path.join(pdir, "paper.pdf"))
    out = os.path.join(pdir, "data", "ingest", "fulltext.txt")
    with open(out, "w", encoding="utf-8") as f:
        for pno, page in enumerate(doc):
            f.write(f"\n===== page {pno + 1} =====\n")
            f.write(page.get_text())
    print(f"{pid}: {len(doc)} pages -> fulltext.txt")
