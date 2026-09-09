# Skimmaxxer — Workflow

How a run goes, in three pages. [README.md](README.md) is the same story in one;
[MANUAL.md](MANUAL.md) is the same story with everything in it.

The whole flow in a breath: **pull the figures and text out of the paper, run agents over the text to
extract the concepts, scope any cited paper the concepts lean on, find the edges between everything
and group it into themes. Then fan out to write the concept and theme pages, write the main story,
fan out again to grow that story downward, once more for a second read built on the edges, and one
last page carrying the whole argument end to end.**
Everything below is that sentence, slowed down.

## Before anything: set the floor

One decision comes first, because every stage inherits it: **who is reading this, and what do they
already know?** A concept is broken down until its explanation uses nothing above the floor, so the
floor is what decides where the recursion stops. Set it too low and you spend the run explaining
gradient descent; set it too high and the promise breaks.

Write it as a sentence naming both sides — what to assume, and what to explain anyway. "An ML
practitioner" is not enough: a practitioner knows softmax but probably could not tell you how BLEU
is computed.

The floor binds every surface, the Summary included. What separates that one is shape rather than
level: it uses the same vocabulary as the story and carries the whole argument in one flat page,
without the figures or the evidence apparatus. Writing it *below* the floor was tried and read as
condescension — paraphrasing "ReLU" into "the step that zeroes out negatives" costs the reader the
word they need to go anywhere else.

Four smaller choices come with it, all changeable later: which lenses to look for relationships
through, how deep the narrative may recurse, how slow the prose should read, and how far to follow
citations. Sensible defaults are four lenses, a depth cap of three, and one level of citations.

One of those four is not as changeable as it looks. **Decide the pace before the page fan-out.**
Changing your mind afterwards means re-pacing everything, which costs more than every other stage
put together. There is a stage for exactly that, so it is recoverable — it is just the one expensive
mistake available in the sequence.

A fifth choice is made for you unless you go and change it: the register. It is not an argument, it
lives in the workflow's voice block, and it is formal by default — third person, no contractions, no
imperatives aimed at the reader, and quoted material reproduced exactly as the paper printed it,
contractions and all. Changing it after the fact costs the same as a re-pace, because it is one.

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
| 2c | Deepen | 1 per major concept | The tree read the other way up: what is still unexplained inside each branch |
| 3 | Edges | 1 per lens | Relationships between concepts, items and results |
| 4 | Themes | 2 | Concepts into themes, edges into edge-themes |
| 5 | Pages | 1 per page | A page for every theme, edge-theme and major concept |
| 6 | Narrative | 1, then a fan-out per round | The root story, then recursive expansion until branches bottom out |
| 6e | Insights | 1 + fan-out | The second read, spined on the edges |
| 6f | Summary | 1 | One flat page carrying the whole argument, read in one sitting |
| 6g | Paragraph column | 1 small call per paragraph | Which of a section's concepts each paragraph leans on, for the PDF reader |
| 7 | Quality gate | scripted | Every reference resolves; coverage; no duplicate ids within a paper |

Three scripted passes run whenever content changes — **citations** (attach a PDF page reference to
every surface), **auto-link** (catch terms named in prose but never linked), and **bundle** (JSON
into what the viewer loads). Bundle finishes by running **prerender**, which rebuilds
`viewer/papers.html` with the shelf already written into it: the library page is the same for every
visitor and changes only when the pipeline runs, so it is generated here rather than assembled in
the browser out of every paper's bundle. Edit `viewer/papers.template.html`, never `papers.html`.

Bundle writes three kinds of file, and a reader shell loads only what it is reading. The **bundle**
is one paper. **`links.js`** is every id in the project — its name, kind, owning paper and summary —
so a link into another paper draws immediately and is searchable without that paper being present;
following one fetches it. **`story-<level>.js`** holds the story's node bodies for one level of
zoom, which are most of a paper's prose and almost none of what a reader opens; what stays in the
bundle is `narrative.index`, enough to draw a crumb trail, a zoom card and its chapter count
without the bodies. Opening a paper used to cost every bundle in the project; it now costs one
bundle minus its deeper levels, plus the index. A fourth, **re-pace**, runs only when the voice or the pace changes
rather than the content: it rewrites existing prose and is checked mechanically for what it dropped.
It is its own workflow, `repace.js`, alongside `skimmaxxer.js`.

