"""Merge page-agent output into data/pages.json (accepts several task outputs).

usage: python pipeline/save_pages.py <task-output.json> [<task-output.json> ...]
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


def main(paths):
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    known = {c["id"] for c in load(MAIN, "concepts", [])}
    known |= {i["id"] for i in load(MAIN, "items", [])}
    known |= {t["id"] for t in load(MAIN, "themes", [])}
    for pid in register:
        if pid != MAIN:
            known |= {c["id"] for c in load(pid, "concepts", [])}

    pages, missing = {}, []
    for p in paths:
        res = json.load(open(p, encoding="utf-8"))["result"]
        for pg in res.get("pages", []):
            pages[pg["forId"]] = {"id": pg["id"], "forId": pg["forId"],
                                  "kind": pg.get("kind", "concept"), "body": pg["body"]}
        missing += res.get("missing", [])

    out = sorted(pages.values(), key=lambda p: (p["kind"], p["forId"]))
    json.dump({"pages": out},
              open(os.path.join(ROOT, "papers", MAIN, "data", "pages.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)

    total_links, broken = 0, []
    for pg in out:
        for m in WIKI.finditer(pg["body"]):
            total_links += 1
            if m.group(1).strip() not in known:
                broken.append((pg["forId"], m.group(1).strip()))
    words = sum(len(p["body"].split()) for p in out)
    by_kind = {}
    for p in out:
        by_kind[p["kind"]] = by_kind.get(p["kind"], 0) + 1
    print(f"pages.json: {len(out)} pages (" + ", ".join(f"{k}={v}" for k, v in sorted(by_kind.items())) + ")")
    print(f"  {words} words, {total_links} wiki-links, {len(broken)} broken")
    for pid_, bad in broken[:20]:
        print(f"   broken: {pid_} -> [[{bad}]]")
    if missing:
        print(f"  MISSING pages: {', '.join(missing)}")


if __name__ == "__main__":
    main(sys.argv[1:])
