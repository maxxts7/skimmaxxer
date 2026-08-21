"""Save narrow-scope cited-paper reads.

Each cited paper gets its own concepts.json (it stands independently and is
reusable by any future paper that cites it), an entry in the shared register,
and a line in the citing paper's refs.json.

usage: python pipeline/save_cited.py <workflow-task-output.json>
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
TODAY = "2026-08-20"


def main(task_out):
    out = json.load(open(task_out, encoding="utf-8"))["result"]
    reads = out["reads"]
    meta = {m["arxivId"]: m for m in out["meta"]}

    reg_path = os.path.join(ROOT, "register.json")
    register = json.load(open(reg_path, encoding="utf-8"))
    accessed = []

    for r in reads:
        pid = r["paperId"]
        m = meta.get(pid, {})
        pdir = os.path.join(ROOT, "papers", pid, "data")
        os.makedirs(pdir, exist_ok=True)

        concepts = []
        for c in r["concepts"]:
            concepts.append({
                "id": c["id"], "name": c["name"],
                "tier": "minor", "parent": None,
                "summary": c["summary"], "explanation": c["explanation"],
                "prerequisites": [], "sectionIds": [], "floor": False,
                "citedFrom": None, "sourceNote": c.get("sourceNote", ""),
                "ownerPaper": pid,
            })
        json.dump({"concepts": concepts},
                  open(os.path.join(pdir, "concepts.json"), "w", encoding="utf-8"),
                  indent=1, ensure_ascii=False)

        register["papers"][pid] = {
            "title": r["title"],
            "authors": r["authors"],
            "source": f"https://arxiv.org/abs/{pid}",
            "status": "narrow",
            "addedAt": TODAY,
            "extracted": [c["id"] for c in concepts],
            "citedBy": [MAIN],
            "skipped": r.get("note", ""),
        }
        accessed.append({
            "paperId": pid,
            "citationKey": m.get("citationKey", ""),
            "whyNeeded": m.get("whyNeeded", ""),
            "concepts": [c["id"] for c in concepts],
        })
        print(f"{pid}: {len(concepts)} concepts -> {r['title']}")

    json.dump(register, open(reg_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump({"paperId": MAIN, "accessed": accessed},
              open(os.path.join(ROOT, "papers", MAIN, "refs.json"), "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print(f"register: {len(register['papers'])} papers; refs.json: {len(accessed)} accessed")

    # Cross-link: an AIAYN concept that leans on a cited paper points at the
    # concepts extracted from that paper (which the cited paper owns).
    wants = json.load(open(os.path.join(ROOT, "pipeline", "cited-reads.json"), encoding="utf-8"))
    by_paper = {a["paperId"]: a for a in accessed}
    main_path = os.path.join(ROOT, "papers", MAIN, "data", "concepts.json")
    main_concepts = json.load(open(main_path, encoding="utf-8"))["concepts"]
    idx = {c["id"]: c for c in main_concepts}
    linked = 0
    for w in wants:
        got = by_paper.get(w["arxivId"])
        if not got:
            continue
        for cid in w["wantedConcepts"]:
            if cid in idx:
                idx[cid]["deepDive"] = {
                    "paperId": w["arxivId"],
                    "citationKey": w["citationKey"],
                    "conceptIds": got["concepts"],
                }
                linked += 1
    json.dump({"concepts": main_concepts}, open(main_path, "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)
    print(f"deep-dive links added to {linked} AIAYN concepts")


if __name__ == "__main__":
    main(sys.argv[1])
