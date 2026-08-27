"""Save stage-2c paragraph rankings -> data/reading.json.

usage: python pipeline/save_reading.py <workflow-task-output.json>

Anything an agent returned that was not in the paragraph's candidate pool is
dropped rather than trusted. The pool is the whole safety of this stage, so it
is enforced here and not only asked for in the prompt.
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
PAPER = os.path.join(ROOT, "papers", MAIN)


def main(task_out):
    jobs = {j["id"]: j for j in json.load(
        open(os.path.join(ROOT, "pipeline", "reading-targets.json"), encoding="utf-8"))["jobs"]}
    results = json.load(open(task_out, encoding="utf-8"))
    results = results.get("result", results)
    ranked = {r["id"]: r.get("concepts", []) for r in results["paragraphs"]}

    out, dropped, missing = [], 0, 0
    for pid, job in jobs.items():
        pool = {c["id"] for c in job["candidates"]}
        got = ranked.get(pid)
        if got is None:
            missing += 1
            got = []
        keep, seen = [], set()
        for cid in got:
            if cid in pool and cid not in seen:
                seen.add(cid)
                keep.append(cid)
            else:
                dropped += 1
        out.append({"id": pid, "concepts": keep})

    dest = os.path.join(PAPER, "data", "reading.json")
    json.dump({"paperId": MAIN, "paragraphs": out},
              open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    tagged = sum(1 for p in out if p["concepts"])
    total = sum(len(p["concepts"]) for p in out)
    print(f"paragraphs: {len(out)}, {tagged} with concepts, {total} links "
          f"({total / max(tagged, 1):.1f} per tagged paragraph)")
    if dropped:
        print(f"dropped {dropped} id(s) not in their paragraph's pool")
    if missing:
        print(f"WARNING: {missing} paragraph(s) had no agent result - re-run those")
    print(f"wrote {dest}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
