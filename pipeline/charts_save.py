"""Stage 2b apply: the chart explainers into the concept set and onto the items.

Each recurring chart shape becomes one concept - why this chart and not
another, how to read it, what a bad result would look like, and where it comes
back - hanging under one umbrella so they can be found together as well as
from the figures that use them. Every plot gets a chartId pointing at its
explainer, which is what the figure page links to.

usage: python pipeline/charts_save.py <dir-of-per-chart-json>

Writes  papers/<id>/data/concepts.json   (chart concepts added)
        papers/<id>/data/items.json      (chartId on each plot)
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")

UMBRELLA = {
    "id": "reading-the-evidence",
    "name": "Reading this paper's charts",
    "tier": "major",
    "parent": None,
    "summary": "The handful of chart shapes this paper argues with, each explained once: "
               "why that shape was chosen, how to read it, and what it would look like if the "
               "claim it supports were false.",
    "explanation": "This paper makes the same kinds of measurement over and over - on the Arabic "
                   "feature, then the DNA one, then base64, then Hebrew - and plots each the same "
                   "way. That repetition is the point: once you can read one activation spectrum "
                   "you can read all of them, and the comparison across cases is where the "
                   "argument actually lives. Each page below takes one of those shapes and says "
                   "what question forced it, how to get information out of it, and what a "
                   "negative result would look like on it.",
    "prerequisites": [],
    "sectionIds": [],
    "floor": False,
    "citedFrom": None,
}

FIELDS = ("id", "name", "tier", "parent", "summary", "explanation",
          "prerequisites", "sectionIds", "floor", "citedFrom")


def main(src):
    charts = []
    for f in sorted(os.listdir(src)):
        if f.endswith(".json"):
            r = json.load(open(os.path.join(src, f), encoding="utf-8"))
            charts.append(r.get("result", r))
    if not charts:
        raise SystemExit("No chart explainers in " + src)

    cp = os.path.join(D, "concepts.json")
    raw = json.load(open(cp, encoding="utf-8"))
    by_id = {c["id"]: c for c in raw["concepts"]}

    by_id[UMBRELLA["id"]] = {**by_id.get(UMBRELLA["id"], {}), **UMBRELLA}
    added, mapped = 0, {}
    for ch in charts:
        c = {k: ch.get(k) for k in FIELDS}
        c["parent"] = UMBRELLA["id"]
        c["tier"] = "major"
        c["floor"] = False
        c["prerequisites"] = [p for p in (c.get("prerequisites") or []) if p in by_id]
        c["sectionIds"] = c.get("sectionIds") or []
        c["citedFrom"] = None
        if c["id"] not in by_id:
            added += 1
        by_id[c["id"]] = c
        for iid in (ch.get("itemIds") or []):
            mapped[iid] = c["id"]

    raw["concepts"] = sorted(by_id.values(), key=lambda c: (c["parent"] or "", c["id"]))
    json.dump(raw, open(cp, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    ip = os.path.join(D, "items.json")
    items = json.load(open(ip, encoding="utf-8"))
    tagged = 0
    for it in items["items"]:
        if it["id"] in mapped:
            it["chartId"] = mapped[it["id"]]
            tagged += 1
    json.dump(items, open(ip, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    n_major = sum(1 for c in raw["concepts"] if c["tier"] == "major")
    print(f"charts: {len(charts)} explainers ({added} new), {tagged} plots tagged")
    print(f"concepts.json: {len(raw['concepts'])} concepts, {n_major} major")
    for ch in charts:
        print(f"  {ch['id']:<34} {len(ch.get('itemIds') or []):>2} figures | {ch.get('name','')}")
    loose = [i["id"] for i in items["items"]
             if i.get("kind") == "figure" and not i.get("chartId")]
    if loose:
        print(f"  figures with no chart explainer ({len(loose)}): {', '.join(loose[:14])}"
              + (" ..." if len(loose) > 14 else ""))


if __name__ == "__main__":
    main(sys.argv[1])
