"""Save the Summary and report what it costs a reader.

usage: python pipeline/save_summary.py <task-output.json>
       python pipeline/save_summary.py --check

The Summary is flat on purpose, so there is no tree to repair here and no
pointer that can dangle. What can go wrong instead is drift: it is the one
surface written below the floor, and the way it fails is by quietly climbing
back up to the floor and becoming a second, shorter story.

So this reports the two things that catch that - how much of it is unexplained
jargon the floor would have covered, and how long it runs. Neither is enforced.
Both are worth a look before the gate says clean.
"""
import json, os, re, sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")
WIKI = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")


def load(name, default):
    p = os.path.join(D, name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


src = sys.argv[1] if len(sys.argv) > 1 else "--check"
path = os.path.join(D, "summary.json")

if src == "--check":
    if not os.path.exists(path):
        raise SystemExit("no summary.json yet")
    doc = json.load(open(path, encoding="utf-8"))
else:
    res = json.load(open(src, encoding="utf-8"))
    res = res.get("result", res)
    doc = {"title": res["title"], "lede": res.get("lede", ""),
           "beats": [{"id": b["id"], "heading": b["heading"], "body": b["body"]}
                     for b in res["beats"]]}
    json.dump(doc, open(path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

concepts = load("concepts", [])
C = {c["id"]: c for c in concepts}
items = {i["id"]: i for i in load("items", [])}
floor_ids = {c["id"] for c in concepts if c.get("floor")}

beats = doc.get("beats", [])
text = " ".join([doc.get("lede", "")] + [b["body"] for b in beats])
words = len(text.split())
links = WIKI.findall(text)
bad = sorted({r.strip() for r in links if r.strip() not in C and r.strip() not in items})
# One link per concept per beat, not per page. A beat is the unit a reader
# takes in at once, and it is the unit autolink works on - so a concept
# linked again three beats later is a fresh first mention, not a repeat.
dupes = sorted({r for b in beats
                for r in set(WIKI.findall(b["body"]))
                if WIKI.findall(b["body"]).count(r) > 1})

# The floor concepts are the ones every other surface may assume. Naming one
# here is fine - linking to it instead of explaining it is the drift.
named_floor = sorted({r.strip() for r in links if r.strip() in floor_ids})

print(f'summary.json: "{doc.get("title", "")}"')
print(f"  {len(beats)} beats, ~{words} words (~{max(1, round(words / 220))} min read)")
print(f"  {len(links)} links, {len(set(links))} distinct")
for b in beats:
    n = len(b["body"].split())
    print(f"    {b['id'][:40]:<42} {n:>5}w  {b['heading'][:60]}")
if bad:
    print(f"  UNRESOLVED link ids ({len(bad)}): {', '.join(bad)}")
if dupes:
    print(f"  linked twice inside one beat ({len(dupes)}): {', '.join(dupes)}")
    print("    one link per concept per beat; the repeats are noise")
if named_floor:
    print(f"  floor concepts linked rather than explained ({len(named_floor)}): {', '.join(named_floor)}")
    print("    this surface is written below the floor - explain these in passing instead")
if not doc.get("lede"):
    print("  no lede: the page opens straight into its first beat")
