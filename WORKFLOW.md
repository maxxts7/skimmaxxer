# Skimmaxxer — Workflow

How a run goes, in three pages. [README.md](README.md) is the same story in one;
[MANUAL.md](MANUAL.md) is the same story with everything in it.

The whole flow in a breath: **pull the figures and text out of the paper, run agents over the text to
extract the concepts, scope any cited paper the concepts lean on, find the edges between everything
and group it into themes. Then fan out to write the concept and theme pages, write the main story,
fan out again to grow that story downward, and once more for a second read built on the edges.**
Everything below is that sentence, slowed down.

## Before anything: set the floor

One decision comes first, because every stage inherits it: **who is reading this, and what do they
already know?** A concept is broken down until its explanation uses nothing above the floor, so the
floor is what decides where the recursion stops. Set it too low and you spend the run explaining
gradient descent; set it too high and the promise breaks.

Write it as a sentence naming both sides — what to assume, and what to explain anyway. "An ML
practitioner" is not enough: a practitioner knows softmax but probably could not tell you how BLEU
is computed.

Four smaller choices come with it, all changeable later: which lenses to look for relationships
through, how deep the narrative may recurse, how slow the prose should read, and how far to follow
citations. Sensible defaults are four lenses, a depth cap of three, and one level of citations.

One of those four is not as changeable as it looks. **Decide the pace before the page fan-out.**
Changing your mind afterwards means re-pacing everything, which costs more than every other stage
put together. There is a stage for exactly that, so it is recoverable — it is just the one expensive
mistake available in the sequence.

## The stages

Each stage writes its output to disk before the next starts, so any one can be re-run alone. That
matters more than it sounds like it does.

| # | Stage | Agents | What it does |
|---|-------|--------|--------------|
| 0 | Ingest | scripted | PDF into per-section text, page renders, figure and table crops — or a web page into a frozen copy, its own headings, and the authors' image files |
| 1 | Concepts | 3 + 1 merge | The recursive concept tree; the merge dedups and picks which citations to chase |
| 1b | Cited papers | 1 per paper | Narrow read: only the concepts the citing paper needs |
| 2 | Items | 1 per item | Every term and number in a figure, table or equation defined |
| 2b | Charts | 1 per kind of plot | Why this shape, how to read it, what a bad result looks like |
| 3 | Edges | 1 per lens | Relationships between concepts, items and results |
| 4 | Themes | 2 | Concepts into themes, edges into edge-themes |
| 5 | Pages | 1 per page | A page for every theme, edge-theme and major concept |
| 6 | Narrative | 1, then a fan-out per round | The root story, then recursive expansion until branches bottom out |
| 6e | Insights | 1 + fan-out | The second read, spined on the edges |
| 7 | Quality gate | scripted | Every reference resolves; coverage; no duplicate ids |

Three scripted passes run whenever content changes — **citations** (attach a PDF page reference to
every surface), **auto-link** (catch terms named in prose but never linked), and **bundle** (JSON
into what the viewer loads). A fourth, **re-pace**, runs only when the voice changes rather than the
content: it rewrites existing prose for rhythm and is checked mechanically for what it dropped.

## Before a fan-out: what each job is worth

A fan-out is where a run spends its money, and its size is a property of the paper rather than
anything anyone chose. But the jobs inside one are not equal. Some carry a claim the argument rests
on; some are a screenshot of the authors' tooling; some are the fourth near-identical version of a
chart already explained three times.

So before the expensive fan-outs — the cited reads, the pages, and each round of both narratives —
**one agent rates every job in it: full, brief, or skipped.** It cuts back on two grounds and no
others: *the job carries no claim*, or *it repeats something already covered properly*. Not on how
long it looks, how interesting it seems, or how much work it would be. It decides on its own and
reports afterwards; nothing waits on you.

What it never does is remove coverage. A job rated brief is still written, still defines every term
that appears only there, and still gets its page — it is a shorter telling that leans on the fuller
one and links to it. Every promise the gate checks survives triage untouched.

Skipping is allowed in exactly two places, because in both it is the right answer rather than a
saving. A **cited paper** cited for agreement or context rather than for a mechanism this paper
borrows: the register already models a paper the project does not hold, so it simply stays unread.
And a **narrative branch whose child would restate its parent** — the characteristic failure of the
whole recursive structure, and the thing you are told to check by hand at the end of a run. Checking
it before the round costs one agent and can save a level.

The figure fan-out is deliberately not guarded. Every figure, table and equation gets the full
treatment, because a figure that cannot be read where it sits is the failure the project exists to
fix.

## The four moments that need your eyes

Most of the run is unattended. Four points are not, and each sits where a mistake is still cheap.

