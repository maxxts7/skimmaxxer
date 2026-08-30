"""Apply the re-paced prose, and verify nothing was lost doing it.

A re-pace must preserve every wiki-link id and every number. This script
applies the new text and reports anything that went missing.

usage: python pipeline/save_repace.py <nar.output> <pages.output> <rest.output>
       python pipeline/save_repace.py --dir <dir-of-per-unit-json>

The three-file form is the original: one agent per third of the corpus, each
returning every unit it touched. That shape does not survive a real re-pace -
a hundred and fifty units of prose will not fit in three replies, and the
agent that tries loses the connection partway. --dir is the form to use: each
re-pacing agent writes its own unit and this reads them back off disk.

Filenames match the briefs repace_prep.py wrote, with a .json extension:
  nar-<nodeId>.json   {"nodeId", "intro"?, "chapters": [{"id", "body"}]}
  page-<forId>.json   {"forId", "body"}
  item-<itemId>.json  {"id", "takeaway", "walkthrough"}
  concepts-NN.json    {"concepts": [{"id", "explanation"}]}
  edges-NN.json       {"edges": [{"id", "explanation"}]}
"""
import json
import os
import re
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")
WIKI = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")
NUM = re.compile(r"(?<![\w.])\d[\d,]*(?:\.\d+)?(?![\w])")

lost_links, lost_nums, grew = [], [], []


def ids(t):
    return {m.group(1).strip() for m in WIKI.finditer(t or "")}


def nums(t):
    return {m.group(0).replace(",", "") for m in NUM.finditer(t or "")}


def check(where, before, after):
    gone = ids(before) - ids(after)
    if gone:
        lost_links.append((where, sorted(gone)))
    gn = nums(before) - nums(after)
    if gn:
        lost_nums.append((where, sorted(gn)[:8]))
    grew.append((len((before or "").split()), len((after or "").split())))


def result(path):
    return json.load(open(path, encoding="utf-8"))["result"]


def from_dir(d):
    """The per-unit files, folded into the three blobs the apply code wants."""
    nar = {"nodes": []}
    ins = {"nodes": []}
    summ = None
    pages = {"pages": []}
    rest = {"items": [], "concepts": [], "edges": []}
    if not os.path.isdir(d):
        raise SystemExit("no such directory: " + d)
    seen = 0
    for f in sorted(os.listdir(d)):
        if not f.endswith(".json"):
            continue
        raw = json.load(open(os.path.join(d, f), encoding="utf-8"))
        stem = f[:-5]
        seen += 1
        if stem.startswith("nar-"):
            raw.setdefault("nodeId", stem[4:])
            nar["nodes"].append(raw)
        elif stem.startswith("ins-"):
            raw.setdefault("nodeId", stem[4:])
            ins["nodes"].append(raw)
        elif stem == "summary":
            summ = raw
        elif stem.startswith("page-"):
            raw.setdefault("forId", stem[5:])
            pages["pages"].append(raw)
        elif stem.startswith("item-"):
            raw.setdefault("id", stem[5:])
            rest["items"].append(raw)
        elif stem.startswith("concepts-"):
            rest["concepts"] += raw.get("concepts", [])
        elif stem.startswith("edges-"):
            rest["edges"] += raw.get("edges", [])
        else:
            print("ignored (unrecognised name): " + f)
            seen -= 1
    if not seen:
        raise SystemExit("no re-paced units in " + d)
    print("read %d unit files: %d narrative, %d insights, %d summary, %d pages, "
          "%d items, %d concepts, %d edges"
          % (seen, len(nar["nodes"]), len(ins["nodes"]), 1 if summ else 0,
             len(pages["pages"]), len(rest["items"]), len(rest["concepts"]),
             len(rest["edges"])))
    return nar, pages, rest, ins, summ


if sys.argv[1:2] == ["--dir"]:
    nar_out, pages_out, rest_out, ins_out, sum_out = from_dir(sys.argv[2])
else:
    nar_out, pages_out, rest_out = (result(p) for p in sys.argv[1:4])
    ins_out, sum_out = None, None

# ---- narrative ----
nar = json.load(open(os.path.join(D, "narrative.json"), encoding="utf-8"))
by_id = {n["nodeId"]: n for n in nar_out["nodes"]}
applied_ch = 0


def apply_node(node, key):
    global applied_ch
    got = by_id.get(key)
    if not got:
        return
    if got.get("intro"):
        check(key + ":intro", node.get("intro"), got["intro"])
        node["intro"] = got["intro"]
    new = {c["id"]: c["body"] for c in got["chapters"]}
    for ch in node["chapters"]:
        if ch["id"] in new:
            check(key + ":" + ch["id"], ch["body"], new[ch["id"]])
            ch["body"] = new[ch["id"]]
            applied_ch += 1


