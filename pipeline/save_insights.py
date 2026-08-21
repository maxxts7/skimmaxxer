"""Save the Insights narrative and report edge coverage.

usage: python pipeline/save_insights.py <task-output.json>
"""
import json, os, re, sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")
WIKI = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")

res = json.load(open(sys.argv[1], encoding="utf-8"))["result"]
root, kids = res["root"], res["nodes"]

nodes = {}
for k in kids:
    nodes[k["nodeId"]] = {
        "id": k["nodeId"], "parentId": "insights-root",
        "parentChapterId": k["nodeId"][2:], "depth": 1,
        "title": k["title"], "intro": k.get("intro", ""),
        "chapters": [{"id": c["id"], "title": c["title"], "body": c["body"],
                      "edgeIds": c.get("edgeIds", []), "childId": None} for c in k["chapters"]],
    }

chapters = []
for i, c in enumerate(root["chapters"]):
    cid = "i-" + c["id"]
    chapters.append({"id": c["id"], "title": c["title"], "body": c["body"],
                     "edgeIds": c.get("edgeIds", []), "number": str(i + 1),
                     "childId": cid if cid in nodes else None})
for ch in chapters:
    if ch["childId"]:
        n = nodes[ch["childId"]]
        n["number"] = ch["number"]
        for j, c in enumerate(n["chapters"]):
            c["number"] = f"{ch['number']}.{j + 1}"

ins = {"title": root["title"], "intro": root["intro"],
       "chapters": chapters, "nodes": nodes,
       "unusedNote": root.get("unusedNote", "")}
json.dump(ins, open(os.path.join(D, "insights.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# ---- coverage ----
edges = json.load(open(os.path.join(D, "edges.json"), encoding="utf-8"))["edges"]
E = {e["id"]: e for e in edges}
used = set()
for ch in chapters:
    used |= set(ch["edgeIds"])
for n in nodes.values():
    for c in n["chapters"]:
        used |= set(c["edgeIds"])
bogus = sorted(used - set(E))
missing = sorted(set(E) - used)
lb = [e for e in edges if e["strength"] == "known" or e["strength"] == "load-bearing"]
lb_missing = [e["id"] for e in lb if e["id"] not in used]

words = sum(len(c["body"].split()) for c in chapters)
words += sum(len(c["body"].split()) for n in nodes.values() for c in n["chapters"])
links = sum(len(WIKI.findall(c["body"])) for c in chapters)
links += sum(len(WIKI.findall(c["body"])) for n in nodes.values() for c in n["chapters"])

print(f'insights.json: "{ins["title"]}"')
print(f"  {len(chapters)} root chapters, {len(nodes)} sub-narratives, "
      f"{sum(len(n['chapters']) for n in nodes.values())} sub-chapters")
print(f"  ~{words} words, {links} wiki-links")
print(f"  edges used: {len(used)}/{len(edges)}")
print(f"  load-bearing covered: {len(lb) - len(lb_missing)}/{len(lb)}")
if bogus:
    print(f"  INVALID edge ids referenced: {', '.join(bogus)}")
if missing:
    print(f"  unused edges ({len(missing)}): {', '.join(missing)}")
print()
for ch in chapters:
    mark = " ->" if ch["childId"] else "   "
    print(f"  {ch['number']}.{mark} {ch['title'][:78]}  [{len(ch['edgeIds'])} edges]")
    if ch["childId"]:
        for c in nodes[ch["childId"]]["chapters"]:
            print(f"      {c['number']} {c['title'][:70]}")