**After ingest, look at the crops.** This is the most important manual moment in the process. Every
stage downstream reads this output and not one of them can tell that a figure was cut in half or
that a table crop stopped after the header row. If the section list comes back as one blob instead
of twenty sections, the heading detector did not fire on this layout, and here is where you fix it.

**After the merge, read the list of major concepts.** Twelve to twenty of them, about to become
thirty-odd pages and the spine of both narratives. Read it as a table of contents. Anything missing,
anything in there that is not load-bearing? This is the cheapest place in the run to fix a
structural problem.

**During the page fan-out, read two of the thirty.** Not for accuracy — the gate covers that — but
for register. If two are wrong in the same way, all thirty are, and it is a prompt fix rather than
an editing job.

**At the end, read it as a reader would.** Open the front page, follow a link, zoom into a chapter,
come back out, look something up. You are hunting for what passes every check and is still wrong: a
link that lands somewhere unhelpful, a chapter that ends without pointing anywhere, a page that
assumes you read the previous one.

One more check costs a minute and catches the characteristic narrative failure: pick a child node
and its parent and confirm the child genuinely goes deeper. A child that restates its parent in
different words means that branch should not have expanded at all.

## Each paper stands alone

Every concept a paper needs is explained on that paper's own pages. A reader who opens the paper and
never clicks anything still learns what byte-pair encoding is. Where another paper in the project
explains the same thing, the concept carries a plain link across — a door, not a prerequisite, and
nothing more elaborate than that. There is no page that gathers up the connections between two
papers.

Ids are global and the viewer indexes on them, so a duplicate is dropped silently rather than
raising anything. A new paper takes clean slugs and adds a short paper suffix only where one would
collide. Nothing is renamed retroactively, the merge checks every proposed id against the global
set, and the gate fails on duplicates rather than letting the viewer swallow them.

Production reuse is a separate matter from what the reader sees. Before fetching a cited paper,
check the register: if a narrow read already exists, use it, and extend it only if this run needs
something it did not cover. Storing a cited paper's concepts under that paper buys nothing until
something actually looks before reading.

## The checks that matter

The gate is not polish; it is what makes the promise true rather than aspirational. Every link,
prerequisite, edge endpoint, theme member and child pointer resolves. No cycles in the concept tree.
Every major concept has a page, every item has a walkthrough and a term list. Every load-bearing
edge appears in a theme and in the second read. No duplicate ids. On a re-pace, no link id and no
number may disappear.

Voice is not among them. Every writing agent is told to use plain words and given the list to
avoid, and a word list applied afterwards catches the word rather than the writing — it once failed
a run over two uses of "powerful" that read perfectly well. Instruct it at the point of writing;
do not police it at the end.

Run it after every stage. A clean gate at each step means a failure is always in the stage you just
ran.

## Running it

The stages run in order from `pipeline/`, retargeted at a paper with one environment variable. What
the run needs — the paper's id, its arXiv id if it has one, the floor, the pace and the depth cap —
is settled up front and inherited from there.

The fan-outs are discovered rather than declared: the item list comes out of ingest, the cited
papers out of the merge, and the page targets out of the themes. The size of each stage is known
only once the one before it has finished. And because every stage writes to disk, a run that dies
partway picks up from the last stage that completed, and re-running one stage leaves the rest alone.

Two things nothing will do for you. The crop check is yours to make by eye. And the three-way
section split handed to the extractors is worth a glance if the paper is unusually structured.

## Cost

Count the agents from the paper in front of you, not from a past run. Ten are fixed: three
extractors and a merge, one per lens, two for themes. Everything else is a property of this paper —
one per figure, table and equation; one per borrowed mechanism the register does not already hold;
one per major concept, theme and edge-theme; one for the root story and one for every chapter that
earns another level; then the same shape again, smaller, for the second read. A re-pace adds one per
prose unit on top of all of it.

The estimate arrives early. The item count is known after ingest and the major-concept count after
the merge, and those two fix the size of the biggest fan-outs before any of them run. A paper that
is short but heavy on evaluation costs more than its page count suggests; a long paper whose method
is mostly borrowed costs less. Everything scripted is free.

Two rules keep the bill honest, and both were learned by breaking them. **An agent decides, a
script moves**: anything bulky an agent produces is written to disk by that agent and read back by
a script, never pasted into a later agent's prompt. A stage that hands an agent a large blob and
gets it back roughly unchanged is a script's job — that mistake once cost a quarter of a run in
transcription alone. And **a resume only reuses what it recognises**: change a prompt at or before
a completed stage and every agent after it re-runs, so when picking a run back up, edit only what
comes after the last result you want to keep.

The researched content is the expensive, hard-to-redo part; how it reads is the cheap part. Keeping
those two separable is the whole reason re-pace exists as its own stage — when the style needs to
change, rewrite rather than regenerate.
