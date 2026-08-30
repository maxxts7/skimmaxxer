"""Stage 1c prep: one brief per major concept, for the pass that deepens it.

The three extractors read the paper by section, so what they produce is shaped
like the paper: wide where it has many parallel experiments, and only as deep
as one reading of one section happened to go. A concept the paper leans on for
half a page comes back as a leaf with a five-sentence explanation, which is
the failure the floor exists to catch - the reader hits a term inside that
explanation and stops.

This pass fixes it the other way round: one agent per major concept, reading
only the sections that concept came from, asked what is still above the floor
inside its own subtree.

Append-only by construction. Every id already on disk is reserved and handed
to the agent as a do-not-use list, so items, edges and cited reads produced
against the current tree stay valid - the deepening can only add leaves.

Reads   papers/<id>/data/concepts.json
Writes  papers/<id>/data/ingest/deepen-targets.json
        papers/<id>/data/ingest/deepen-briefs/<concept-id>.txt
"""
import json
import os
from collections import defaultdict

from paper import load_part, paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
PAPER = os.path.join(ROOT, "papers", MAIN)
ING = os.path.join(PAPER, "data", "ingest")
BRIEFS = os.path.join(ING, "deepen-briefs")


def subtree(kids, root, by_id, depth=1, out=None):
    """The concept's descendants, indented, deepest branch included."""
    out = [] if out is None else out
    for cid in sorted(kids.get(root, [])):
        c = by_id[cid]
        flag = " [floor]" if c.get("floor") else ""
        out.append("%s- %s (%s)%s: %s"
                   % ("  " * depth, cid, c["name"], flag, c["summary"]))
        subtree(kids, cid, by_id, depth + 1, out)
    return out


def main():
    concepts = load_part(MAIN, "concepts", [])
    if not concepts:
        raise SystemExit("No concepts.json for " + MAIN + " - run the merge first.")

    by_id = {c["id"]: c for c in concepts}
    kids = defaultdict(list)
    for c in concepts:
        if c.get("parent"):
            kids[c["parent"]].append(c["id"])

    # A chart concept is one of the plot explainers from stage 2b. It is a
    # major concept and it is a leaf, and both are correct: "a grouped bar
    # chart" does not decompose into smaller ideas the way a mechanism does.
    charts = set()
    cdir = os.path.join(ING, "charts")
    if os.path.isdir(cdir):
        charts = {f[:-5] for f in os.listdir(cdir) if f.endswith(".json")}

    sections = {s["id"]: s for s in load_part(MAIN, "sections", []) or []}
    if not sections:
        raw = json.load(open(os.path.join(ING, "sections.json"), encoding="utf-8"))
        sections = {s["id"]: s for s in raw["sections"]}

    reserved = sorted(by_id)
    targets = []
    os.makedirs(BRIEFS, exist_ok=True)
    for c in concepts:
        if c["tier"] != "major" or c["id"] in charts or c.get("floor"):
            continue
        if c.get("ownerPaper") and c["ownerPaper"] != MAIN:
            continue

        tree = subtree(kids, c["id"], by_id)
        secs = [sections[s] for s in (c.get("sectionIds") or []) if s in sections]
        # A concept with no sections of its own is a grouping the merge made
        # to hang other concepts off - "reading the evidence" over the chart
        # explainers. There is no text behind it to go deeper into.
        if not secs:
            continue
        lines = [
            "CONCEPT TO DEEPEN: %s" % c["id"],
            "name: %s" % c["name"],
            "summary: %s" % c["summary"],
            "",
            "Its explanation as it stands:",
            c["explanation"],
            "",
            "WHAT ALREADY EXISTS UNDER IT (%d concepts). Do not restate any of these; "
            "they are here so you can see what is left." % len(tree),
        ]
        lines += tree or ["  (nothing - it is a leaf)"]
        lines += [
            "",
            "PREREQUISITES IT ALREADY DECLARES: %s"
            % (", ".join(c.get("prerequisites") or []) or "none"),
            "",
            "THE SECTIONS IT CAME FROM - read these, and only these:",
        ]
        lines += ["  %s  (%s)" % (s["file"], s["title"]) for s in secs] or \
                 ["  (none recorded - read the sections its children name)"]
        lines += [
            "",
            "IDS ALREADY TAKEN ACROSS THE WHOLE PAPER (%d). A new concept may not "
            "reuse one, and may not be a rewording of one:" % len(reserved),
            ", ".join(reserved),
        ]
        open(os.path.join(BRIEFS, c["id"] + ".txt"), "w", encoding="utf-8") \
            .write("\n".join(lines) + "\n")

        targets.append({
            "id": c["id"], "name": c["name"], "summary": c["summary"],
            "descendants": len(tree),
            "sectionFiles": [s["file"] for s in secs],
            "brief": "data/ingest/deepen-briefs/%s.txt" % c["id"],
        })

    json.dump({"paperId": MAIN, "targets": targets},
              open(os.path.join(ING, "deepen-targets.json"), "w", encoding="utf-8"),
              indent=1)

    print("deepen targets: %d major concepts (%d chart explainers skipped)"
          % (len(targets), len(charts)))
    print("reserved ids: %d" % len(reserved))
    for t in sorted(targets, key=lambda t: t["descendants"]):
        print("  %-44s %2d descendants, %d sections"
              % (t["id"], t["descendants"], len(t["sectionFiles"])))


if __name__ == "__main__":
    main()
