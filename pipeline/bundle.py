"""Wrap pipeline JSON into JS bundles the static viewer can load over file://.

register.json            -> register.js          (window.SKIM_REGISTER = ...)
papers/<id>/data/*.json  -> papers/<id>/data/js/bundle.js  (window.SKIM_PAPERS[id] = ...)
papers/<id>/refs.json    -> included in the bundle
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = ["concepts", "items", "edges", "themes", "pages", "narrative", "insights", "reading"]


def load(path, default):
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return default


def main():
    register = load(os.path.join(ROOT, "register.json"), {"papers": {}})
    with open(os.path.join(ROOT, "register.js"), "w", encoding="utf-8") as f:
        f.write("window.SKIM_REGISTER = " + json.dumps(register, ensure_ascii=False) + ";\n")

    for pid in register["papers"]:
        pdir = os.path.join(ROOT, "papers", pid)
        data = {}
        for part in PARTS:
            raw = load(os.path.join(pdir, "data", part + ".json"), None)
            if raw is None:
                data[part] = None if part in ("narrative", "insights") else []
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
        out = os.path.join(pdir, "data", "js", "bundle.js")
        with open(out, "w", encoding="utf-8") as f:
            f.write("window.SKIM_PAPERS = window.SKIM_PAPERS || {};\n")
            f.write("window.SKIM_PAPERS[" + json.dumps(pid) + "] = "
                    + json.dumps(data, ensure_ascii=False) + ";\n")
        print(f"bundled {pid}: " + ", ".join(
            f"{k}={len(v) if isinstance(v, list) else ('yes' if v else 'no')}"
            for k, v in data.items() if k != "refs"))


if __name__ == "__main__":
    main()
