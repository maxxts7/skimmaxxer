"""Save stage-3/4 output: edges.json + themes.json, dropping edges whose
endpoints do not resolve to a routable node.

usage: python pipeline/save_edges.py <workflow-task-output.json>
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


def main(task_out):
    res = json.load(open(task_out, encoding="utf-8"))["result"]
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]

    known = {c["id"] for c in load(MAIN, "concepts", [])}
    known |= {i["id"] for i in load(MAIN, "items", [])}
    for pid in register:
        if pid != MAIN:
            known |= {c["id"] for c in load(pid, "concepts", [])}

    edges, dropped = [], []
    for e in res["edges"]:
        if e["source"] in known and e["target"] in known:
            edges.append(e)
        else:
            bad = [x for x in (e["source"], e["target"]) if x not in known]
            dropped.append(f"{e['id']} {e['source']} --{e['type']}--> {e['target']} (unknown: {', '.join(bad)})")

    live = {e["id"] for e in edges}
    themes = []
    for t in res["themes"]:
        members = [m for m in t["members"] if (m in live if t["kind"] == "edge-theme" else m in known)]
        t = dict(t)
        t["members"] = members
        themes.append(t)
    themes.sort(key=lambda t: (0 if t["kind"] == "concept-theme" else 1, t.get("order", 99)))

    d = os.path.join(ROOT, "papers", MAIN, "data")
    json.dump({"edges": edges}, open(os.path.join(d, "edges.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    json.dump({"themes": themes}, open(os.path.join(d, "themes.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)

    for lens in res.get("perLens", []):
        print(f"  lens {lens['lens']}: {lens['found']} raw")
    print(f"edges.json: {len(edges)} kept, {len(dropped)} dropped")
    for x in dropped[:15]:
        print("   drop " + x)
    by_type = {}
    for e in edges:
        by_type[e["type"]] = by_type.get(e["type"], 0) + 1
    print("  by type: " + ", ".join(f"{k}={v}" for k, v in sorted(by_type.items())))
    print(f"themes.json: {len(themes)} themes")
    for t in themes:
        print(f"   [{t['kind'][:7]}] {t['id']}: {len(t['members'])} members | {t['name']}")


if __name__ == "__main__":
    main(sys.argv[1])
