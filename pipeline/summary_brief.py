"""Brief for the stage-6f Summary agent.

The Summary is the one surface written below the paper's floor. Every other
surface assumes the floor and explains upward from it; this one assumes no
machine learning and explains what it uses as it goes - without becoming
basic, and without dropping the technical detail that makes the argument
worth following.

So the brief leads with the concepts the rest of the site is allowed to
assume. Those are exactly the ones this surface may not, and they are marked
in the data already: a concept with floor=true is one the floor covers.
"""
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
meta = register.get(MAIN, {})
concepts = load(MAIN, "concepts", [])
items = load(MAIN, "items", [])
edges = load(MAIN, "edges", [])
themes = load(MAIN, "themes", [])
narrative = load(MAIN, "narrative", None)
C = {c["id"]: c for c in concepts}
I = {i["id"]: i for i in items}

L = [f"SUMMARY BRIEF - {meta.get('title', MAIN)}", ""]
L += ["This surface is read by someone who does not work in machine learning.",
      "Explain what you use, in passing, at the point of use. Do not simplify",
      "the argument to avoid explaining something - explain it and keep going.",
      "One flat page, read top to bottom. No chapters that open into more.", ""]

# The floor is what every other surface assumes. Here it is the syllabus.
floor = [c for c in concepts if c.get("floor")]
L += ["=== ASSUMED EVERYWHERE ELSE, SO EXPLAIN HERE IF YOU USE IT ==="]
if floor:
    for c in floor:
        L.append(f"  {c['id']} | {c['name']}: {flat(c.get('summary'), 190)}")
else:
    L.append("  (nothing marked floor=true; take the paper's own vocabulary as the line)")

L += ["", "=== THE SPINE: WHAT THE STORY COVERS, IN ITS ORDER ==="]
if narrative:
    L.append(f"  story title: {narrative.get('title', '')}")
    for i, ch in enumerate(narrative.get("chapters", []), 1):
        L.append(f"  {ch.get('number', i)}. {ch.get('title', '')}")
        L.append(f"       {flat(ch.get('body'), 220)}")
else:
    L.append("  (no narrative yet - fall back to the themes' reading order below)")

L += ["", "=== CONCEPT THEMES, IN READING ORDER ==="]
for t in sorted([x for x in themes if x["kind"] == "concept-theme"], key=lambda x: x.get("order", 0)):
    L.append(f"  [{t.get('order')}] {t['id']} | {t['name']}: {flat(t.get('summary'), 300)}")

L += ["", "=== MAJOR CONCEPTS (each has a page; link the first mention) ==="]
for c in [x for x in concepts if x.get("tier") == "major"]:
    L.append(f"  {c['id']} | {c['name']}: {flat(c.get('summary'), 170)}")

L += ["", "=== SUPPORTING CONCEPTS YOU MAY ALSO LINK ==="]
for c in [x for x in concepts if x.get("tier") != "major" and not x.get("floor")]:
    L.append(f"  {c['id']} | {c['name']}")

L += ["", "=== EVIDENCE ITEMS (link where a number comes from one) ==="]
for i in items:
    L.append(f"  {i['id']} | {i['title']}: {flat(i.get('takeaway'), 160)}")


def nm(x):
    if x in C: return C[x]["name"]
    if x in I: return I[x]["title"]
    return x


L += ["", "=== THE REASONING THE PAPER RESTS ON ==="]
for e in [x for x in edges if x.get("strength") == "load-bearing"]:
    L.append(f"  {nm(e['source'])} --{e['type']}--> {nm(e['target'])}: {flat(e.get('explanation'), 230)}")

L += ["", "=== SHAPE TO RETURN ===",
      '  {"title": ..., "lede": one paragraph, "beats": [{"id", "heading", "body"}, ...]}',
      "  Six to ten beats. Each is a step in one argument, not a topic.",
      "  Headings are sentences a reader could follow on their own.",
      "  Link with [[concept-id]], first mention only, using the ids above."]

out = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "summary-brief.txt")
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"summary-brief.txt: {len(L)} lines, {os.path.getsize(out)} bytes")
print(f"  floor concepts to explain in passing: {len(floor)}")
print(f"  link targets offered: {len(concepts)} concepts, {len(items)} items")
