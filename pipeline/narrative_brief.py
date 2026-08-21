"""Compact whole-paper brief for the stage-6 narrative agent."""
import json, os, sys

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

register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
concepts = load(MAIN, "concepts", [])
items = load(MAIN, "items", [])
edges = load(MAIN, "edges", [])
themes = load(MAIN, "themes", [])
pages = {p["forId"]: p for p in load(MAIN, "pages", [])}
C = {c["id"]: c for c in concepts}
I = {i["id"]: i for i in items}
# Concepts from other papers are offered as link targets only with
# --include-cited. By default a paper's narrative is written as if it were the
# only one in the project; connections across papers belong on the relations
# page, written deliberately, not scattered through the front-door prose.
cited = {}
if "--include-cited" in sys.argv:
    for pid in register:
        if pid != MAIN:
            for c in load(pid, "concepts", []):
                cited[c["id"]] = (c, register[pid]["title"])

L = ["THE WHOLE PAPER, AS THE PIPELINE HAS IT", ""]
L += ["=== CONCEPT THEMES (the chapters the reader can drill into) ==="]
for t in [x for x in themes if x["kind"] == "concept-theme"]:
    L.append(f"\n[{t['order']}] {t['id']} | {t['name']}")
    L.append(f"    {flat(t['summary'], 400)}")
    L.append("    members: " + ", ".join(t["members"]))
    body = pages.get(t["id"], {}).get("body", "")
    if body:
        L.append(f"    its page opens: {flat(body, 240)}")

L += ["", "=== EDGE THEMES (arguments that cut across the chapters) ==="]
for t in [x for x in themes if x["kind"] == "edge-theme"]:
    L.append(f"\n[{t['order']}] {t['id']} | {t['name']}")
    L.append(f"    {flat(t['summary'], 400)}")

L += ["", "=== MAJOR CONCEPTS (each has a full page) ==="]
for c in [x for x in concepts if x["tier"] == "major"]:
    L.append(f"  {c['id']} | {c['name']}: {flat(c['summary'], 170)}")

L += ["", "=== EVIDENCE ITEMS (each has a full page) ==="]
for i in items:
    L.append(f"  {i['id']} | {i['title']}: {flat(i.get('takeaway'), 200)}")

if cited:
    L += ["", "=== CONCEPTS IMPORTED FROM CITED PAPERS ==="]
    for cid, (c, owner) in cited.items():
        L.append(f"  {cid} | {c['name']} [from {owner}]: {flat(c['summary'], 140)}")

L += ["", "=== LOAD-BEARING RELATIONSHIPS (the paper's own reasoning) ==="]
def nm(x):
    if x in C: return C[x]["name"]
    if x in I: return I[x]["title"]
    if x in cited: return cited[x][0]["name"]
    return x
for e in [x for x in edges if x["strength"] == "load-bearing"]:
    L.append(f"  {e['source']} ({nm(e['source'])}) --{e['type']}--> {e['target']} ({nm(e['target'])}): {flat(e['explanation'], 230)}")

out = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "narrative-brief.txt")
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"narrative-brief.txt: {len(L)} lines, {os.path.getsize(out)} bytes")