Two rows come with a caveat. **Deepen** is append-only by construction — it can add leaves under an
existing branch and nothing else — which is what lets it run this late, after the figure agents have
already linked terms to concept ids. And the **paragraph column** has not been run for any paper
yet: the reader falls back to showing the section's whole concept list, which is the pool the
ranking would be drawn from anyway. It needs only concepts and the regions ingest wrote, so it can
be run at any point after the merge, on its own.

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
explains the same thing, the concept carries a plain link across — a door, not a prerequisite. One
page per paper is allowed to look outward: a **relations page**, written by hand, saying how this
paper sits among its neighbours. It is the only surface whose links may leave the paper, and a paper
without one simply has no such page.

Ids are the routing keys, and the viewer indexes the paper being read first — its own concepts claim
their ids and every other paper's bundle fills in the rest. So two papers using the same slug for
the same idea is the design working, and it is not checked. What is checked is a duplicate *within*
one paper: there the second concept silently never renders, which is a defect and a quiet one.
Nothing is renamed retroactively, and a new paper takes clean slugs.

Production reuse is a separate matter from what the reader sees. Before fetching a cited paper,
check the register: if a narrow read already exists, use it, and extend it only if this run needs
something it did not cover. Storing a cited paper's concepts under that paper buys nothing until
something actually looks before reading.

## The checks that matter

The gate is not polish; it is what makes the promise true rather than aspirational. Every link,
prerequisite, edge endpoint, theme member and child pointer resolves. No cycles in the concept tree.
Every major concept has a page, every item has a walkthrough and a term list. Every load-bearing
edge appears in a theme and in the second read. No id used twice within one paper.

Two things are checked elsewhere and are easy to file here by mistake. A re-pace is checked by its
own save script, which reports every link id and every number that was there before and is not there
after. And source references are written by the citations pass on every surface, with nothing
afterwards confirming they arrived.

Voice is not among them. Every writing agent is told to use plain words and given the list to
avoid, and a word list applied afterwards catches the word rather than the writing — it once failed
a run over two uses of "powerful" that read perfectly well. Instruct it at the point of writing;
do not police it at the end.

Run it after every stage. A clean gate at each step means a failure is always in the stage you just
ran.

## Running it

The whole run is one workflow — `.claude/workflows/skimmaxxer.js`, thirteen phases from ingest to
the finishing scripts. The prompts live there; the deterministic work lives in `pipeline/`,
retargeted at a paper with one environment variable. What the run needs — the paper's id, its arXiv
id if it has one, whether it is a PDF or a web page, the floor, the pace and the depth cap — is
settled up front and inherited from there. A cited read the run must not make can be named up front
too, and is then treated exactly as a triage skip.

The fan-outs are discovered rather than declared: the item list comes out of ingest, the cited
papers out of the merge, and the page targets out of the themes. The size of each stage is known
only once the one before it has finished. And because every stage writes to disk, a run that dies
partway picks up from the last stage that completed, and re-running one stage leaves the rest alone.

Two things nothing will do for you. The crop check is yours to make by eye. And the three-way
section split handed to the extractors is worth a glance if the paper is unusually structured.

## Cost

Count the agents from the paper in front of you, not from a past run. Eleven are fixed: three
extractors and a merge, one per lens, two for themes, and one for the summary. Everything else is a
property of this paper — one per figure, table and equation; one per borrowed mechanism the register
does not already hold; one per major concept twice over, once to deepen its branch and once to write
its page; one per theme and edge-theme; one for the root story and one for every chapter that earns
another level; then the same shape again, smaller, for the second read. A re-pace adds one per prose
unit on top of all of it.

The estimate arrives early. The item count is known after ingest and the major-concept count after
the merge, and those two fix the size of the biggest fan-outs before any of them run. How many
concepts are called major is therefore the one decision that moves the bill twice. A paper that
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
