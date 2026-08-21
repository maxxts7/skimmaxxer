"""Stage 7 quality gate: structural checks over the generated data.

Enforces the project's core promise - no unexplained prerequisite term - by
checking that every reference resolves to something the reader can open.

usage: python pipeline/qa.py
"""
import json
import os
import re
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
WIKI = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")
BANNED = re.compile(r"\b(novel|remarkably|elegant|elegantly|powerful|seminal|groundbreaking|revolutionary|cutting-edge)\b", re.I)


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    if isinstance(raw, dict) and name in raw:
        return raw[name]
    return raw


def main():
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    concepts = load(MAIN, "concepts", [])
    items = load(MAIN, "items", [])
    edges = load(MAIN, "edges", [])
    themes = load(MAIN, "themes", [])
    pages = load(MAIN, "pages", [])
    narrative = load(MAIN, "narrative", None)
    insights = load(MAIN, "insights", None)

    # every id the viewer can route to
    known = {c["id"] for c in concepts} | {i["id"] for i in items} | {t["id"] for t in themes}
    for pid in register:
        if pid != MAIN:
            known |= {c["id"] for c in load(pid, "concepts", [])}

    problems = {}

    def add(kind, msg):
        problems.setdefault(kind, []).append(msg)

    # 0. no id claimed twice. The viewer indexes ids globally and keeps the
    # first it sees, so a duplicate is a concept that silently never renders -
    # no error anywhere, which is why this has to be checked rather than read.
    owner = {}
    for pid in register:
        here = set()
        for c in load(pid, "concepts", []):
            cid = c["id"]
            if cid in here:
                add("duplicate-id", f"{cid} appears twice within {pid}")
            here.add(cid)
            if cid in owner and owner[cid] != pid:
                add("duplicate-id", f"{cid} claimed by both {owner[cid]} and {pid}")
            owner.setdefault(cid, pid)

    # 1. wiki links resolve
    def scan(text, where):
        for m in WIKI.finditer(str(text or "")):
            cid = m.group(1).strip()
            if cid not in known:
                add("unresolved-link", f"{where} -> [[{cid}]]")

    for c in concepts:
        scan(c.get("explanation"), "concept:" + c["id"])
        scan(c.get("summary"), "concept:" + c["id"])
    for i in items:
        scan(i.get("walkthrough"), "item:" + i["id"])
        scan(i.get("takeaway"), "item:" + i["id"])
    for e in edges:
        scan(e.get("explanation"), "edge:" + e.get("id", "?"))
    for t in themes:
        scan(t.get("summary"), "theme:" + t["id"])
    for p in pages:
        scan(p.get("body"), "page:" + p.get("id", "?"))
    if narrative:
        for ch in narrative.get("chapters", []):
            scan(ch.get("body"), "narrative:" + ch.get("id", "?"))
        nodes = narrative.get("nodes", {})
        for nid, n in nodes.items():
            scan(n.get("intro"), "narrative:" + nid)
            for ch in n.get("chapters", []):
                scan(ch.get("body"), "narrative:" + nid + ":" + ch.get("id", "?"))
                if ch.get("childId") and ch["childId"] not in nodes:
                    add("narrative-dangling-child", f"{nid}.{ch.get('id')} -> {ch['childId']}")
            if n.get("parentId") not in (None, "root") and n.get("parentId") not in nodes:
                add("narrative-orphan-node", f"{nid} -> parent {n.get('parentId')}")
        for ch in narrative.get("chapters", []):
            if ch.get("childId") and ch["childId"] not in nodes:
                add("narrative-dangling-child", f"root.{ch.get('id')} -> {ch['childId']}")

    if insights:
        edge_ids_all = {e.get("id") for e in edges}
        nodes_i = insights.get("nodes", {})
        def scan_ins(node, key):
            scan(node.get("intro"), "insights:" + key)
            for ch in node.get("chapters", []):
                scan(ch.get("body"), "insights:" + key + ":" + ch.get("id", "?"))
                for eid in ch.get("edgeIds", []):
                    if eid not in edge_ids_all:
                        add("insights-bad-edge", f"{key}.{ch.get('id')} -> {eid}")
                if ch.get("childId") and ch["childId"] not in nodes_i:
                    add("insights-dangling-child", f"{key}.{ch.get('id')} -> {ch['childId']}")
        scan_ins(insights, "root")
        for nid, n in nodes_i.items():
            scan_ins(n, nid)
        used_i = set()
        for ch in insights.get("chapters", []):
            used_i |= set(ch.get("edgeIds", []))
        for n in nodes_i.values():
            for ch in n.get("chapters", []):
                used_i |= set(ch.get("edgeIds", []))
        for e in edges:
            if e.get("strength") == "load-bearing" and e.get("id") not in used_i:
                add("load-bearing-edge-not-in-insights", e.get("id", "?"))

    # 2. concept tree integrity
    ids = {c["id"] for c in concepts}
    by_id = {c["id"]: c for c in concepts}
    for c in concepts:
        if c.get("parent") and c["parent"] not in ids:
            add("bad-parent", f"{c['id']} -> {c['parent']}")
        for p in c.get("prerequisites", []):
            if p not in known:
                add("unresolved-prereq", f"{c['id']} -> {p}")
    for c in concepts:  # cycles
        seen, cur = set(), c["id"]
        while cur:
            if cur in seen:
                add("parent-cycle", c["id"])
                break
            seen.add(cur)
            cur = (by_id.get(cur) or {}).get("parent")

    # 3. edges point at real things
    for e in edges:
        for end in ("source", "target"):
            if e.get(end) not in known:
                add("dangling-edge", f"{e.get('id', '?')}.{end} -> {e.get(end)}")

    # 4. coverage
    edge_ids = {e.get("id") for e in edges}
    themed_c, themed_e = set(), set()
    for t in themes:
        for m in t.get("members", []):
            (themed_e if t.get("kind") == "edge-theme" else themed_c).add(m)
            if t.get("kind") == "edge-theme":
                if m not in edge_ids:
                    add("theme-bad-member", f"{t['id']} -> {m}")
            elif m not in ids:
                add("theme-bad-member", f"{t['id']} -> {m}")
    page_for = {p.get("forId") for p in pages}
    for c in concepts:
        if c["tier"] == "major" and c["id"] not in page_for:
            add("major-without-page", c["id"])
        if not c.get("floor") and not c.get("parent") and c["id"] not in themed_c and themes:
            add("concept-not-in-theme", c["id"])
    for e in edges:
        if e.get("id") not in themed_e and themes:
            add("edge-not-in-theme", e.get("id", "?"))
    for i in items:
        if not i.get("walkthrough"):
            add("item-without-walkthrough", i["id"])
        if not i.get("terms"):
            add("item-without-terms", i["id"])

    # 5. voice
    def voice(text, where):
        for m in BANNED.finditer(str(text or "")):
            add("banned-word", f"{where}: '{m.group(0)}'")

    for c in concepts:
        voice(c.get("explanation"), "concept:" + c["id"])
    for p in pages:
        voice(p.get("body"), "page:" + p.get("id", "?"))
    for i in items:
        voice(i.get("walkthrough"), "item:" + i["id"])
        voice(i.get("takeaway"), "item:" + i["id"])
    for e in edges:
        voice(e.get("explanation"), "edge:" + e.get("id", "?"))
    for t in themes:
        voice(t.get("summary"), "theme:" + t["id"])
    if insights:
        voice(insights.get("intro"), "insights:root")
        for ch in insights.get("chapters", []):
            voice(ch.get("body"), "insights:" + ch.get("id", "?"))
        for nid, n in insights.get("nodes", {}).items():
            for ch in n.get("chapters", []):
                voice(ch.get("body"), "insights:" + nid + ":" + ch.get("id", "?"))
    if narrative:
        for ch in narrative.get("chapters", []):
            voice(ch.get("body"), "narrative:" + ch.get("id", "?"))
        for nid, n in narrative.get("nodes", {}).items():
            for ch in n.get("chapters", []):
                voice(ch.get("body"), "narrative:" + nid + ":" + ch.get("id", "?"))

    nnodes = len((narrative or {}).get("nodes", {}))
    ndepth = max([n.get("depth", 0) for n in (narrative or {}).get("nodes", {}).values()] or [0])
    print(f"data: {len(concepts)} concepts, {len(items)} items, {len(edges)} edges, "
          f"{len(themes)} themes, {len(pages)} pages, "
          f"narrative={'yes' if narrative else 'no'} ({nnodes} sub-narratives, depth {ndepth})"
          + (f", insights=yes ({len(insights.get('nodes', {}))} sub-narratives)" if insights else ""))
    print(f"routable ids: {len(known)} (incl. {len(register) - 1} cited papers)")
    if not problems:
        print("\nQUALITY GATE: clean")
        return 0
    print()
    for kind in sorted(problems):
        rows = problems[kind]
        print(f"{kind}: {len(rows)}")
        for r in rows[:12]:
            print("   " + r)
        if len(rows) > 12:
            print(f"   ... and {len(rows) - 12} more")
    return 1


if __name__ == "__main__":
    sys.exit(main())
