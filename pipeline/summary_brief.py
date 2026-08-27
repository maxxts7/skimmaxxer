"""Brief for the stage-6f Summary agent.

The Summary carries the paper's whole argument end to end, in one sitting.
It sits at the same floor as everything else - it names a neuron a neuron and
an MLP an MLP - and what makes it a summary is shape rather than level: one
flat page, the line of reasoning only, no figures, no run names, none of the
evidence apparatus the story carries.

It still explains a term where the argument leans on it. What it must not do
is paraphrase the vocabulary away; a reader who cannot be told "ReLU" cannot
be told what the paper found either.

So the brief leads with the story's own chapters, because covering the same
span is the thing to get right, and lists the floor concepts only so the
writer knows which terms come for free.
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
L += ["One flat page carrying the whole argument, read top to bottom, in one",
      "sitting. Same floor as every other surface: use the real names. Gloss a",
      "term in a clause where the argument leans on it, then keep going - never",
      "paraphrase the vocabulary away to avoid explaining it.",
      "What makes this a summary is shape, not level: the line of reasoning",
      "only, no figures, no run names, no evidence apparatus.", ""]

# The floor is what every other surface assumes. Here it is the syllabus.
floor = [c for c in concepts if c.get("floor")]
L += ["=== COVERED BY THE FLOOR: THESE COME FOR FREE ==="]
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
      "  Eight to twelve beats. Each is a step in one argument, not a topic.",
      "  Headings are sentences a reader could follow on their own.",
      "  Link with [[concept-id]], first mention only, using the ids above."]

out = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "summary-brief.txt")
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"summary-brief.txt: {len(L)} lines, {os.path.getsize(out)} bytes")
print(f"  floor concepts offered as free vocabulary: {len(floor)}")
print(f"  link targets offered: {len(concepts)} concepts, {len(items)} items")
