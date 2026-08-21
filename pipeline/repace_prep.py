"""Dump every prose unit to its own file so a re-pacing agent reads only its own text."""
import json, os, shutil

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
manifest = {"narrative": [], "pages": [], "items": [], "conceptBatches": [], "edgeBatches": []}

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
cs = [c for c in load(MAIN, "concepts", []) if not c.get("floor")]
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
print(f"pages           : {len(manifest['pages'])}")
print(f"items           : {len(manifest['items'])}")
print(f"concept batches : {len(manifest['conceptBatches'])} ({len(cs)} concepts)")
print(f"edge batches    : {len(manifest['edgeBatches'])} ({len(es)} edges)")
print(f"TOTAL AGENTS    : {len(manifest['narrative']) + len(manifest['pages']) + len(manifest['items']) + len(manifest['conceptBatches']) + len(manifest['edgeBatches'])}")
