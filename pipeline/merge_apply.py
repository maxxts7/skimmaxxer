"""Stage 1b apply: the merge's decisions, applied to the extractors' concepts.

The merge agent returns judgements, not a copy of its input: which ids are the
same thing, which twelve to twenty are major, what to add for anything named
but never defined, and which cited papers earn a narrow read. Everything
mechanical happens here - unioning duplicates, rewriting references onto the
survivor, resolving the tree and checking it does not loop.

usage: python pipeline/merge_apply.py <workflow-task-output.json>

Writes  papers/<id>/data/concepts.json
        pipeline/cited-reads.json
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
ING = os.path.join(ROOT, "papers", MAIN, "data", "ingest")

FIELDS = ("id", "name", "tier", "parent", "summary", "explanation",
          "prerequisites", "sectionIds", "floor", "citedFrom")


def union(a, b):
    """Two extractors on the same concept. Keep the fuller account of both."""
    out = dict(a)
    if len(b.get("explanation") or "") > len(a.get("explanation") or ""):
        out["explanation"] = b["explanation"]
    if len(b.get("summary") or "") > len(a.get("summary") or ""):
        out["summary"] = b["summary"]
    out["sectionIds"] = sorted(set(a.get("sectionIds") or []) | set(b.get("sectionIds") or []))
    out["prerequisites"] = sorted(set(a.get("prerequisites") or []) | set(b.get("prerequisites") or []))
    out["tier"] = "major" if "major" in (a.get("tier"), b.get("tier")) else "minor"
    out["floor"] = bool(a.get("floor")) and bool(b.get("floor"))
    out["citedFrom"] = a.get("citedFrom") or b.get("citedFrom")
    return out


def main(task_out):
    d = json.load(open(task_out, encoding="utf-8"))["result"]
    src = json.load(open(os.path.join(ING, "merge-input.json"), encoding="utf-8"))

    # ---- one entry per id, the two extractors' versions folded together ----
    by_id = {}
    for c in src["concepts"]:
        c = {k: c.get(k) for k in FIELDS}
        by_id[c["id"]] = union(by_id[c["id"]], c) if c["id"] in by_id else c
    folded = len(src["concepts"]) - len(by_id)

    # ---- adds first, so an alias may point at one of them ----
    for c in d.get("add", []):
        c = {k: c.get(k) for k in FIELDS}
        c.setdefault("prerequisites", [])
        c.setdefault("sectionIds", [])
        by_id[c["id"]] = union(by_id[c["id"]], c) if c["id"] in by_id else c

    # ---- aliases: fold the loser into the survivor, then redirect every ----
    # ---- reference to it. Chains are followed so a->b->c lands on c.    ----
    alias = {a["from"]: a["to"] for a in d.get("aliases", []) if a.get("from") != a.get("to")}

    def survivor(i, seen=None):
        seen = seen or set()
        while i in alias and i not in seen:
            seen.add(i)
            i = alias[i]
        return i

    for src_id in list(alias):
        dst = survivor(src_id)
        if src_id not in by_id or dst not in by_id or dst == src_id:
            continue
        by_id[dst] = union(by_id[dst], by_id[src_id])
        by_id[dst]["id"] = dst
        del by_id[src_id]

    for i in d.get("drop", []):
        by_id.pop(i, None)

    # ---- tiers: the merge names the majors, everything else is minor ----
    majors = set(d.get("majors") or [])
    for c in by_id.values():
        c["tier"] = "major" if c["id"] in majors else "minor"

    for e in d.get("edits", []):
        c = by_id.get(survivor(e.get("id")))
        if not c:
            continue
        for k in ("name", "parent", "summary", "explanation", "floor", "tier", "citedFrom"):
            if k in e and e[k] is not None:
                c[k] = e[k]

    # ---- resolve every reference onto something that exists ----
    dropped_refs, orphaned = [], []
    for c in by_id.values():
        if c.get("floor"):
            c["tier"] = "minor"          # a floor concept is never major
        p = survivor(c.get("parent")) if c.get("parent") else None
        if p == c["id"] or (p and p not in by_id):
            orphaned.append((c["id"], c.get("parent")))
            p = None
        c["parent"] = p
        pre, gone = [], []
        for r in (c.get("prerequisites") or []):
            r = survivor(r)
            (pre if (r in by_id and r != c["id"]) else gone).append(r)
        c["prerequisites"] = sorted(set(pre))
        dropped_refs += [(c["id"], g) for g in gone]

    # ---- no cycles: a parent chain that loops is cut at the loop ----
    cut = []
    for c in by_id.values():
        seen, node = {c["id"]}, c
        while node.get("parent"):
            if node["parent"] in seen:
                cut.append((node["id"], node["parent"]))
                node["parent"] = None
                break
            seen.add(node["parent"])
            node = by_id[node["parent"]]

    out = sorted(by_id.values(), key=lambda c: (c["parent"] or "", c["id"]))
    json.dump({"concepts": out},
              open(os.path.join(ROOT, "papers", MAIN, "data", "concepts.json"), "w",
                   encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump(d.get("citedReads", []),
              open(os.path.join(ROOT, "pipeline", "cited-reads.json"), "w",
                   encoding="utf-8"), indent=1, ensure_ascii=False)

    n_major = sum(1 for c in out if c["tier"] == "major")
    print(f"concepts.json: {len(out)} concepts ({folded} folded, {len(alias)} aliased, "
          f"{len(d.get('add', []))} added, {len(d.get('drop', []))} dropped)")
    print(f"  major: {n_major}   floor: {sum(1 for c in out if c.get('floor'))}")
    print(f"  cited reads: {len(d.get('citedReads', []))}")
    if orphaned:
        print(f"  parents that did not resolve, cleared: {orphaned}")
    if dropped_refs:
        print(f"  prerequisites that did not resolve, dropped: {len(dropped_refs)}")
        for a, b in dropped_refs[:12]:
            print(f"    {a} -> {b}")
    if cut:
        print(f"  parent cycles cut: {cut}")
    if not 10 <= n_major <= 24:
        print(f"  ! {n_major} major concepts - the target is 12-20; check the merge's majors list")


if __name__ == "__main__":
    main(sys.argv[1])
