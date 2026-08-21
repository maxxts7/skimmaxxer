"""Everything the Insights narrative is built from: all edges, in context."""
import json, os

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")

def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p): return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw

register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
concepts = load(MAIN, "concepts", [])
items = load(MAIN, "items", [])
edges = load(MAIN, "edges", [])
themes = load(MAIN, "themes", [])
C = {c["id"]: c for c in concepts}
I = {i["id"]: i for i in items}
cited = {}
for pid in register:
    if pid != MAIN:
        for c in load(pid, "concepts", []):
            cited[c["id"]] = (c, register[pid]["title"])

def nm(x):
    if x in C: return C[x]["name"]
    if x in I: return I[x]["title"]
    if x in cited: return cited[x][0]["name"] + " [from " + cited[x][1] + "]"
    return x

def flat(s, n=400):
    return " ".join(str(s or "").split())[:n]

L = ["EVERY RELATIONSHIP THE PIPELINE FOUND IN 'ATTENTION IS ALL YOU NEED'", ""]
L += [f"{len(edges)} edges, found by four agents each looking through a different lens.", ""]

L += ["=== THE EDGE-THEMES (how a previous stage grouped them) ==="]
for t in [x for x in themes if x["kind"] == "edge-theme"]:
    L.append(f"\n[{t['id']}] {t['name']}  ({len(t['members'])} edges)")
    L.append(f"    {flat(t['summary'], 500)}")
    L.append(f"    members: {', '.join(t['members'])}")

for ty, head in [("depends-on", "DEPENDS-ON  (understanding or building X requires Y first)"),
                 ("supported-by", "SUPPORTED-BY  (a claim and the evidence under it)"),
                 ("instance-of", "INSTANCE-OF  (a specific case or setting of a general thing)"),
                 ("contrasts-with", "CONTRASTS-WITH  (alternatives, tensions, trade-offs)")]:
    group = [e for e in edges if e["type"] == ty]
    L += ["", f"=== {head} - {len(group)} edges ==="]
    for e in group:
        L.append(f"\n{e['id']} [{e['strength']}] {e['source']} ({nm(e['source'])})  -->  {e['target']} ({nm(e['target'])})")
        L.append(f"    label: {e['label']}")
        L.append(f"    {flat(e['explanation'], 500)}")

L += ["", "=== EVIDENCE ITEMS (linkable as [[fig-1]] etc.) ==="]
for i in items:
    L.append(f"  {i['id']} | {i['title']}: {flat(i.get('takeaway'), 160)}")

L += ["", "=== THE MAIN NARRATIVE'S CHAPTERS (do not retell these; Insights is the other read) ==="]
nar = json.load(open(os.path.join(D, "narrative.json"), encoding="utf-8"))
for i, ch in enumerate(nar["chapters"]):
    L.append(f"  {i+1}. {ch['title']}")

out = os.path.join(D, "ingest", "insights-brief.txt")
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"insights-brief.txt: {os.path.getsize(out)} bytes, {len(edges)} edges")
