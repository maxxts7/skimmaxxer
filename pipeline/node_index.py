"""Write the flat node index the edge/theme/page agents read.

One line per linkable node: id | kind | tier | name | one-line summary.

By default the index holds only the active paper's own nodes, so nothing an
agent writes can link into another paper. Cross-paper connections belong on the
relations page, which is written deliberately rather than falling out of
whatever an agent happened to see in an index.

Pass --include-cited for the older behaviour, where every other paper's
concepts are offered as link targets. The first paper (1706.03762) was built
that way and would need the flag if its later stages were ever regenerated.
"""
import json
import os
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


def one_line(s, n=150):
    return " ".join(str(s or "").split())[:n]


def main():
    register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
    rows = []

    for c in load(MAIN, "concepts", []):
        tier = c["tier"] + (" floor" if c.get("floor") else "")
        parent = f" (part of {c['parent']})" if c.get("parent") else ""
        rows.append(f"{c['id']} | concept | {tier} | {c['name']}{parent} | {one_line(c['summary'])}")

    for i in load(MAIN, "items", []):
        rows.append(f"{i['id']} | {i['kind']} | evidence | {i['title']} | {one_line(i.get('takeaway'))}")

    if "--include-cited" in sys.argv:
        for pid, meta in register.items():
            if pid == MAIN:
                continue
            for c in load(pid, "concepts", []):
                rows.append(f"{c['id']} | cited-concept | from {meta['title']} | {c['name']} | {one_line(c['summary'])}")

    out = os.path.join(ROOT, "papers", MAIN, "data", "ingest", "node-index.txt")
    with open(out, "w", encoding="utf-8") as f:
        f.write("# id | kind | tier | name | summary\n")
        f.write("\n".join(rows) + "\n")
    print(f"node-index.txt: {len(rows)} nodes")


if __name__ == "__main__":
    main()
