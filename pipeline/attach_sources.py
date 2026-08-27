"""Attach 'where this came from in the PDF' to every surface the viewer renders.

Concepts and items know their own sections/pages. Themes, generated pages and
narrative chapters inherit theirs from whatever they link to.
"""
import json
import os
import re

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")
WIKI = re.compile(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]")

SEC = json.load(open(os.path.join(D, "ingest", "section-pages.json"), encoding="utf-8"))
ORDER = {sid: i for i, sid in enumerate(SEC)}
register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]


def rd(name):
    p = os.path.join(D, name + ".json")
    raw = json.load(open(p, encoding="utf-8"))
    return raw, (raw[name] if isinstance(raw, dict) and name in raw else raw)


def wr(name, raw):
    json.dump(raw, open(os.path.join(D, name + ".json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)


def sources_from(section_ids, pages=()):
    """Where a surface came from: its sections, and where those sit.

    A paper published as a web page has no pages to sit on, so the section
    carries the anchor of its own heading in the frozen copy instead. Both
    forms are the same shape - a list of sections, each with somewhere to go -
    and the viewer reads whichever one is filled in.
    """
    secs, pgs = [], set(pages)
    for sid in sorted(set(section_ids), key=lambda s: ORDER.get(s, 999)):
        s = SEC.get(sid)
        if not s:
            continue
        sec = {"id": sid, "title": s["title"], "start": s["start"], "end": s["end"]}
        if s.get("anchor"):
            sec["anchor"] = s["anchor"]
        secs.append(sec)
        if s["start"]:
            pgs.update(range(s["start"], s["end"] + 1))
    if not secs and not pgs:
        return None
    return {"sections": secs, "pages": sorted(pgs)}


concepts_raw, concepts = rd("concepts")
items_raw, items = rd("items")
themes_raw, themes = rd("themes")
pages_raw, pages = rd("pages")
edges_raw, edges = rd("edges")
nar = json.load(open(os.path.join(D, "narrative.json"), encoding="utf-8"))

C = {c["id"]: c for c in concepts}
I = {i["id"]: i for i in items}
cited_owner = {}
for pid in register:
    if pid == MAIN:
        continue
    p = os.path.join(ROOT, "papers", pid, "data", "concepts.json")
    if os.path.exists(p):
        for c in json.load(open(p, encoding="utf-8"))["concepts"]:
            cited_owner[c["id"]] = pid

# ---- concepts ----
n = 0
for c in concepts:
    src = sources_from(c.get("sectionIds", []))
    if src:
        c["sources"] = src
        n += 1
print(f"concepts with sources: {n}/{len(concepts)}")

# ---- cited-paper concepts: point at their own paper, using the reader's sourceNote ----
for pid in register:
    if pid == MAIN:
        continue
    p = os.path.join(ROOT, "papers", pid, "data", "concepts.json")
    if not os.path.exists(p):
        continue
    raw = json.load(open(p, encoding="utf-8"))
    for c in raw["concepts"]:
        c["sources"] = {"paperId": pid, "note": c.get("sourceNote", ""), "sections": [], "pages": []}
    json.dump(raw, open(p, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print(f"cited-paper concepts pointed at their own PDFs: {len(cited_owner)}")

# ---- items ----
for it in items:
    if it.get("page"):
        it["sources"] = {"sections": [], "pages": [it["page"]]}
    elif it.get("section"):
        it["sources"] = sources_from([it["section"]])
    # A figure on a web page has an anchor of its own, which is a better place
    # to land than the top of the section it happens to sit in.
    if it.get("anchor") and it.get("sources"):
        it["sources"]["anchor"] = it["anchor"]
print(f"items with sources: {sum(1 for i in items if i.get('sources'))}/{len(items)}")


def derive(text):
    """Sections/pages implied by whatever a piece of prose links to."""
    secs, pgs = [], set()
    for m in WIKI.finditer(text or ""):
        rid = m.group(1).strip()
        if rid in C:
            secs += C[rid].get("sectionIds", [])
        elif rid in I and I[rid].get("page"):
            pgs.add(I[rid]["page"])
    return secs, pgs


# ---- themes: from their members ----
for t in themes:
    secs, pgs = [], set()
    for m in t.get("members", []):
        if m in C:
            secs += C[m].get("sectionIds", [])
        else:
            e = next((x for x in edges if x["id"] == m), None)
            if e:
                for end in (e["source"], e["target"]):
                    if end in C:
                        secs += C[end].get("sectionIds", [])
                    elif end in I and I[end].get("page"):
                        pgs.add(I[end]["page"])
    src = sources_from(secs, pgs)
    if src:
        t["sources"] = src
print(f"themes with sources: {sum(1 for t in themes if t.get('sources'))}/{len(themes)}")

# ---- generated pages: inherit from what the page is for, widened by its links ----
for pg in pages:
    fid = pg["forId"]
    secs, pgs = derive(pg["body"])
    if fid in C:
        secs += C[fid].get("sectionIds", [])
    t = next((x for x in themes if x["id"] == fid), None)
    if t and t.get("sources"):
        secs += [s["id"] for s in t["sources"]["sections"]]
        pgs.update(t["sources"]["pages"])
    src = sources_from(secs, pgs)
    if src:
        pg["sources"] = src
print(f"pages with sources: {sum(1 for p in pages if p.get('sources'))}/{len(pages)}")

# ---- narrative: per chapter, then unioned up to the node ----
def do_node(node):
    all_secs, all_pgs = [], set()
    for ch in node["chapters"]:
        secs, pgs = derive(ch["body"])
        src = sources_from(secs, pgs)
        if src:
            ch["sources"] = src
        all_secs += secs
        all_pgs.update(pgs)
    src = sources_from(all_secs, all_pgs)
    if src:
        node["sources"] = src


do_node(nar)
for node in nar["nodes"].values():
    do_node(node)
covered = sum(1 for n2 in nar["nodes"].values() if n2.get("sources"))
print(f"narrative nodes with sources: {covered}/{len(nar['nodes'])} (+ root)")

ins_path = os.path.join(D, "insights.json")
ins = None
if os.path.exists(ins_path):
    ins = json.load(open(ins_path, encoding="utf-8"))
    # an insights chapter also inherits from the edges it draws on
    def do_insight(node):
        all_secs, all_pgs = [], set()
        for ch in node["chapters"]:
            secs, pgs = derive(ch["body"])
            for eid in ch.get("edgeIds", []):
                e = next((x for x in edges if x["id"] == eid), None)
                if not e:
                    continue
                for end in (e["source"], e["target"]):
                    if end in C:
                        secs += C[end].get("sectionIds", [])
                    elif end in I and I[end].get("page"):
                        pgs.add(I[end]["page"])
            src = sources_from(secs, pgs)
            if src:
                ch["sources"] = src
            all_secs += secs
            all_pgs.update(pgs)
        src = sources_from(all_secs, all_pgs)
        if src:
            node["sources"] = src
    do_insight(ins)
    for node in ins["nodes"].values():
        do_insight(node)
    print(f"insights nodes with sources: {len(ins['nodes'])}/{len(ins['nodes'])} (+ root)")

wr("concepts", concepts_raw)
wr("items", items_raw)
wr("themes", themes_raw)
wr("pages", pages_raw)
json.dump(nar, open(os.path.join(D, "narrative.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
if ins is not None:
    json.dump(ins, open(ins_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("written")
