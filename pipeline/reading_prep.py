"""Stage 2c prep: one ranking job per paragraph of the PDF.

The reader shows, beside each paragraph, the concepts that paragraph leans on.
Nothing has to be discovered to do that: every concept already records the
sections it came from, so the candidate pool for a paragraph is whatever its
own section owns. The agent only has to pick and order from a list it is given,
which is why this stage is one small call per paragraph rather than a read of
the paper.

Two consequences worth keeping: a paragraph can only ever be tagged with
concepts its own section owns, so a hallucinated link is not expressible; and
the stage reads nothing but concepts.json and regions.json, so it re-runs alone.

Emits pipeline/reading-targets.json listing one job per paragraph.
"""
import json
import os

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
PAPER = os.path.join(ROOT, "papers", MAIN)

# A section this thin gives an agent nothing to choose between, so the pool
# widens to the enclosing section - 3.2.1 borrows from 3.2, then from 3.
THIN = 4


def load(name, default):
    p = os.path.join(PAPER, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


def ancestors(sid):
    """3.2.1 -> ["3.2", "3"]. Unnumbered sections have none."""
    parts = sid.split(".")
    return [".".join(parts[:i]) for i in range(len(parts) - 1, 0, -1)]


def main():
    regions = json.load(open(os.path.join(PAPER, "data", "ingest", "regions.json"),
                             encoding="utf-8"))["regions"]
    concepts = load("concepts", [])

    # Floor concepts are dropped here, once, rather than at read time: they sit
    # at or below what the reader is assumed to know and were never broken
    # down, so they have nothing to offer a sidebar.
    by_section = {}
    for c in concepts:
        if c.get("floor"):
            continue
        for sid in c.get("sectionIds") or []:
            by_section.setdefault(sid, []).append(c)

    jobs, thin, empty = [], 0, 0
    for g in regions:
        if g["kind"] != "paragraph":
            continue
        sid = g["sectionId"]
        pool = list(by_section.get(sid, []))
        if len(pool) < THIN:
            for anc in ancestors(sid):
                for c in by_section.get(anc, []):
                    if c["id"] not in {x["id"] for x in pool}:
                        pool.append(c)
                if len(pool) >= THIN:
                    break
            thin += 1
        if not pool:
            empty += 1
            continue
        jobs.append({
            "id": g["id"],
            "sectionId": sid,
            "page": g["page"],
            "text": g["text"],
            "candidates": [{"id": c["id"], "name": c["name"], "summary": c.get("summary", "")}
                           for c in pool],
        })

    out = os.path.join(ROOT, "pipeline", "reading-targets.json")
    json.dump({"paperId": MAIN, "jobs": jobs},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    sizes = sorted(len(j["candidates"]) for j in jobs)
    print(f"paragraphs: {len(jobs)} to rank"
          + (f", {empty} skipped with no concepts in their section" if empty else ""))
    print(f"candidates per paragraph: {sizes[0]}-{sizes[-1]}, median {sizes[len(sizes) // 2]}"
          + (f" ({thin} widened to the enclosing section)" if thin else ""))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
