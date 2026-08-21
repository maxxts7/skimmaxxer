# The Skimmaxxer Method

How to turn a research paper into an explainer web app, generalized from the first run.

Four docs, four jobs. [DESIGN.md](DESIGN.md) is *what the thing is*. [PLAYBOOK.md](PLAYBOOK.md) is
*what to do when a paper arrives* — the decisions and the gates. [WORKFLOW.md](WORKFLOW.md) is the
record for one specific paper. This one is *how it is produced*: the machinery, the principles
behind it, and what went wrong the first time.

## What it produces

A static site with two ways through one paper, and a reference layer underneath both.

- **A tour.** The paper front to back, in the order it tells it. Recursive: every chapter opens
  into a smaller narrative covering the same span at higher resolution, and that one does the
  same, until a branch bottoms out.
- **A second read.** Built from the *relationships* rather than the paper's own order. Its
  chapters are the things you only see when several connections sit side by side.
- **Underneath:** a page per major concept and per theme, a self-sufficient breakdown of every
  figure, table and equation, and every concept the paper leans on — including ones defined in
  papers it cites.

The promise the whole thing is built around: **no unexplained prerequisite term**. Anything above
the reader's assumed-knowledge floor is either explained in place or one click away.

## The shape of the pipeline

Stages run in order. Each writes its output to disk before the next starts, so any stage can be
re-run alone — which matters more than it sounds like it does.

| # | Stage | Agents | What it does |
|---|-------|--------|--------------|
| 0 | Ingest | scripted | PDF into per-section text, page renders, figure and table crops |
| 1 | Concepts | 3 + 1 merge | Recursive concept tree; the merge dedups and picks which citations to chase |
| 1b | Cited papers | 1 per paper | Narrow read: only the concepts the citing paper needs |
| 2 | Figures | 1 per item | Every term and number defined, so each figure stands on its own |
| 3 | Edges | 1 per lens | Relationships between concepts, figures and results |
| 4 | Themes | 2 | Group concepts into themes, edges into edge-themes |
| 5 | Pages | 1 per page | A page for each theme, edge-theme and major concept |
| 6 | Narrative | 1, then a fan-out per round | Root storyline, then recursive expansion until branches bottom out |
| 6e | Second read | 1 + fan-out | The insights narrative, spined on the edges |
| 7 | Quality gate | scripted | Every reference resolves; coverage; voice |

Three scripted passes run whenever content changes: **citations** (attach PDF page references),
**auto-link** (catch terms named but never linked), and **bundle** (JSON into what the viewer
loads).

One more runs when the voice changes rather than the content: **re-pace**, which rewrites existing
prose for rhythm only and is checked mechanically for loss.

## Principles

**Script everything deterministic.** Ingest, citations, auto-linking, coverage checks, the quality
gate — all code. Agents are for judgment only. This is the difference between a pipeline you can
re-run and a pile of one-off outputs, and it means most fixes cost seconds rather than agents.

**Give each agent a brief, not the dataset.** Before a fan-out, generate one small file per unit
holding exactly what that unit needs: the draft text, its neighbours, the relationships touching
it, which sections to read. An agent reading a focused brief beats one reading everything.

**Have agents return structured output against a schema.** Validation happens at the tool layer,
so a mismatch is retried rather than silently accepted downstream.

**Verify agent work mechanically.** Every stage that can be checked in code, is: edge endpoints
must resolve, every load-bearing edge must land in a theme, a re-pace must preserve every link id
and every number. Assume drift, then measure it.

**Rewrite rather than regenerate when style changes.** The researched content is the expensive
part and it is already validated. A pass that changes only rhythm, and is checked for what it
dropped, is safer and cheaper than running the pipeline again.

**Each paper stands independently.** A cited paper is read narrowly — only what the citing paper
needs — but what comes out is stored under *that* paper, in the same format as any paper's
concepts, and recorded in a shared register. One rule follows directly: a cited paper's prose
links only within its own paper. Otherwise reuse is impossible.

**Record what you skipped.** Every narrow read reports what it deliberately did not extract. The
second narrative reports which relationships it named but never developed. Coverage you cannot
audit is not coverage.

## What you decide per paper

These are the knobs. Everything else follows from them.

- **The audience floor.** The single most important choice. It decides where the recursion stops:
  a concept is broken down until its explanation uses nothing above the floor. Set it too low and
  you end up explaining gradient descent; too high and the core promise breaks.
- **Edge lenses.** Four worked well — depends-on, supported-by, is-instance-of, contrasts-with —
  and produced a balanced spread. Swap them for a paper whose interesting structure is different.
- **Narrative depth.** Adaptive beats fixed. Let each branch declare whether it still holds
  distinct sub-stories, and cap the depth. Fixed depth pads shallow branches and truncates deep ones.
- **Pace.** Dense or slow. Slow means one idea per sentence, unpack a term before naming it, walk
  the arithmetic rather than stating the result. It is not padding and not talking down, and it
  costs roughly 50% more words.
