"""Attach the recursive narrative tree to narrative.json.

Root chapters gain childId; every node and chapter gains a dotted number
(3, 3.2, 3.2.1) so a reader always knows how deep they are.

usage: python pipeline/save_narrative_tree.py <task-output.json>
"""
import json
import os
import re
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
WIKI = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


def main(task_out):
    res = json.load(open(task_out, encoding="utf-8"))["result"]
    nodes = {n["id"]: n for n in res["nodes"]}

    npath = os.path.join(ROOT, "papers", MAIN, "data", "narrative.json")
    nar = json.load(open(npath, encoding="utf-8"))

    # root chapters -> their expansion nodes
    for i, ch in enumerate(nar["chapters"]):
        ch["number"] = str(i + 1)
        cid = "n-" + ch["id"]
        ch["childId"] = cid if cid in nodes else None

    # dotted numbering, walked from the root
    def walk(node_id, prefix):
        n = nodes.get(node_id)
        if not n:
            return
        n["number"] = prefix
        for j, ch in enumerate(n["chapters"]):
            ch["number"] = f"{prefix}.{j + 1}"
            if ch.get("childId"):
                walk(ch["childId"], ch["number"])

    for ch in nar["chapters"]:
        if ch["childId"]:
            walk(ch["childId"], ch["number"])

    # drop the fields the viewer does not need
    for n in nodes.values():
        n.pop("path", None)

    nar["nodes"] = nodes
    json.dump(nar, open(npath, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    # ---- report ----
    known = {c["id"] for c in load(MAIN, "concepts", [])}
    known |= {i["id"] for i in load(MAIN, "items", [])}
    known |= {t["id"] for t in load(MAIN, "themes", [])}
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    for pid in register:
        if pid != MAIN:
            known |= {c["id"] for c in load(pid, "concepts", [])}

    by_depth, words, links, broken, leaves = {}, 0, 0, [], 0
    for n in nodes.values():
        by_depth[n["depth"]] = by_depth.get(n["depth"], 0) + 1
        for ch in n["chapters"]:
            words += len(ch["body"].split())
            if not ch.get("childId"):
                leaves += 1
            for m in WIKI.finditer(ch["body"] + " " + (n.get("intro") or "")):
                links += 1
                if m.group(1).strip() not in known:
                    broken.append((n["id"], m.group(1).strip()))

    depth_max = max(by_depth) if by_depth else 0
    print(f"narrative tree: {len(nodes)} nodes, max depth {depth_max}")
    for d in sorted(by_depth):
        print(f"  level {d}: {by_depth[d]} nodes")
    print(f"  {sum(len(n['chapters']) for n in nodes.values())} chapters, {leaves} of them leaves")
    print(f"  ~{words} words, {links} wiki-links, {len(broken)} broken")
    for nid, bad in broken[:15]:
        print(f"   broken: {nid} -> [[{bad}]]")

    print("\ntree:")
    def show(ch, indent):
        print("  " * indent + f"{ch['number']} {ch['title']}")
        if ch.get("childId") and ch["childId"] in nodes:
            for c in nodes[ch["childId"]]["chapters"]:
                show(c, indent + 1)
    for ch in nar["chapters"]:
        show(ch, 1)


if __name__ == "__main__":
    main(sys.argv[1])
