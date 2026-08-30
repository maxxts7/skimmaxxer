"""Dump every prose unit to its own file so a re-pacing agent reads only its own text.

usage: python pipeline/repace_prep.py [--own]

  --own restricts the concept batches to this paper's own concepts. Without
  it, every cited paper's concepts are included too, because a cross-paper
  link renders their explanation in place and a seam would show there. That is
  the right default when the whole project is being re-registered, and the
  wrong one when a single paper is: re-pacing a cited paper's concepts leaves
  that paper internally inconsistent, its concepts in one register and its own
  pages in another.
"""
import json, os, shutil, sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
OUT = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "repace")

def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p): return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw

def w(name, lines):
    open(os.path.join(OUT, name + ".txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
manifest = {"narrative": [], "insights": [], "summary": False, "pages": [],
            "items": [], "conceptBatches": [], "edgeBatches": []}

# ---- narrative: root + every node ----
nar = json.load(open(os.path.join(ROOT, "papers", MAIN, "data", "narrative.json"), encoding="utf-8"))
units = [("root", {"title": nar["title"], "intro": nar.get("intro", ""), "chapters": nar["chapters"]})]
units += [(nid, n) for nid, n in nar["nodes"].items()]
for nid, n in units:
    L = [f"NARRATIVE NODE: {nid}", f"TITLE: {n['title']}", ""]
    if n.get("intro"):
        L += ["INTRO:", n["intro"], ""]
    for ch in n["chapters"]:
        L += [f"--- CHAPTER id={ch['id']} ---", f"TITLE: {ch['title']}", "", ch["body"], ""]
    w("nar-" + nid, L)
    manifest["narrative"].append(nid)

# ---- insights: the same shape as the narrative, so the same treatment ----
ip = os.path.join(ROOT, "papers", MAIN, "data", "insights.json")
if os.path.exists(ip):
    ins = json.load(open(ip, encoding="utf-8"))
    iunits = [("root", ins)] + list(ins.get("nodes", {}).items())
    for nid, n in iunits:
        L = [f"INSIGHTS NODE: {nid}", f"TITLE: {n['title']}", ""]
        if n.get("intro"):
            L += ["INTRO:", n["intro"], ""]
        for ch in n["chapters"]:
            L += [f"--- CHAPTER id={ch['id']} ---", f"TITLE: {ch['title']}", "", ch["body"], ""]
        w("ins-" + nid, L)
        manifest["insights"].append(nid)

# ---- summary: flat, one unit, no children ----
sp = os.path.join(ROOT, "papers", MAIN, "data", "summary.json")
if os.path.exists(sp):
    sm = json.load(open(sp, encoding="utf-8"))
    L = [f"SUMMARY: {sm['title']}", "", "LEDE:", sm["lede"], ""]
    for b in sm["beats"]:
        L += [f"--- BEAT id={b['id']} ---", f"HEADING: {b['heading']}", "", b["body"], ""]
    w("summary", L)
    manifest["summary"] = True

# ---- pages ----
for pg in load(MAIN, "pages", []):
    w("page-" + pg["forId"], [f"PAGE FOR: {pg['forId']} ({pg['kind']})", "", pg["body"]])
    manifest["pages"].append(pg["forId"])

# ---- figure/table/equation walkthroughs ----
for it in load(MAIN, "items", []):
    w("item-" + it["id"], [f"ITEM: {it['id']} ({it['kind']}) - {it['title']}", "",
                           "TAKEAWAY:", it.get("takeaway", ""), "", "WALKTHROUGH:", it.get("walkthrough", "")])
    manifest["items"].append(it["id"])

# ---- concept explanations (floor stubs stay short by design) ----
OWN_ONLY = "--own" in sys.argv
cs = [c for c in load(MAIN, "concepts", []) if not c.get("floor")]
if not OWN_ONLY:
    for pid in register:
        if pid != MAIN:
            for c in load(pid, "concepts", []):
                c = dict(c); c["_owner"] = pid
                cs.append(c)
for i in range(0, len(cs), 12):
    batch = cs[i:i + 12]
    name = f"concepts-{i // 12 + 1:02d}"
    L = [f"CONCEPT EXPLANATIONS ({len(batch)})", ""]
    for c in batch:
        L += [f"--- CONCEPT id={c['id']} ---", f"NAME: {c['name']}",
              f"OWNER: {c.get('_owner', MAIN)}", f"SUMMARY (leave alone): {c['summary']}", "",
              "EXPLANATION:", c["explanation"], ""]
    w(name, L)
    manifest["conceptBatches"].append({"name": name, "ids": [c["id"] for c in batch]})

# ---- edge explanations ----
es = load(MAIN, "edges", [])
for i in range(0, len(es), 20):
    batch = es[i:i + 20]
    name = f"edges-{i // 20 + 1:02d}"
    L = [f"EDGE EXPLANATIONS ({len(batch)})", ""]
    for e in batch:
        L += [f"--- EDGE id={e['id']} ---",
              f"{e['source']} --{e['type']}--> {e['target']} | label: {e['label']}", "",
              e["explanation"], ""]
    w(name, L)
    manifest["edgeBatches"].append({"name": name, "ids": [e["id"] for e in batch]})

json.dump(manifest, open(os.path.join(ROOT, "pipeline", "repace-manifest.json"), "w", encoding="utf-8"), indent=1)
print(f"narrative units : {len(manifest['narrative'])}")
print(f"insights units  : {len(manifest['insights'])}")
print(f"summary         : {'1' if manifest['summary'] else '0 (not written yet)'}")
print(f"pages           : {len(manifest['pages'])}")
print(f"items           : {len(manifest['items'])}")
print(f"concept batches : {len(manifest['conceptBatches'])} ({len(cs)} concepts"
      f"{', this paper only' if OWN_ONLY else ', including cited papers'})")
print(f"edge batches    : {len(manifest['edgeBatches'])} ({len(es)} edges)")
print(f"TOTAL AGENTS    : {len(manifest['narrative']) + len(manifest['insights']) + (1 if manifest['summary'] else 0) + len(manifest['pages']) + len(manifest['items']) + len(manifest['conceptBatches']) + len(manifest['edgeBatches'])}")
