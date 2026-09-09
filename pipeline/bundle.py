"""Wrap pipeline JSON into JS bundles the static viewer can load over file://.

register.json            -> register.js          (window.SKIM_REGISTER = ...)
papers/<id>/data/*.json  -> papers/<id>/data/js/bundle.js  (window.SKIM_PAPERS[id] = ...)
papers/<id>/refs.json    -> included in the bundle

Then hands off to pipeline/prerender.mjs, which reads what was just written and
rebuilds viewer/papers.html with the shelf in it. That page is generated, not
hand-written, and it is generated from these files - so it is rebuilt here
rather than left for whoever remembers, which would show as a library quietly
missing the paper that was just added.
"""
import glob
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = ["concepts", "items", "edges", "themes", "pages", "narrative", "insights", "summary", "reading"]


def load(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def item_label(it):
    """What a figure is called in prose: its printed number, not its caption.

    Mirrors itemLabel() in app.js. The reader needs this for a figure it has
    not loaded yet, and it cannot compute it without the item."""
    if it.get("number"):
        kind = str(it.get("kind") or "figure")
        return kind[:1].upper() + kind[1:] + " " + str(it["number"])
    return it.get("title") or it["id"]


def link_entries(pid, data, links, owners):
    """One row per concept, item and theme: enough to draw a link to it and to
    find it in search, without holding the paper it belongs to.

    A reader shell now loads only the paper it is about, so every id belonging
    to one of the other papers has to resolve from here instead - the name to
    print on the link, the kind, the paper to fetch when the link is followed,
    and the summary, which is what search matches on and what the hover card
    shows. The summary is kept whole rather than clipped: search reads it to
    the end, and clipping it to 150 characters dropped real hits from the
    results while saving 34KB compressed. Rows are arrays rather than objects
    because there are about eighteen hundred of them and the keys would cost
    more than the values.

    First writer wins, in register order, which is the precedence app.js
    already applied when it indexed every bundle in that order."""
    kinds = (("concepts", 0, lambda x: x.get("name"), lambda x: x.get("summary")),
             ("items", 1, item_label, lambda x: x.get("takeaway") or x.get("caption")),
             ("themes", 2, lambda x: x.get("name"), lambda x: x.get("summary")))
    for part, code, name_of, summary_of in kinds:
        for x in data.get(part) or []:
            if not x.get("id"):
                continue
            # A concept can sit in more than one paper: the narrow read of a
            # cited paper holds the same id the citing paper does, and the
            # concept page offers "see what was read from it" on the strength
            # of that. Only the shared ids need the list; the rest have one
            # owner and the row above already names it.
            owners.setdefault(x["id"], []).append(pid)
            if x["id"] in links:
                continue
            links[x["id"]] = [code, pid, name_of(x) or x["id"],
                              (summary_of(x) or "")]


def split_story(pid, pdir, data):
    """Take the story's node bodies out of the bundle, one file per level of zoom.

    The story recurses: every chapter can reopen as a node that retells the same
    span at higher resolution, and those nodes are most of the paper's prose -
    946KB of global-workspace's 3.9MB, against 56KB for the telling you actually
    land on. A reader who never zooms in was paying for all of it.

    What stays behind is an index: for each node its level, its parent, its
    title and number, how many chapters it holds and how many levels open below
    it. That is everything the pages that *mention* a node need - the crumb
    trail up, the "zoom into this chapter" card with its chapter count, the note
    on the front page saying how far down it goes - so only the node you
    actually open has to be fetched, and it is fetched by level."""
    nar = data.get("narrative")
    if not isinstance(nar, dict) or not nar.get("nodes"):
        return 0
    nodes = nar["nodes"]

    def children(node):
        return [c["childId"] for c in (node.get("chapters") or []) if c.get("childId")]

    def deepest(node, seen=0):
        if seen > 8:
            return 0
        kids = [nodes[c] for c in children(node) if c in nodes]
        return 1 + max([deepest(k, seen + 1) for k in kids]) if kids else 0

    index, depths = {}, [len(nar.get("chapters") or [])]
    for nid, n in nodes.items():
        d = n.get("depth") or 0
        index[nid] = {"d": d, "p": n.get("parentId"), "t": n.get("title"),
                      "n": n.get("number"), "c": len(n.get("chapters") or []),
                      "b": deepest(n)}
        while len(depths) <= d:
            depths.append(0)
        depths[d] += len(n.get("chapters") or [])

    by_depth = {}
    for nid, n in nodes.items():
        by_depth.setdefault(n.get("depth") or 0, {})[nid] = n

    jsdir = os.path.join(pdir, "data", "js")
    os.makedirs(jsdir, exist_ok=True)
    # Levels that no longer exist must not be left on disk to be fetched.
    for stale in glob.glob(os.path.join(jsdir, "story-*.js")):
        os.remove(stale)
    for d, group in sorted(by_depth.items()):
        with open(os.path.join(jsdir, f"story-{d}.js"), "w", encoding="utf-8") as f:
            f.write("window.SKIM_STORY = window.SKIM_STORY || {};\n")
            f.write("window.SKIM_STORY[" + json.dumps(pid) + "] = Object.assign("
                    "window.SKIM_STORY[" + json.dumps(pid) + "] || {}, "
                    + json.dumps(group, ensure_ascii=False) + ");\n")

    nar.pop("nodes")
    nar["index"] = index
    nar["depths"] = depths
    nar["levels"] = max(by_depth) if by_depth else 0
    return len(nodes)


def main():
    register = load(os.path.join(ROOT, "register.json"), {"papers": {}})
    with open(os.path.join(ROOT, "register.js"), "w", encoding="utf-8") as f:
        f.write("window.SKIM_REGISTER = " + json.dumps(register, ensure_ascii=False) + ";\n")

    links, counts, owners = {}, {}, {}

    for pid in register["papers"]:
        pdir = os.path.join(ROOT, "papers", pid)
        data = {}
        for part in PARTS:
            raw = load(os.path.join(pdir, "data", part + ".json"), None)
            if raw is None:
                data[part] = None if part in ("narrative", "insights", "summary") else []
            elif isinstance(raw, dict) and part in raw:
                data[part] = raw[part]          # e.g. {"concepts": [...]}
            else:
                data[part] = raw
        data["refs"] = load(os.path.join(pdir, "refs.json"), {"accessed": []})
        # Where each block sits on the PDF page. Scripted rather than authored,
        # so it lives under ingest/ and is picked up from there.
        reg = load(os.path.join(pdir, "data", "ingest", "regions.json"), None)
        data["regions"] = reg["regions"] if reg else []
        data["pdfPages"] = reg["pages"] if reg else 0
        # A PDF or a page on the web. The reader opens a different file and
        # cites differently for each; nothing else in the viewer cares.
        data["readerKind"] = (reg or {}).get("kind", "pdf")
        # Section titles, so the reader can name where a block sits without
        # every surface having to carry the title itself.
        sec = load(os.path.join(pdir, "data", "ingest", "sections.json"), None)
        data["sections"] = [{"id": x["id"], "title": x["title"]}
                            for x in (sec or {}).get("sections", [])]
        os.makedirs(os.path.join(pdir, "data", "js"), exist_ok=True)
        # Before the bundle is written: this lifts the node bodies out of it.
        split = split_story(pid, pdir, data)
        out = os.path.join(pdir, "data", "js", "bundle.js")
        with open(out, "w", encoding="utf-8") as f:
            f.write("window.SKIM_PAPERS = window.SKIM_PAPERS || {};\n")
            f.write("window.SKIM_PAPERS[" + json.dumps(pid) + "] = "
                    + json.dumps(data, ensure_ascii=False) + ";\n")
        link_entries(pid, data, links, owners)
        counts[pid] = len(data.get("concepts") or [])

        print(f"bundled {pid}: " + ", ".join(
            f"{k}={len(v) if isinstance(v, list) else ('yes' if v else 'no')}"
            for k, v in data.items() if k != "refs"))

    shared = {k: v for k, v in owners.items() if len(v) > 1}
    with open(os.path.join(ROOT, "links.js"), "w", encoding="utf-8") as f:
        f.write("window.SKIM_LINKS = " + json.dumps(
            {"ids": links, "counts": counts, "shared": shared}, ensure_ascii=False) + ";\n")
    print(f"links.js: {len(links)} ids across {len(counts)} papers, "
          f"{len(shared)} of them in more than one")

    prerender()


def prerender():
    """Rebuild viewer/papers.html from what was just bundled."""
    node = shutil.which("node")
    if not node:
        print("! node not found - viewer/papers.html NOT rebuilt. "
              "Run `node pipeline/prerender.mjs` before committing.")
        return
    script = os.path.join(ROOT, "pipeline", "prerender.mjs")
    sys.stdout.flush()   # else our buffered lines land after the child's
    try:
        subprocess.run([node, script], cwd=ROOT, check=True)
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"prerender failed ({e.returncode}); viewer/papers.html is stale")


if __name__ == "__main__":
    main()
