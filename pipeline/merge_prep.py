"""Stage 1b prep: turn three extractors' concept sets into one merge brief.

The merge used to be handed every concept in full and asked to hand them all
back. On a large paper that is thousands of lines of retyping, and it fails
outright once the answer will not fit in one reply. Nothing in that retyping
is a judgement: deduping identical ids, unioning section lists and resolving
references are all mechanical.

So this does the mechanical part and leaves the merge four questions it
actually has to think about:

  - which of these near-identical concepts are the same thing
  - which referenced-but-undefined ids need a real explanation, not a stub
  - which twelve to twenty concepts are major
  - which cited papers deserve a narrow read

Reads   papers/<id>/data/ingest/extract-*.json
Writes  papers/<id>/data/ingest/merge-brief.txt   (for the agent to read)
        papers/<id>/data/ingest/merge-input.json  (for merge_apply.py)
"""
import json
import os
import re
from collections import Counter, defaultdict

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
ING = os.path.join(ROOT, "papers", MAIN, "data", "ingest")


def norm(s):
    """A name reduced to what it is about, for spotting the same idea twice."""
    s = re.sub(r"[^a-z0-9 ]+", " ", (s or "").lower())
    s = re.sub(r"\b(the|a|an|of|for|and|in|to|as|its|our)\b", " ", s)
    return " ".join(sorted(s.split()))


def main():
    files = sorted(f for f in os.listdir(ING)
                   if f.startswith("extract-") and f.endswith(".json"))
    if not files:
        raise SystemExit("No extract-*.json in " + ING + " - the extractors write these.")

    groups, concepts, flags = [], [], []
    owners = defaultdict(list)          # id -> which extractors produced it
    for f in files:
        raw = json.load(open(os.path.join(ING, f), encoding="utf-8"))
        key = raw.get("key") or f[8:-5]
        groups.append(key)
        for c in raw["concepts"]:
            c["_from"] = key
            concepts.append(c)
            owners[c["id"]].append(key)
        for fl in raw.get("citationFlags", []):
            fl["_from"] = key
            flags.append(fl)

    by_id = defaultdict(list)
    for c in concepts:
        by_id[c["id"]].append(c)

    # Same id from more than one extractor: same thing, and the apply step
    # unions them. Listed so the merge can overrule where they are not.
    collisions = {i: v for i, v in by_id.items() if len(v) > 1}

    # Different ids, same idea. This is the one the machine cannot settle.
    by_name = defaultdict(list)
    for i, v in by_id.items():
        by_name[norm(v[0]["name"])].append(i)
    near = {n: ids for n, ids in by_name.items() if len(ids) > 1}

    # Named but never defined. Each needs either a real concept or a floor stub.
    known = set(by_id)
    dangling = Counter()
    for c in concepts:
        for ref in (c.get("prerequisites") or []):
            if ref not in known:
                dangling[ref] += 1
        if c.get("parent") and c["parent"] not in known:
            dangling[c["parent"]] += 1

    cited = defaultdict(lambda: {"keys": set(), "refs": set(), "why": [], "concepts": set()})
    for fl in flags:
        k = (fl.get("citationKey") or "?").strip()
        e = cited[k]
        e["refs"].add((fl.get("refText") or "").strip()[:180])
        e["why"].append((fl.get("whyNeeded") or "").strip())
        e["concepts"].add((fl.get("concept") or "").strip())

    majors = [c for c in concepts if c.get("tier") == "major"]
    floors = [c for c in concepts if c.get("floor")]

    json.dump({"groups": groups, "concepts": concepts, "flags": flags},
              open(os.path.join(ING, "merge-input.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)

    L = []
    W = L.append
    W(f"MERGE BRIEF - {MAIN}")
    W(f"{len(concepts)} concepts from {len(groups)} extractors ({', '.join(groups)}); "
      f"{len(by_id)} distinct ids; {len(majors)} currently major; {len(floors)} at the floor.")
    W("")
    W("Every id below already exists. The apply step unions duplicates, carries")
    W("sectionIds and prerequisites across, and writes the file. You decide only")
    W("what is listed at the end.")
    W("")
    W("=" * 70)
    W("ALL CONCEPTS  (id | tier | floor | parent | sections | from | name - summary)")
    W("=" * 70)
    for i in sorted(by_id):
        v = by_id[i][0]
        secs = sorted({s for c in by_id[i] for s in (c.get("sectionIds") or [])})
        W(f"{i} | {v.get('tier','?')}{' | FLOOR' if v.get('floor') else ' |'} | "
          f"parent={v.get('parent') or '-'} | §{','.join(secs[:6])} | {'+'.join(owners[i])} | "
          f"{v.get('name','')} - {(v.get('summary') or '')[:150]}")
    W("")
    W("=" * 70)
    W(f"SAME ID FROM MORE THAN ONE EXTRACTOR ({len(collisions)})")
    W("=" * 70)
    for i, v in sorted(collisions.items()):
        W(f"{i}  [{'+'.join(owners[i])}]")
        for c in v:
            W(f"    ({c['_from']}) {(c.get('explanation') or '')[:200]}")
    W("")
    W("=" * 70)
    W(f"DIFFERENT IDS THAT MAY BE THE SAME IDEA ({len(near)}) - your call")
    W("=" * 70)
    for n, ids in sorted(near.items()):
        W("  " + "  ==  ".join(f"{i} ({by_id[i][0].get('name')})" for i in ids))
    W("")
    W("=" * 70)
    W(f"REFERENCED BUT NEVER DEFINED ({len(dangling)}) - each needs a concept")
    W("=" * 70)
    for ref, n in dangling.most_common():
        W(f"  {ref}  (named {n}x)")
    W("")
    W("=" * 70)
    W(f"CITATIONS FLAGGED AS LEANED ON ({len(cited)})")
    W("=" * 70)
    for k, e in sorted(cited.items(), key=lambda kv: -len(kv[1]["why"])):
        W(f"  [{k}]  flagged {len(e['why'])}x  for: {', '.join(sorted(c for c in e['concepts'] if c))[:160]}")
        ref = sorted(r for r in e["refs"] if r)
        if ref:
            W(f"        {ref[0]}")
        W(f"        why: {e['why'][0][:220]}")
    open(os.path.join(ING, "merge-brief.txt"), "w", encoding="utf-8").write("\n".join(L))

    print(f"merge-brief.txt: {len(concepts)} concepts -> {len(by_id)} ids")
    print(f"  same id twice: {len(collisions)}")
    print(f"  possible same idea, different id: {len(near)}")
    print(f"  referenced but undefined: {len(dangling)}")
    print(f"  citations flagged: {len(cited)}")
    print(f"  currently major: {len(majors)} (target 12-20)")


if __name__ == "__main__":
    main()
