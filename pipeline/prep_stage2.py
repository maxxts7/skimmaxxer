"""One-off prep: cited-reads config + compact concept index for stage-2 prompts."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TASK_OUT = r"C:\Users\44759\AppData\Local\Temp\claude\C--Users-44759-Desktop-SkimReconstruct\1bdcc7a2-3654-4c9f-8fff-386842c51930\tasks\wmcg9uvbj.output"

out = json.load(open(TASK_OUT, encoding="utf-8"))
cr = out["result"]["merged"]["citedReads"]
json.dump(cr, open(os.path.join(ROOT, "pipeline", "cited-reads.json"), "w", encoding="utf-8"),
          indent=1, ensure_ascii=False)

cs = json.load(open(os.path.join(ROOT, "papers", "1706.03762", "data", "concepts.json"), encoding="utf-8"))["concepts"]
idx = os.path.join(ROOT, "papers", "1706.03762", "data", "ingest", "concept-index.txt")
with open(idx, "w", encoding="utf-8") as f:
    for c in cs:
        tier = "major" if c["tier"] == "major" else "minor"
        if c.get("floor"):
            tier += " floor"
        f.write(f"{c['id']} | {c['name']} | {tier} | {c['summary'][:110]}\n")
print("cited-reads.json + concept-index.txt written,", len(cs), "concepts")
