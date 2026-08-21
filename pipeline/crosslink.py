"""Cross-paper concept links.

Every paper keeps its OWN complete concept list. A concept is never dropped
because another paper already explains the thing, and no concept is ever moved
between papers. What this adds is the link: where two papers explain the same
mechanism, each says so and points at the other.

Runs over the active paper (SKIM_PAPER / pipeline/active.json) after its
concepts are merged and before anything downstream reads them.

Writes `alsoExplainedIn` onto the active paper's concepts only:

    "alsoExplainedIn": [{"paperId", "conceptId", "name", "match"}]

Other papers' files are never touched. The reverse direction is derived by the
viewer from these same records, so a finished paper gains inbound links without
being edited.

Matching is deliberately conservative - three rules, each of which has to be
defensible when a reader clicks through:

  suffix   the id is another paper's id plus a disambiguating suffix
           (byte-pair-encoding-gpt1 -> byte-pair-encoding)
  origin   both concepts point at the same cited paper as the source of the
           mechanism, via citedFrom's citation key or deepDive's paperId
  name     display names normalize to the same string

Anything weaker is reported as a near miss rather than linked.
"""
import json
import os
import re
import sys

from paper import ROOT, load_part, paper_id

STOP = {"the", "a", "an", "of", "in", "for", "and", "to"}


def norm_name(s):
    s = re.sub(r"\(.*?\)", " ", (s or "").lower())
    words = [w for w in re.split(r"[^a-z0-9]+", s) if w and w not in STOP]
    return " ".join(words)


def load_all():
    reg = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    out = {}
    for pid in reg:
        cs = load_part(pid, "concepts", [])
        if cs:
            out[pid] = cs
    return reg, out


def origin_keys(c):
    """The specific source concepts this one says it is drawing on.

    Keyed per target concept, not per target paper. Two concepts pointing at
    the same cited PAPER are usually unrelated - AIAYN's word-piece-encoding
    and its beam-search both cite GNMT. Two concepts pointing at the same
    cited CONCEPT are accounts of the same mechanism.
    """
    dd = c.get("deepDive") or {}
    pid = dd.get("paperId")
    if not pid:
        return set()
    return {pid + "/" + cid for cid in (dd.get("conceptIds") or [])}


def main():
    pid = paper_id()
    reg, papers = load_all()
    mine = papers.get(pid)
    if not mine:
        raise SystemExit(f"no concepts for {pid} - run the concept stage first")

    others = {p: cs for p, cs in papers.items() if p != pid}
    by_id = {(p, c["id"]): c for p, cs in others.items() for c in cs}
    ids = {c["id"]: p for p, cs in others.items() for c in cs}
    names = {}
    for p, cs in others.items():
        for c in cs:
            names.setdefault(norm_name(c.get("name")), []).append((p, c))

    linked = misses = 0
    for c in mine:
        found = {}

        # 1. suffix: our id is someone else's id plus a disambiguator
        m = re.match(r"^(.*?)-(?:[a-z0-9]+)$", c["id"])
        if m and m.group(1) in ids:
            p = ids[m.group(1)]
            found[(p, m.group(1))] = "suffix"

        # 2. origin: both draw on the same specific source concept. The source
        # paper itself is skipped - deepDive already points there, and this
        # field is for peer accounts in papers that also USE the mechanism.
        mykeys = origin_keys(c)
        src = ((c.get("deepDive") or {}).get("paperId"))
        if mykeys:
            for p, cs in others.items():
                if p == src:
                    continue
                for o in cs:
                    if (p, o["id"]) in found:
                        continue
                    if mykeys & origin_keys(o):
                        found[(p, o["id"])] = "origin"

        # 3. name: display names normalize identically
        for p, o in names.get(norm_name(c.get("name")), []):
            found.setdefault((p, o["id"]), "name")

        if found:
            c["alsoExplainedIn"] = [
                {"paperId": p, "conceptId": cid,
                 "name": by_id[(p, cid)].get("name"), "match": how}
                for (p, cid), how in sorted(found.items())
            ]
            linked += 1
        else:
            c.pop("alsoExplainedIn", None)
            if norm_name(c.get("name")) in names:
                misses += 1

    dry = "--dry" in sys.argv
    if not dry:
        out = os.path.join(ROOT, "papers", pid, "data", "concepts.json")
        json.dump({"concepts": mine}, open(out, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)

    print(f"{pid}: {len(mine)} concepts, {linked} now link out to another paper"
          + ("  [DRY RUN - nothing written]" if dry else ""))
    for c in mine:
        for a in c.get("alsoExplainedIn", []):
            print(f"  {c['id']:<42} -> {a['paperId']}/{a['conceptId']}  ({a['match']})")
    if misses:
        print(f"({misses} near misses reported but not linked)")
    print("other papers' concept files: untouched")


if __name__ == "__main__":
    sys.exit(main())
