"""Stage 1c apply: fold the deepening agents' children into the concept tree.

Strictly additive, and it has to stay that way. By the time this runs, the
figure agents have linked their terms to concept ids, the cited reads have
hung deepDive pointers off them and the edge lenses have named them as
endpoints. Rewriting or dropping an existing concept here would break all
three quietly, so this only ever appends leaves: an id that already exists is
refused, and so is a parent that does not.

usage: python pipeline/deepen_apply.py [--check]

  --check reports what would be added and writes nothing.

Reads   papers/<id>/data/ingest/deepen/<concept-id>.json
Writes  papers/<id>/data/concepts.json
"""
import json
import os
import re
import sys

from paper import load_part, paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
PAPER = os.path.join(ROOT, "papers", MAIN)
ING = os.path.join(PAPER, "data", "ingest")
DEEPEN = os.path.join(ING, "deepen")

FIELDS = ("id", "name", "tier", "parent", "summary", "explanation",
          "prerequisites", "sectionIds", "floor", "citedFrom")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def main(check=False):
    concepts = load_part(MAIN, "concepts", [])
    if not concepts:
        raise SystemExit("No concepts.json for " + MAIN)
    if not os.path.isdir(DEEPEN):
        raise SystemExit("No " + DEEPEN + " - the deepening agents write these.")

    by_id = {c["id"]: c for c in concepts}
    before = len(concepts)
    added, refused = [], []

    for fname in sorted(os.listdir(DEEPEN)):
        if not fname.endswith(".json"):
            continue
        target = fname[:-5]
        raw = json.load(open(os.path.join(DEEPEN, fname), encoding="utf-8"))
        rows = raw.get("concepts") if isinstance(raw, dict) else raw
        if target not in by_id:
            refused.append((fname, "target %s is not a concept" % target))
            continue

        # Within one file, a child may be the parent of the next, so the
        # additions land in the order the agent wrote them and each one's
        # parent is looked up in the tree as it stands by then.
        for c in rows or []:
            cid = (c.get("id") or "").strip()
            if not SLUG.match(cid or ""):
                refused.append((fname, "not a slug: %r" % cid))
                continue
            if cid in by_id:
                refused.append((fname, "%s already exists" % cid))
                continue
            parent = c.get("parent") or target
            if parent not in by_id:
                refused.append((fname, "%s: parent %s does not exist" % (cid, parent)))
                continue
            # The parent must be the target or sit under it. A child hung on
            # someone else's branch is an agent reaching outside its brief.
            walk, hops = parent, 0
            while walk and walk != target and hops < 50:
                walk = (by_id.get(walk) or {}).get("parent")
                hops += 1
            if walk != target:
                refused.append((fname, "%s: parent %s is outside %s"
                                % (cid, parent, target)))
                continue
            if not (c.get("summary") or "").strip() or not (c.get("explanation") or "").strip():
                refused.append((fname, "%s: empty summary or explanation" % cid))
                continue

            row = {k: c.get(k) for k in FIELDS}
            row["id"] = cid
            row["parent"] = parent
            # Tier is the merge's call, made over the whole paper. This pass
            # sees one branch, so it does not get to promote anything.
            row["tier"] = "minor"
            row["floor"] = bool(c.get("floor"))
            row["prerequisites"] = [p for p in (c.get("prerequisites") or [])
                                    if p in by_id or p == target]
            row["sectionIds"] = c.get("sectionIds") or []
            row["citedFrom"] = c.get("citedFrom")
            by_id[cid] = row
            concepts.append(row)
            added.append((target, cid))

    # A cycle cannot arise from an append whose parent already existed, but
    # the tree is load-bearing enough that it gets checked rather than argued.
    for c in concepts:
        walk, hops = c.get("parent"), 0
        while walk and hops < 200:
            if walk == c["id"]:
                raise SystemExit("cycle through " + c["id"])
            walk = (by_id.get(walk) or {}).get("parent")
            hops += 1

    per_target = {}
    for t, _ in added:
        per_target[t] = per_target.get(t, 0) + 1
    print("deepening: +%d concepts (%d -> %d)" % (len(added), before, len(concepts)))
    for t in sorted(per_target, key=lambda t: -per_target[t]):
        print("  +%-3d %s" % (per_target[t], t))
    if refused:
        print("refused %d:" % len(refused))
        for f, why in refused[:40]:
            print("  %-46s %s" % (f, why))

    if check:
        print("--check: nothing written")
        return
    json.dump({"concepts": concepts},
              open(os.path.join(PAPER, "data", "concepts.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print("wrote data/concepts.json")


if __name__ == "__main__":
    main(check="--check" in sys.argv)
