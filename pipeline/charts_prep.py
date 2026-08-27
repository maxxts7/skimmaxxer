"""Stage 2b prep: a compact table of the paper's plots, for grouping by kind.

A paper that argues from evidence reuses a handful of chart shapes and then
applies each one over and over. The reader who learns to read an activation
spectrum once can read all four of them; the reader who never learns is stuck
at every single figure. So the plots get grouped by KIND, and each kind gets
its own explainer rather than each plot getting one.

This hands the grouping agent a table it can hold in its head - one line per
plot - rather than thirty thousand words of walkthrough.

Reads   papers/<id>/data/items.json
Writes  papers/<id>/data/ingest/plots.txt
"""
import json
import os
import re

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")

# A plot is a figure that has the furniture of a plot: axes, a scale, a
# distribution, a projection. A screenshot of an interface has none of it.
PLOTTY = re.compile(
    r"\b(x-axis|y-axis|axes|axis|histogram|scatter|log[- ]?scale|logarithm|"
    r"umap|projection|curve|percentile|quantile|distribution|density|"
    r"bar chart|heatmap|colou?r ?bar|legend|plot|plotted|binned?)\b", re.I)


def main():
    items = json.load(open(os.path.join(D, "items.json"), encoding="utf-8"))["items"]
    lines, n = [], 0
    for it in items:
        if it.get("kind") != "figure":
            continue
        terms = [t["term"] for t in (it.get("terms") or [])]
        blob = (it.get("walkthrough") or "") + " " + " ".join(terms)
        if not PLOTTY.search(blob):
            continue
        n += 1
        axes = [t for t in terms if re.search(r"axis|axes|scale|bin|colou?r|legend", t, re.I)][:6]
        lines.append(
            f"{it['id']} | §{it.get('section', '?')} | {it.get('title', '')}\n"
            f"    takeaway: {(it.get('takeaway') or '')[:220]}\n"
            f"    furniture: {'; '.join(axes) if axes else '(none named)'}")

    out = os.path.join(D, "ingest", "plots.txt")
    open(out, "w", encoding="utf-8").write(
        f"{n} of {len(items)} items look like plots rather than screenshots or diagrams.\n"
        "Each entry: item id, the section it sits in, its title, what it establishes,\n"
        "and the axis/scale/colour terms its walkthrough names.\n\n" + "\n\n".join(lines))
    print(f"plots.txt: {n} plots out of {len(items)} items")


if __name__ == "__main__":
    main()
