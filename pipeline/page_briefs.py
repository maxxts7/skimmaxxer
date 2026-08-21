"""Write one brief file per page the fan-out will generate.

Each brief holds exactly the material that page needs, so a page agent reads
one small file instead of the whole dataset.

Emits pipeline/page-targets.json listing {id, kind, forId, name, brief}.
"""
import json
import os

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
BRIEFS = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "briefs")
SECT = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "sections")


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


def main():
    os.makedirs(BRIEFS, exist_ok=True)
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    concepts = load(MAIN, "concepts", [])
    items = load(MAIN, "items", [])
    edges = load(MAIN, "edges", [])
    themes = load(MAIN, "themes", [])

    C = {c["id"]: c for c in concepts}
    cited = {}
    for pid in register:
        if pid != MAIN:
            for c in load(pid, "concepts", []):
                c = dict(c)
                c["_owner"] = register[pid]["title"]
                c["_ownerId"] = pid
                cited[c["id"]] = c
    ALL = {**cited, **C}
    I = {i["id"]: i for i in items}

    sect_files = sorted(os.listdir(SECT))

    def sect_for(ids):
        out = []
        for sid in ids:
            for f in sect_files:
                parts = f.split("-")
                if len(parts) > 1 and parts[1] == sid:
                    out.append(f)
        return out

    def nm(nid):
        if nid in ALL:
            return ALL[nid]["name"]
        if nid in I:
            return I[nid]["title"] + f" ({nid})"
        return nid

    def kids_of(cid, depth=0):
        out = []
        for k in concepts:
            if k.get("parent") == cid:
                out.append((depth, k))
                out.extend(kids_of(k["id"], depth + 1))
        return out

    theme_of = {}
    for t in themes:
        if t["kind"] == "concept-theme":
            for m in t["members"]:
                theme_of[m] = t

    targets = []

    def write(pid_, kind, for_id, name, lines):
        path = os.path.join(BRIEFS, pid_ + ".txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        targets.append({"id": pid_, "kind": kind, "forId": for_id, "name": name,
                        "brief": f"papers/{MAIN}/data/ingest/briefs/{pid_}.txt"})

    # ---------- major concept pages ----------
    for c in [x for x in concepts if x["tier"] == "major"]:
        L = [f"PAGE FOR CONCEPT: {c['id']}", f"NAME: {c['name']}", ""]
        L += ["SUMMARY (already shown above your page as the lede - do not repeat it verbatim):",
              c["summary"], "",
              "DRAFT EXPLANATION from the extraction stage (your page replaces this; keep what is right, go deeper):",
              c["explanation"], ""]
        t = theme_of.get(c["id"])
        if t:
            L += [f"THEME IT BELONGS TO: {t['id']} | {t['name']} - {t['summary']}", ""]
        if c.get("deepDive"):
            dd = c["deepDive"]
            L += [f"DEFINED IN A CITED PAPER {dd['citationKey']} (paper id {dd['paperId']}). "
                  f"Those concepts are linkable: {', '.join(dd['conceptIds'])}", ""]
        ks = kids_of(c["id"])
        if ks:
            L += ["SUB-CONCEPTS (these render as expandable sections BELOW your page - reference them, do not duplicate them):"]
            for d, k in ks:
                L.append("  " * (d + 1) + f"- {k['id']} | {k['name']}: {k['summary']}")
            L.append("")
        if c.get("prerequisites"):
            L += ["PREREQUISITES:"]
            for p in c["prerequisites"]:
                if p in ALL:
                    L.append(f"  - {p} | {ALL[p]['name']}: {ALL[p]['summary']}")
            L.append("")
        rel = [e for e in edges if e["source"] == c["id"] or e["target"] == c["id"]]
        if rel:
            L += [f"EDGES TOUCHING THIS CONCEPT ({len(rel)}) - the relationships the app already knows; "
                  "weave the load-bearing ones into your prose:"]
            for e in sorted(rel, key=lambda e: {"load-bearing": 0, "supporting": 1, "minor": 2}[e["strength"]]):
                d = "->" if e["source"] == c["id"] else "<-"
                other = e["target"] if e["source"] == c["id"] else e["source"]
                L.append(f"  [{e['strength']}] {d} {other} ({nm(other)}) | {e['type']} | {e['label']}: {e['explanation']}")
            L.append("")
        ev = [i for i in items if any(x.get("conceptId") == c["id"] for x in i.get("terms", []))]
        if ev:
            L += ["EVIDENCE ITEMS THAT SHOW THIS (link them as [[item-id]]):"]
            for i in ev:
                L.append(f"  - {i['id']} | {i['title']}: {i['takeaway']}")
            L.append("")
        sf = sect_for(c.get("sectionIds", []))
        if sf:
            L += ["PAPER SECTIONS TO READ (in papers/" + MAIN + "/data/ingest/sections/):"] + \
                 [f"  - {f}" for f in sf]
        write("page-concept-" + c["id"], "concept", c["id"], c["name"], L)

    # ---------- concept theme pages ----------
    ct = [t for t in themes if t["kind"] == "concept-theme"]
    for n, t in enumerate(ct):
        L = [f"PAGE FOR THEME: {t['id']}", f"NAME: {t['name']}", "",
             "THEME SUMMARY (shown above your page as the lede - do not repeat verbatim):", t["summary"], ""]
        if n > 0:
            L += [f"PREVIOUS THEME: {ct[n-1]['id']} | {ct[n-1]['name']}"]
        if n < len(ct) - 1:
            L += [f"NEXT THEME: {ct[n+1]['id']} | {ct[n+1]['name']}"]
        L += ["", f"MEMBER CONCEPTS ({len(t['members'])}) - each has its own page or expandable section; "
                  "your job is the connective tissue between them, not to restate each one:"]
        sids = []
        for m in t["members"]:
            c = ALL.get(m)
            if not c:
                continue
            L.append(f"  - {m} | {c['name']} [{c.get('tier','')}]: {c['summary']}")
            sub = kids_of(m)
            for d, k in sub[:6]:
                L.append(f"      · {k['id']} | {k['name']}: {k['summary'][:110]}")
            sids += c.get("sectionIds", [])
        L.append("")
        mem = set(t["members"])
        rel = [e for e in edges if e["source"] in mem and e["target"] in mem]
        if rel:
            L += ["EDGES BETWEEN MEMBERS OF THIS THEME:"]
            for e in rel:
                L.append(f"  [{e['strength']}] {e['source']} --{e['type']}--> {e['target']} | {e['label']}: {e['explanation']}")
            L.append("")
        out = [e for e in edges if (e["source"] in mem) != (e["target"] in mem)]
        strong = [e for e in out if e["strength"] == "load-bearing"]
        if strong:
            L += ["LOAD-BEARING EDGES LEAVING THIS THEME (use these to point forward/back):"]
            for e in strong[:14]:
                L.append(f"  {e['source']} --{e['type']}--> {e['target']} | {e['label']}")
            L.append("")
        ev = [i for i in items if any(x.get("conceptId") in mem for x in i.get("terms", []))]
        if ev:
            L += ["EVIDENCE ITEMS RELATED TO THIS THEME (link as [[item-id]]):"]
            for i in ev:
                L.append(f"  - {i['id']} | {i['title']}: {i['takeaway']}")
            L.append("")
        sf = sect_for(sorted(set(sids)))
        if sf:
            L += ["PAPER SECTIONS TO READ (in papers/" + MAIN + "/data/ingest/sections/):"] + \
                 [f"  - {f}" for f in sf[:12]]
        write("page-theme-" + t["id"], "theme", t["id"], t["name"], L)

    # ---------- edge theme pages ----------
    E = {e["id"]: e for e in edges}
    for t in [x for x in themes if x["kind"] == "edge-theme"]:
        L = [f"PAGE FOR EDGE-THEME: {t['id']}", f"NAME: {t['name']}", "",
             "THEME SUMMARY (shown above your page as the lede - do not repeat verbatim):", t["summary"], "",
             f"MEMBER EDGES ({len(t['members'])}) - these render as a list BELOW your page. "
             "Your page is the argument they add up to, not a re-listing:"]
        nodes, sids = set(), []
        for m in t["members"]:
            e = E.get(m)
            if not e:
                continue
            L.append(f"  {m} [{e['strength']}] {e['source']} ({nm(e['source'])}) --{e['type']}--> "
                     f"{e['target']} ({nm(e['target'])}) | {e['label']}: {e['explanation']}")
            nodes |= {e["source"], e["target"]}
        L.append("")
        L += ["NODES INVOLVED (link them as [[id]]):"]
        for n2 in sorted(nodes):
            if n2 in ALL:
                own = f" [from {ALL[n2]['_owner']}]" if "_owner" in ALL[n2] else ""
                L.append(f"  - {n2} | {ALL[n2]['name']}{own}: {ALL[n2]['summary'][:130]}")
                sids += ALL[n2].get("sectionIds", [])
            elif n2 in I:
                L.append(f"  - {n2} | {I[n2]['title']} (evidence): {I[n2]['takeaway'][:130]}")
        L.append("")
        sf = sect_for(sorted(set(sids)))
        if sf:
            L += ["PAPER SECTIONS TO READ (in papers/" + MAIN + "/data/ingest/sections/):"] + \
                 [f"  - {f}" for f in sf[:12]]
        write("page-etheme-" + t["id"], "edge-theme", t["id"], t["name"], L)

    json.dump(targets, open(os.path.join(ROOT, "pipeline", "page-targets.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    kinds = {}
    for t in targets:
        kinds[t["kind"]] = kinds.get(t["kind"], 0) + 1
    print(f"{len(targets)} page briefs: " + ", ".join(f"{k}={v}" for k, v in sorted(kinds.items())))


if __name__ == "__main__":
    main()
