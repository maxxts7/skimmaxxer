"""Find (and optionally fix) places where a concept is named in prose but not linked.

The project's promise is that no prerequisite term is left unreachable. Agents
link the terms they think of; this pass catches the ones they missed.

Policy, deliberately conservative:
  - only the FIRST unlinked mention in a text, and only if that concept is not
    already linked somewhere in the same text
  - never inside existing [[links]], $math$, `code`, or markdown link text
  - never a self-link (a page about X does not link X)
  - only distinctive surface forms: multi-word names, or ALL-CAPS abbreviations

usage: python pipeline/autolink.py [--write]
"""
import json
import os
import re
import sys

from paper import paper_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = paper_id()
D = os.path.join(ROOT, "papers", MAIN, "data")
WRITE = "--write" in sys.argv

# too generic to auto-link: they appear constantly as ordinary words
STOP = {
    "attention-mechanism", "self-attention", "softmax", "transformer", "d-model",
    "sequence-transduction", "machine-translation", "language-modeling",
    "recurrent-neural-network", "sub-layer", "attention-head", "n-layers",
    "encoder-stack", "decoder-stack", "token-embeddings", "adam-optimizer",
    "auto-regressive-generation", "residual-connection", "compatibility-function",
    "queries-keys-values", "perplexity", "bleu", "model-ensembling",
}


def load(pid, name, default):
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw


register = json.load(open(os.path.join(ROOT, "register.json"), encoding="utf-8"))["papers"]
concepts = load(MAIN, "concepts", [])
cited = []
for pid in register:
    if pid != MAIN:
        cited += load(pid, "concepts", [])
items = load(MAIN, "items", [])


def aliases(c):
    """Surface forms worth matching for one concept."""
    out = set()
    name = c["name"]
    m = re.match(r"^(.*?)\s*\(([^)]+)\)\s*$", name)
    base, paren = (m.group(1), m.group(2)) if m else (name, None)
    if re.match(r"^[A-Za-z][A-Za-z0-9 ,'\-]+$", base) and " " in base.strip():
        out.add(base.strip())
    if paren and re.match(r"^[A-Z][A-Za-z]{1,9}$", paren) and paren.isupper():
        out.add(paren)
    slug = c["id"].replace("-", " ")
    if " " in slug and len(slug) > 8:
        out.add(slug)
    # hyphen/space variants
    for a in list(out):
        if "-" in a:
            out.add(a.replace("-", " "))
        if " " in a:
            out.add(a.replace(" ", "-"))
    # keep multi-word phrases, and ALL-CAPS abbreviations like BPE / GNMT
    return {a for a in out
            if len(a) >= 5 or (a.isupper() and 2 <= len(a) <= 6)}


OWNER = {c["id"]: MAIN for c in concepts}
for pid in register:
    if pid != MAIN:
        for c in load(pid, "concepts", []):
            OWNER[c["id"]] = pid

ALIAS = {}
for c in concepts + cited:
    if c["id"] in STOP or c.get("floor"):
        continue
    for a in aliases(c):
        ALIAS.setdefault(a.lower(), set()).add(c["id"])
# an alias that maps to more than one concept is ambiguous - drop it
ALIAS = {a: next(iter(v)) for a, v in ALIAS.items() if len(v) == 1}
PATTERNS = sorted(ALIAS, key=len, reverse=True)

MASK = re.compile(r"\[\[[^\]]*\]\]|\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`\n]*`|\[[^\]]*\]\([^)]*\)")


def linked_ids(text):
    return {m.group(1).strip() for m in re.finditer(r"\[\[([^\]|]+)(?:\|[^\]]*)?\]\]", text)}


