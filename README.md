# Skimmaxxer

A research paper is written for people who already understand it. Skimmaxxer takes one paper — a
PDF, or a page on the web — and produces a static site that re-explains it: every prerequisite term explained in place or one
click away, every figure readable on its own, and a narrative that puts the pieces back together.

**The promise, and it is the only one that matters: no unexplained prerequisite term.** Anything
above the reader's assumed-knowledge floor is explained where it is used or is one click away.
Every rule in these docs exists to keep that true.

## What comes out

- **Summary** — the paper's whole argument end to end, in one sitting. One flat page, the line of
  reasoning only, no figures and none of the evidence apparatus. Same floor as everything else: it
  uses the real names and glosses a term where the argument leans on it.
- **The story** — the paper front to back, in the order it tells it. Recursive: every chapter opens
  into a smaller narrative covering the same span at higher resolution, and that one does the same,
  until a branch runs out of distinct material.
- **Insights** — a second read over the same corpus, spined on the relationships rather than the
  paper's order. Each chapter is one thing you only see when several connections sit side by side.
- **The reference layer** — a page for every major concept and every theme, and a breakdown of
  every figure, table and equation that stands up without the paper next to it.
- **How to read the evidence** — one page per kind of chart the paper argues with: why that shape
  and not another, how to read it step by step, and what it would look like if the claim were
  false. Written once, linked from every figure that uses it.

## How it is made

Scripts pull per-section text, page images and figure crops out of the PDF — or, for a paper
published as a web page, freeze a copy of it, split it on its own headings and take the authors'
image files whole. Agents read the text and extract a recursive concept tree; where a concept is
really borrowed from a cited paper, that paper gets read narrowly too. More agents make each item
self-sufficient, explain each kind of chart the paper argues with, find the edges between
everything, and group concepts and edges into themes. Then a fan-out writes every page, one agent
writes the root story, another fan-out grows it downward round by round, one more builds the
second read, and a last agent writes the summary. Scripts finish the job: citations, auto-linking,
bundling, and a quality gate that has to come back clean.

How many agents a paper costs is a property of the paper: one per figure, table and equation, one
per major concept and theme, one per borrowed mechanism not already read, and one more for every
narrative chapter that earns another level. The summary is one agent whatever the paper. Everything
scripted is free and re-runnable, and every
stage writes its output to disk before the next starts, so any stage can be re-run alone.

Before the expensive fan-outs, one agent rates what each job in them is worth. It cuts back on two
grounds only — the job carries no claim, or it repeats something already covered properly — and it
decides on its own rather than stopping to ask. It never removes coverage: a job rated brief is
still written, still defines its terms, still gets its page. The exception is a narrative branch
that would restate its parent instead of going deeper, and not writing that is the right answer at
any price.

## The one decision

**The floor** — who is reading this, and what do they already know. It decides where the recursion
stops, and everything downstream inherits it. Write it as a sentence that names both sides: what to
assume, and what to explain anyway. Then test it on three terms from the method section; if you
cannot immediately say which side each falls on, it is too vague to hand to an agent.

## Each paper stands alone

Every concept a paper needs is explained on that paper's own pages. Where another paper in the
project explains the same thing, the concept carries a plain link across — a door, not a
prerequisite. That link is the whole of the connection between two papers.

Production is a separate matter: before reading a cited paper, check the register. A narrow read
already on disk is reused rather than fetched again.

## Where things live

- `pipeline/` — the scripted stages. Each reads the active paper from the environment, so nothing
  is hardcoded to one paper. An agent decides; a script moves. Anything bulky an agent produces is
  written to disk by that agent and read back by a script — never carried through a later agent's
  prompt.
- `papers/<id>/` — one paper's world: the PDF, its assets, its data, and its optional overrides.
- `register.json` — every paper ever touched, main or cited, and what was extracted from it.
- `viewer/` — the static app: a library page and one reader shell that serves any paper.
- `netlify/` — the only server-side code, for reader paper requests and the admin page behind them.

## Reading further

Same story, more resolution.

- **[WORKFLOW.md](WORKFLOW.md)** — how a run actually goes, in three pages.
- **[MANUAL.md](MANUAL.md)** — the full account: what every object is, every stage and its checks,
  the decisions per paper, and the rules that were learned the hard way.
