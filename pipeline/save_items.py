"""Merge stage-2 figure-agent output onto the ingest inventory -> data/items.json.

usage: python pipeline/save_items.py <dir-of-per-item-json | task-output.json>

A directory is the normal case: each figure agent writes its own result to
data/ingest/items/<item-id>.json, so eighty walkthroughs reach this script
without any agent having to carry them. A single task-output file still works,
for a run whose results arrived that way.
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()


def load_results(src):
    if os.path.isdir(src):
        out = {}
        for f in sorted(os.listdir(src)):
            if not f.endswith(".json"):
                continue
            r = json.load(open(os.path.join(src, f), encoding="utf-8"))
            r = r.get("result", r)          # tolerate either wrapping
            if isinstance(r, dict) and r.get("id"):
                out[r["id"]] = r
        return out
    raw = json.load(open(src, encoding="utf-8"))
    return {i["id"]: i for i in raw["result"]["items"]}


def main(task_out):
    agent_items = load_results(task_out)
    base = json.load(open(os.path.join(ROOT, "papers", MAIN, "data", "ingest", "items.json"),
                          encoding="utf-8"))["items"]

    out = []
    for it in base:
        a = agent_items.get(it["id"], {})
        merged = dict(it)
        merged.update({
            "title": a.get("title") or (it["caption"].split(":")[0] if it.get("caption") else it["id"]),
            "takeaway": a.get("takeaway", ""),
            "walkthrough": a.get("walkthrough", ""),
            "latex": a.get("latex"),
            "terms": a.get("terms", []),
            "numbers": a.get("numbers", []),
        })
        merged.pop("rect", None)
        out.append(merged)

    json.dump({"items": out},
              open(os.path.join(ROOT, "papers", MAIN, "data", "items.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)

    done = [i for i in out if i["walkthrough"]]
    print(f"items.json: {len(out)} items, {len(done)} with walkthroughs")
    for i in out:
        mark = "ok " if i["walkthrough"] else "MISSING "
        print(f"  {mark}{i['id']}: {len(i['terms'])} terms, {len(i['numbers'])} numbers | {i['title']}")


if __name__ == "__main__":
    main(sys.argv[1])
