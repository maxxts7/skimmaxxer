"""Brief for the relations page - the one surface where papers meet.

Every other stage is written as if its paper were the only one in the project.
This is the exception, and it is deliberately a single page: connections are
somewhere a reader chooses to go, not something scattered through the prose.

So this brief is the only one that is allowed to name other papers' concept
ids, because the page it feeds is the only one allowed to link to them.

usage: python pipeline/relations_brief.py
"""
import json
import os

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


def flat(s, n=200):
    return " ".join(str(s or "").split())[:n]


def main():
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    me = register[MAIN]
    mine = load(MAIN, "concepts", [])

    L = [f"RELATIONS BRIEF FOR: {me['title']} ({MAIN})", ""]

    L += ["=== WHAT THIS PAPER IS, IN ITS OWN TERMS ===",
          "Its major concepts, which are what a comparison should be drawn against:"]
    for c in [x for x in mine if x["tier"] == "major"]:
        L.append(f"  {c['id']} | {c['name']}: {flat(c['summary'], 190)}")

    L += ["", "Concepts it marks as borrowed - each names a citation this paper makes:"]
    for c in mine:
        cf = c.get("citedFrom") or {}
        if cf:
            L.append(f"  {c['id']} | {c['name']} <- {cf.get('citationKey', '?')} "
                     f"{flat(cf.get('refText'), 90)}")
            if cf.get("whyNeeded"):
                L.append(f"      needed for: {flat(cf['whyNeeded'], 190)}")

    rp = os.path.join(ROOT, "papers", MAIN, "refs.json")
    accessed = json.load(open(rp, encoding="utf-8")).get("accessed", []) if os.path.exists(rp) else []
    if accessed:
        L += ["", "=== WHAT WAS READ WHILE BUILDING THIS EXPLAINER ==="]
        for a in accessed:
            L.append(f"  {a.get('paperId')} ({a.get('citationKey', '?')}): {flat(a.get('whyNeeded'), 240)}")

    L += ["", "=== THE OTHER PAPERS IN THIS PROJECT ===",
          "These are the only ids outside this paper you may link to."]
    for pid, meta in register.items():
        if pid == MAIN:
            continue
        cs = load(pid, "concepts", [])
        if not cs:
            continue
        L.append(f"\n--- {pid} | {meta['title']} | {meta.get('authors', '')} "
                 f"[{meta.get('status')} read] ---")
        if meta.get("skipped"):
            L.append(f"    read scope: {flat(meta['skipped'], 300)}")
        for c in cs:
            L.append(f"    {c['id']} | {c['name']}: {flat(c['summary'], 170)}")

    out = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "relations-brief.txt")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print(f"relations-brief.txt: {len(L)} lines, "
          f"{sum(1 for p in register if p != MAIN)} other papers")


if __name__ == "__main__":
    main()