apply_node(nar, "root")
for nid, node in nar["nodes"].items():
    apply_node(node, nid)
json.dump(nar, open(os.path.join(D, "narrative.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"narrative: {len(by_id)} nodes, {applied_ch} chapters re-paced")

# ---- pages ----
praw = json.load(open(os.path.join(D, "pages.json"), encoding="utf-8"))
newp = {p["forId"]: p["body"] for p in pages_out["pages"]}
n = 0
for pg in praw["pages"]:
    if pg["forId"] in newp:
        check("page:" + pg["forId"], pg["body"], newp[pg["forId"]])
        pg["body"] = newp[pg["forId"]]
        n += 1
json.dump(praw, open(os.path.join(D, "pages.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"pages: {n}/{len(praw['pages'])} re-paced")

# ---- items ----
iraw = json.load(open(os.path.join(D, "items.json"), encoding="utf-8"))
newi = {i["id"]: i for i in rest_out["items"]}
n = 0
for it in iraw["items"]:
    g = newi.get(it["id"])
    if g:
        check("item:" + it["id"], it.get("walkthrough"), g["walkthrough"])
        it["walkthrough"] = g["walkthrough"]
        it["takeaway"] = g["takeaway"]
        n += 1
json.dump(iraw, open(os.path.join(D, "items.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"items: {n}/{len(iraw['items'])} re-paced")

# ---- concepts (main + cited) ----
newc = {c["id"]: c["explanation"] for c in rest_out["concepts"]}
register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
total = 0
for pid in register:
    p = os.path.join(ROOT, "papers", pid, "data", "concepts.json")
    if not os.path.exists(p):
        continue
    raw = json.load(open(p, encoding="utf-8"))
    n = 0
    for c in raw["concepts"]:
        if c["id"] in newc:
            check("concept:" + c["id"], c["explanation"], newc[c["id"]])
            c["explanation"] = newc[c["id"]]
            n += 1
    # Only rewrite a file this pass actually changed. The loop walks every
    # paper in the register to find the cited ones whose concepts are being
    # re-paced, and re-serialising the rest would rewrite a dozen untouched
    # files purely to change how their non-ASCII escapes are spelled.
    if n:
        json.dump(raw, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    total += n
print(f"concepts: {total}/{len(newc)} re-paced across {len(register)} papers")

# ---- edges ----
eraw = json.load(open(os.path.join(D, "edges.json"), encoding="utf-8"))
newe = {e["id"]: e["explanation"] for e in rest_out["edges"]}
n = 0
for e in eraw["edges"]:
    if e["id"] in newe:
        check("edge:" + e["id"], e["explanation"], newe[e["id"]])
        e["explanation"] = newe[e["id"]]
        n += 1
json.dump(eraw, open(os.path.join(D, "edges.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"edges: {n}/{len(eraw['edges'])} re-paced")

# ---- insights: the same tree shape as the narrative ----
ipath = os.path.join(D, "insights.json")
if ins_out and ins_out["nodes"] and os.path.exists(ipath):
    ins = json.load(open(ipath, encoding="utf-8"))
    by_id = {n["nodeId"]: n for n in ins_out["nodes"]}
    applied_ch = 0
    apply_node(ins, "root")
    for nid, node in ins.get("nodes", {}).items():
        apply_node(node, nid)
    json.dump(ins, open(ipath, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"insights: {len(by_id)} nodes, {applied_ch} chapters re-paced")

# ---- summary: flat, so beats rather than chapters ----
spath = os.path.join(D, "summary.json")
if sum_out and os.path.exists(spath):
    sm = json.load(open(spath, encoding="utf-8"))
    if sum_out.get("lede"):
        check("summary:lede", sm.get("lede"), sum_out["lede"])
        sm["lede"] = sum_out["lede"]
    newb = {b["id"]: b["body"] for b in sum_out.get("beats", [])}
    n = 0
    for b in sm["beats"]:
        if b["id"] in newb:
            check("summary:" + b["id"], b["body"], newb[b["id"]])
            b["body"] = newb[b["id"]]
            n += 1
    json.dump(sm, open(spath, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(f"summary: {n}/{len(sm['beats'])} beats re-paced")

# ---- report ----
b = sum(x for x, _ in grew)
a = sum(y for _, y in grew)
print(f"\nwords: {b:,} -> {a:,}  ({(a / b - 1) * 100:+.0f}%)")
print(f"dropped links: {len(lost_links)} texts")
for w, g in lost_links[:20]:
    print(f"   {w}: {', '.join(g)}")
print(f"dropped numbers: {len(lost_nums)} texts")
for w, g in lost_nums[:20]:
    print(f"   {w}: {', '.join(g)}")