def fix(text, self_id, where, log, owner=MAIN):
    """owner = the paper this text belongs to. Each paper stands independently,
    so a cited paper's prose may only link to concepts that paper owns."""
    if not text:
        return text
    have = linked_ids(text)
    # blank out regions we must not touch, keeping offsets intact
    safe = MASK.sub(lambda m: "\x00" * len(m.group(0)), text)
    edits = []
    for alias in PATTERNS:
        cid = ALIAS[alias]
        if cid == self_id or cid in have:
            continue
        if OWNER.get(cid) != owner:
            continue
        for m in re.finditer(r"(?<![\w-])" + re.escape(alias) + r"(?![\w-])",
                             safe, 0 if alias.isupper() else re.I):
            if "\x00" in safe[m.start():m.end()]:
                continue
            if any(not (m.end() <= s or m.start() >= e) for s, e, _, _ in edits):
                continue
            edits.append((m.start(), m.end(), cid, text[m.start():m.end()]))
            have.add(cid)
            log.append((where, cid, text[m.start():m.end()]))
            break
    for s, e, cid, surface in sorted(edits, reverse=True):
        rep = f"[[{cid}]]" if surface.lower() == cid.replace("-", " ") else f"[[{cid}|{surface}]]"
        text = text[:s] + rep + text[e:]
    return text


log = []
changed = {"concepts": 0, "items": 0, "pages": 0, "narrative": 0}

for c in concepts:
    n = fix(c.get("explanation"), c["id"], "concept:" + c["id"], log)
    if n != c.get("explanation"):
        c["explanation"] = n
        changed["concepts"] += 1
for pid in register:
    if pid == MAIN:
        continue
    raw = json.load(open(os.path.join(ROOT, "papers", pid, "data", "concepts.json"), encoding="utf-8"))
    hit = False
    for c in raw["concepts"]:
        n = fix(c.get("explanation"), c["id"], "cited:" + c["id"], log, owner=pid)
        if n != c.get("explanation"):
            c["explanation"] = n
            changed["concepts"] += 1
            hit = True
    if hit and WRITE:
        json.dump(raw, open(os.path.join(ROOT, "papers", pid, "data", "concepts.json"), "w",
                            encoding="utf-8"), indent=1, ensure_ascii=False)

for it in items:
    n = fix(it.get("walkthrough"), it["id"], "item:" + it["id"], log)
    if n != it.get("walkthrough"):
        it["walkthrough"] = n
        changed["items"] += 1

pages_raw = json.load(open(os.path.join(D, "pages.json"), encoding="utf-8"))
for pg in pages_raw["pages"]:
    n = fix(pg["body"], pg["forId"], "page:" + pg["forId"], log)
    if n != pg["body"]:
        pg["body"] = n
        changed["pages"] += 1

nar = json.load(open(os.path.join(D, "narrative.json"), encoding="utf-8"))
def do(node, key):
    for ch in node["chapters"]:
        n = fix(ch["body"], None, key + ":" + ch["id"], log)
        if n != ch["body"]:
            ch["body"] = n
            changed["narrative"] += 1
do(nar, "root")
for nid, node in nar["nodes"].items():
    do(node, nid)

print(f"aliases in play: {len(ALIAS)}")
print(f"unlinked mentions found: {len(log)}")
for k, v in changed.items():
    print(f"  {k}: {v} texts changed")
by_c = {}
for _, cid, _ in log:
    by_c[cid] = by_c.get(cid, 0) + 1
print("\nmost-missed concepts:")
for cid, n in sorted(by_c.items(), key=lambda x: -x[1])[:15]:
    print(f"  {n:>3}x {cid}")
print("\nsample:")
for w, cid, surf in log[:15]:
    print(f"  {w}: '{surf}' -> {cid}")

if WRITE:
    json.dump({"concepts": concepts}, open(os.path.join(D, "concepts.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump({"items": items}, open(os.path.join(D, "items.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump(pages_raw, open(os.path.join(D, "pages.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    json.dump(nar, open(os.path.join(D, "narrative.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("\nWRITTEN")
else:
    print("\n(dry run - pass --write to apply)")
