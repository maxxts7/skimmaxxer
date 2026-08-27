"""Assemble the recursive narrative tree, and never point at a node that is not there.

usage: python pipeline/save_narrative.py <dir-of-node-json>
       python pipeline/save_narrative.py --repair

A chapter's childId is decided when the chapter asks to go deeper - which is
before the agent that would write that child has run. If that agent dies, the
pointer survives it, and the reader gets a "zoom into this chapter" link that
goes nowhere. So the pointers are settled here, at the end, against the nodes
that actually exist, rather than at the moment they were hoped for.

--repair does only that check against whatever narrative.json already holds,
for a run whose tree was assembled some other way.

Also numbers the tree: root chapters 1..N, and a node inherits its parent
chapter's number, its own chapters becoming <parent>.1, <parent>.2, and so on.
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
NAR = os.path.join(ROOT, "papers", MAIN, "data", "narrative.json")


def number(root, nodes):
    """Dotted numbers, so depth is legible on the page rather than implied."""
    def walk(chapters, prefix):
        for i, ch in enumerate(chapters, 1):
            ch["number"] = f"{prefix}{i}" if not prefix else f"{prefix}.{i}"
            kid = nodes.get(ch.get("childId") or "")
            if kid:
                kid["number"] = ch["number"]
                walk(kid.get("chapters", []), ch["number"])
    walk(root.get("chapters", []), "")


def main(src):
    root = json.load(open(NAR, encoding="utf-8"))
    if src == "--repair":
        nodes = dict(root.get("nodes") or {})
    else:
        nodes = {}
        for f in sorted(os.listdir(src)):
            if f.endswith(".json"):
                r = json.load(open(os.path.join(src, f), encoding="utf-8"))
                r = r.get("result", r)
                if r.get("id"):
                    nodes[r["id"]] = r

    # Every pointer, root and nested, checked against what exists.
    cut = []
    for ch in root.get("chapters", []):
        want = ch.get("childId") or ("n-" + ch["id"])
        if want in nodes:
            ch["childId"] = want
        else:
            if ch.get("childId"):
                cut.append((root.get("title", "root"), ch["id"], ch["childId"]))
            ch["childId"] = None
    for nid, n in nodes.items():
        for ch in n.get("chapters", []):
            # A chapter that asked to go deeper names its child by convention.
            # It only becomes a pointer if that node was actually written.
            want = ch.get("childId") or (f"{nid}--{ch['id']}" if ch.get("expand") else None)
            if want and want in nodes:
                ch["childId"] = want
            else:
                if want:
                    cut.append((nid, ch["id"], want))
                ch["childId"] = None

    root["nodes"] = nodes
    number(root, nodes)
    json.dump(root, open(NAR, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    depth = max([n.get("depth", 1) for n in nodes.values()] or [0])
    print(f"narrative.json: {len(root.get('chapters', []))} root chapters, "
          f"{len(nodes)} sub-narratives, depth {depth}")
    if cut:
        print(f"  child pointers with no node behind them, cleared ({len(cut)}):")
        for parent, ch, missing in cut:
            print(f"    {parent} / {ch} -> {missing}")
        print("  those chapters now simply do not open further, which is honest;")
        print("  re-run the missing nodes if you want the depth back.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "--repair")