- **Tone.** Voice rules with an explicit banned-word list, enforced by the gate. Note that a rule
  like "say what the paper claims, not what is true" pushes the output toward skepticism. That is
  usually right, but it is a choice worth making deliberately rather than discovering later.
- **Page granularity.** Full pages for themes and major concepts; smaller concepts fold into their
  parent as expandable sections.

## The checks that matter

The quality gate is not polish. It is what makes the core promise true rather than aspirational.

- Every link, prerequisite, edge endpoint and theme member resolves to something routable.
- No cycles in the concept tree; every parent exists.
- Every major concept has a page; every figure has a walkthrough and a term list.
- Every load-bearing edge appears in a theme and in the second narrative.
- No banned words.
- On a re-pace: no link id and no number may disappear.

Run it after every stage. A clean gate at each step means a failure is always in the stage you
just ran.

## What broke

Worth expecting, because most of it will happen again.

**PDF extraction is heuristics all the way down.** The main architecture figure was a Form XObject
the drawing API could not see at all; the fix was to render the region and trim to non-white
pixels. Section headings arrived as separate text lines — "3.2" and "Multi-Head Attention" — so
headings had to be bucketed by vertical position and joined. A table-body detector misfired
because a table looks like a paragraph until you account for line length. Budget time here, and
verify crops by eye before any agent reads them.

**Browsers cache `file://` sub-resources hard.** Regenerating data and reloading shows stale
content, repeatedly and confusingly. Serve over local HTTP while developing.

**Agents link the terms they happen to think of.** That is not the same as linking all of them. A
mechanical auto-link pass found 86 concepts named in prose with no link to their page. Build it,
and be conservative: first mention only, never inside math or code, never a self-link, and drop
ambiguous surface forms rather than guessing.

**Watch your own detectors.** The first auto-link pass filtered candidate terms to five characters
or more, which silently discarded every abbreviation. It found 78 real problems and missed the one
that had actually been reported.

**Parallel branches do not know about each other.** Two branches of the recursion independently
descended into the same cited mechanism and explained it twice. Either accept it as honest
repetition — a reader arriving down either path needs it — or add a dedup pass between rounds.

**The reuse the design promises does not happen by itself.** The cited-papers stage took the merge's
citation list and read every entry with an arXiv id, without ever asking whether the project already
held that paper. On the second paper that meant re-fetching two papers already read for the first —
overwriting concepts the first paper's pages link into, and undoing the one thing per-paper ownership
exists to make possible. The stage now checks the register first, cross-links what is already there,
and fetches only what is genuinely new. Worth stating plainly: storing a cited paper's concepts under
that paper buys you nothing until something actually looks before reading.

**Long runs get interrupted.** Credits ran out mid-fan-out. Because every stage persists its output
and workflows can resume with completed agents replaying from cache, the cost was re-running the
failures rather than the whole stage.

## Running it on a new paper

The whole method is encoded as a saved workflow, `.claude/workflows/skimmaxxer.js`. Run it
with the paper's id and, if it is on arXiv, its id to fetch:

```
Workflow({ name: "skimmaxxer",
           args: { paperId: "2005.14165", arxivId: "2005.14165",
                   floor: "an ML practitioner ...",   // optional
                   pace: "slow",                       // or "dense"
                   maxDepth: 3 } })
```

It runs every stage in order, discovers its own fan-outs (the figure list, the cited papers, the
page targets all come back from earlier stages), and ends by serving the app and looking at it.
Every stage still writes to disk, so a failed run resumes with `resumeFromRunId` and only the
failures re-run.

Two things it cannot do for you. It reports the crop check rather than blocking on it, so read
that field. And it picks the three-way section split itself from the section list — worth a glance
if the paper is unusually structured.

Two things it cannot do for you. It reports the crop check rather than blocking on it, so read
that field. And it picks the three-way section split itself from the section list — worth a glance
if the paper is unusually structured.

To drive it by hand, or to know what to check while it runs, follow [PLAYBOOK.md](PLAYBOOK.md) —
the decisions to make up front, the gate at each stage, and what a failure at each point actually
means.

## Cost

One paper at this depth: roughly **180 agent runs**, dominated by the page fan-out, the recursive
narrative and the re-pace pass. Everything scripted is free and re-runnable.

The expensive, hard-to-redo part is the researched content. The cheap part is how it reads. Keep
those two separable — that is the whole reason re-pace exists as its own stage.

## Where things live

- `.claude/workflows/skimmaxxer.js` — the whole method as one runnable workflow.
- `pipeline/*.py` — the scripted stages. Every one reads the active paper from `SKIM_PAPER` or
  `pipeline/active.json`, so nothing is hardcoded to a particular paper.
- `papers/<id>/` — one paper's world: the PDF, its assets, its data, its `refs.json`, and its
  optional per-paper config (`equations.json`, `headings.json`, `crops.json`).
- `register.json` — every paper ever touched, main or cited, and what was extracted from it.
- `viewer/` — the static app. It reads generated JS bundles, so it opens from the filesystem.
