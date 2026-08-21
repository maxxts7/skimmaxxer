"""Which paper the pipeline is currently working on.

Resolution order: SKIM_PAPER env var, then pipeline/active.json. Every stage
script imports MAIN from here, so a run is retargeted by changing one thing.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def paper_id():
    v = os.environ.get("SKIM_PAPER")
    if v:
        return v.strip()
    cfg = os.path.join(ROOT, "pipeline", "active.json")
    if os.path.exists(cfg):
        return json.load(open(cfg, encoding="utf-8"))["paperId"]
    raise SystemExit(
        "No active paper. Set SKIM_PAPER=<id> or write pipeline/active.json "
        '({"paperId": "<id>"}).')


def paper_dir(pid=None):
    return os.path.join(ROOT, "papers", pid or paper_id())


def load_part(pid, name, default=None):
    """Read papers/<pid>/data/<name>.json, unwrapping {"<name>": [...]}"""
    p = os.path.join(ROOT, "papers", pid, "data", name + ".json")
    if not os.path.exists(p):
        return default
    raw = json.load(open(p, encoding="utf-8"))
    return raw[name] if isinstance(raw, dict) and name in raw else raw
