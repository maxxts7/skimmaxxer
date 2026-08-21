"""Apply the re-paced prose, and verify nothing was lost doing it.

A re-pace must preserve every wiki-link id and every number. This script
applies the new text and reports anything that went missing.

usage: python pipeline/save_repace.py <nar.output> <pages.output> <rest.output>
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


nar_out, pages_out, rest_out = (result(p) for p in sys.argv[1:4])

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
