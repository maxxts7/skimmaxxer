# Skimmaxxer — Manual

The full account: what the thing is, what every part of it holds, how each part gets produced, what
is checked, and which rules were learned by getting them wrong. [README.md](README.md) is this in a
page; [WORKFLOW.md](WORKFLOW.md) is this in three. Nothing here contradicts those — it is the same
story with the detail put back in.

Written to be handed to an agent, so it says what each step must produce rather than assuming
anyone remembers.

---

## 1. The problem

A research paper is written for people who already understand it. It compresses. A term is used
before it is defined, or never defined at all because the audience is assumed to know it. A figure
means nothing without three paragraphs of body text. The reasoning connecting one design choice to
another is spread across sections that never reference each other. And the paper's order — abstract,
method, experiments — is the order of publication, not the order of understanding.

Four failures, and they are different failures:

1. **Unexplained prerequisites.** The reader hits a term and stops.
2. **Non-self-sufficient evidence.** A figure cannot be read where it sits.
3. **Invisible reasoning.** Why a choice was made, and what it cost, is never stated in one place.
4. **One fixed path.** A single route through, at a single level of detail.

## 2. The response

Four structures, one per failure.

1. **A recursive concept tree with an explicit floor.** Every term above the floor is explained; a
   concept too large to explain in one breath contains smaller ones, recursively, until each bottoms
   out at the floor.
2. **Self-sufficient evidence items.** Every figure, table and equation carries a definition of
   every term and every number in it, plus what it establishes.
3. **A typed relationship graph.** Explicit, explained edges between concepts, evidence and results
   — the reasoning the paper leaves implicit, turned into objects.
4. **Two narratives over one corpus, each recursive.** One follows the paper's order; one follows
   the graph. Each chapter opens into a smaller narrative of the same span at higher resolution.

## 3. Invariants

Non-negotiable. If one fails, the design has failed rather than degraded.

- **No unexplained prerequisite term.** Anything above the floor is explained in place or is one
  click away. This is the product.
- **Every reference resolves.** No link, prerequisite, edge endpoint, theme member or child pointer
  may name something that does not exist.
- **Every claim is traceable.** Every surface cites the page of the source PDF it came from.
- **Each paper stands alone.** Every concept a paper needs is explained on that paper's own pages,
  and reads without reference to any other paper in the project.
- **Evidence strength is never inflated.** Where the source hedges, the explainer hedges. Where a
  claim rests on one example rather than a measurement, that is said.
- **Coverage is auditable.** Anything deliberately skipped is recorded and shown, not silently
  dropped.

---

## 4. What a paper holds, and where each part comes from

Eight kinds of object. Ids are globally unique kebab-case slugs and are the only means of reference
— there are no positional or index-based links anywhere in the data.

### The paper and the register

The unit of ownership. One entry per paper ever touched, in a single shared register at the top of
the tree, holding its title, authors, source, status and when it was added. Status is either the
full treatment or a narrow read done because a citing paper needed something from it. A narrow read
also records what was extracted, which papers cite it, and — in prose — what was deliberately left
out.

Produced by: ingest for the main paper, the cited-papers stage for narrow reads. The register is
appended to, never rewritten.

### Concept

The atom. Concepts form a tree by parent and a directed graph by prerequisite.

Each carries a name, a one-or-two-sentence summary, an explanation, its prerequisites, the sections
it came from, and two flags that decide how it renders. **Tier** is major or minor: a major concept
earns its own page, a minor one renders inside its parent as an expandable section. **Floor** marks
a concept at or below the reader's assumed knowledge — kept as a short stub, never broken down, and
never major.

Two more fields handle a borrowed mechanism. One records that the paper cites someone else for it —
that is the paper's own citation, drawn from its reference list. The other is a pointer at another
paper's account of the same thing inside this project, and it is what a cross-paper link is made of.

The summary does more work than it looks like it does: it is used as a lede, as card text, and in
hover popovers, so it has to survive being read out of context and has to stay short.

Produced by: three extractor agents plus a merge, stage 1.

### Item

A figure, table or equation, made to stand alone.

Each has a kind and number, the original caption, the page it sits on, its cropped asset, a real
title, a stated takeaway, and a walkthrough. Then the two lists that do the work: **every** term —
symbol, axis, legend entry, row and column header, model name — with a definition and a link to a
concept where one matches; and **every** number or family of numbers with what it means.

An item from a web paper carries two more things: an anchor into the frozen copy in place of a page
number, and `captionInferred` where the caption is the sentence that introduced the figure rather
than the authors' own words. A plot also carries a `chartId` pointing at the page that explains its
shape.

The title is a name, not "Figure 3"; the printed number is derived. Figures are never redrawn — the
asset is the original crop, because fidelity beats prettiness. Equations get no crop; they are
re-typeset from their source, so they carry the markup instead.

The test is literal: cover the paper, read only the item page, and see whether you can interpret any
cell of that table or name every box in that diagram.

Produced by: one agent per item, stage 2, after the concepts exist so it has something to link into.

### Edge

A relationship, as a first-class object with its own explanation.

An edge has a source, a target, a type, a concrete label, an explanation of why it exists and what
the reader learns from it, and a strength. Types come from a small fixed set of lenses; the default
four are depends-on, supported-by, instance-of and contrasts-with. Strength is load-bearing — the
argument collapses without it — or supporting, or minor. Coverage rules key off strength. Endpoints
may be concepts or items.

Produced by: one agent per lens, stage 3.

### Theme

A grouping, of one of two kinds: a concept theme whose members are concepts, or an edge theme whose
members are edges. Each has a name, a summary, its members and a reading order. Membership is
exclusive — nothing belongs to two themes.

Produced by: two agents, stage 4.

### Page

Authored prose for a theme, an edge theme or a major concept. The body is markdown with wiki-links
and math. A page never repeats what the app renders around it: not the summary above it, not the
sub-concepts below it, not its member edges.

Produced by: one agent per page, stage 5 — the big fan-out.

### Narrative node

A recursive telling. The root covers the whole span; each node retells one chapter of its parent at
higher resolution, with its own chapters. A chapter points at its child node, and that pointer is
the recursion. Chapter numbers are dotted, so depth is always legible on the page.

Depth is adaptive: a branch expands only while it holds distinct sub-stories.

Produced by: one agent for the root and a fan-out per round, stage 6; the same shape again for the
second read at 6e, where each chapter also declares the edges it draws on.

### Source reference

Attached to every surface: the sections and PDF pages the material came from, or a paper and a note
when it belongs to a cited paper.

Concepts and items know their own. Themes, pages and narrative chapters **derive** theirs from what
they link to, so a citation stays correct as long as the links do.

Produced by: the scripted citations pass, re-run whenever content changes.

### How they relate

```
Register ──owns──> Paper
                     │
   ┌─────────────────┼──────────────────┐
   │                 │                  │
Concept           Item               (another paper)
   │ parent          │ terms → concepts    │
   │ prerequisites   │                     │ cross-paper link
   └────────┬────────┴─────────────────────┘
            │
          Edge (source, target)
            │
   ┌────────┴────────┐
Theme            Edge-theme
   │                 │
   └────────┬────────┘
          Page (for one of them)
            │
   Story    ── chapters ── child ──> Narrative node ──> ...
   Insights ── chapters ── edges ──> Edge
```

Two rules govern the arrows:

- **Ownership beats reference.** A concept extracted from a cited paper is stored under that paper.
- **Derivation flows one way.** Sources and cross-narrative links are computed from links, never
  authored. Nothing downstream is hand-maintained.

---

## 5. The run, stage by stage

Every stage writes its output to disk before the next begins. Any stage can be re-run alone, and a
run that dies partway picks up from the last stage that completed.

### 0. Ingest — scripted

Splits the PDF into per-section text, renders an image of every page, and crops every figure and
table with its caption. Equations are handled differently: no crop, because they are re-typeset
later, so instead the three to eight displayed equations that actually carry weight are inventoried
— not every inline formula. Each inventoried equation takes its page from the section it was
declared in, so an agent sent to check notation against the page image lands on the right page.

**Must produce:** a section list with correct headings and nesting, one text file per section, a
page render per page, and a verified crop per item.

**Your check, and it is the important one:** look at the crops. Nothing downstream can tell that a
figure lost its legend or that a table crop stopped after the header row. If the section list came
out as one blob, the heading detector did not fire on this layout — fix it here, before anything
reads it.

**When it fails:** the failure is silent and arrives three stages later as concepts that do not
match the paper.

### 0b. Ingest from the web — scripted

A paper published as a web page rather than a PDF gets a sibling of stage 0, `ingest_web.py`, and
nothing else in the pipeline changes: it writes the same `sections.json`, `items.json` and
`regions.json`, so every stage after it runs without knowing which ran.

**What it does.** Fetches the page once (cached in `tmp/`, so re-running is free) and freezes a copy
at `papers/<id>/paper.html` with the page's own css and js beside it. Finds the article by
descending while one child holds nearly all the prose and stopping where the prose splits across
siblings — which is what an article with a separate appendix looks like. Splits on headings that are
direct children of a content part, numbering them by the run of heading depths rather than by tag
name, because a page whose first section is an `h3` and whose next is an `h2` is common. Numbering
restarts at each part, so an appendix does not read as a subsection of whatever came last. Takes
each figure's own image file — decoded from a data URI or downloaded — at full resolution. Tags
every block with `data-skim`, an attribute of ours rather than an `id`, because the page's own
scripts assign ids as they run.

**Three things differ, and all three are recorded rather than faked:**

- **No pages.** Sections and items carry an anchor into the frozen copy where a PDF paper carries a
  page number. `attach_sources.py` emits whichever the paper has, and the viewer prints no page
  badge rather than a made-up one. `section_pages.py` is PDF-only and exits cleanly on a web paper.
- **No captions.** Web figures routinely have none at all. The sentence that introduces the image
  becomes the caption and the item is marked `captionInferred`, which the figure page renders as
  "how the article leads into it" rather than as a quotation. Some of those sentences state the
  figure's conclusion rather than describe it, so the item's `focus` field carries more weight here
  than on a PDF paper.
- **Display maths can hide.** An equation in a bare `<div>` belongs to no block, so it belongs to no
  section, and it disappears from the text with nothing erroring. `d-math` is treated as a block for
  exactly this reason. It is the failure mode to watch for on a new site: check that the paper's
  central equation is in its section file.

**Your check changes shape.** There is no cropping heuristic, so the crop check mostly disappears —
the images are the authors' own files. What replaces it is the section split, because unnumbered
headings are a weaker signal than numbered ones, and a spot-check of the inferred captions against
their section text.

**The reader.** Because the copy is served from our own domain, the reader frames it and reads the
authors' own blocks out of it directly; following the scroll, pinning, find and the concept column
are the same code as over a PDF. Nothing of ours is drawn over their page beyond a one-pixel rule in
the gutter, on hover and on the pinned block.

### 1. Concepts — three agents and a merge

The sections are split three ways by role — roughly framing and related work, method and theory,
experiments and results — and one agent takes each. They pull out every concept a reader would need:
terms, mechanisms, design choices, named quantities. Concepts nest, so a concept too big to explain
in one breath gets children, and that continues until each bottoms out at the floor.

When a concept's real source is a cited paper — the paper says it uses someone else's mechanism —
the extractor flags the citation rather than guessing at the mechanism. The cited-papers stage picks
those up.

A fourth agent merges the three. It dedups overlaps, checks that every prerequisite exists, breaks
any cycles, decides which concepts are major, and checks every proposed id against the global set so
a collision is caught rather than silently dropped later.

**Must produce:** a single acyclic tree, every prerequisite resolving, twelve to twenty major
concepts, and a list of citations worth chasing.

**Your check:** read the major concept list as a table of contents for the paper. It is about to
become thirty-odd pages and the spine of both narratives, and this is the cheapest place in the run
to fix a structural problem.

### 1a. Triage — one agent before each expensive fan-out

A fan-out is where a run spends its money, and its size is a property of the paper rather than a
choice anyone made: eighty figures is eighty agents. The jobs inside one, though, are not equal.
Some carry a claim the argument rests on. Some are a screenshot of the authors' own tooling. Some
are the fourth near-identical version of a chart explained properly three times already.

So before the cited reads, before the pages, and before each round of either narrative, one agent
rates every job in that fan-out: **full**, **brief**, or **skipped**.

**Two grounds, and no others.** Does the job carry a claim? Does it repeat something already
covered properly? Not how long it looks, not how interesting it seems, not how much work it would
be — those are the criteria that quietly turn a coverage promise into an editor's preference.

**It decides on its own.** The verdicts and a one-line reason each go into the run log and nothing
waits on a human. Triage is not a fifth manual moment; the four that need your eyes are still the
four.

**It never removes coverage.** A job rated brief is still written, still defines every term that
appears only there, still carries its numbers, and still gets its page — it is a shorter telling
that leans on the fuller one and links to it, at roughly a third of the length. Every invariant in
§3 and every check in §9 survives triage untouched, which is the test of whether a triage rule is
allowed to exist at all.

**Skipping is allowed in exactly two places,** and in both it is the right answer rather than a
saving:

- A **cited paper** cited for context, agreement or comparison rather than for a mechanism this
  paper borrows. The register already models a paper the project does not hold — it stays unread
  until something needs it, which is the same state it was in before the run.
- A **narrative branch whose child would restate its parent.** This is the characteristic failure
  of the recursive structure, and the thing §5's closing check tells you to hunt by hand. Testing
  the claim before the round costs one agent and can save a whole level of padding.

**The figure fan-out is deliberately not guarded.** Every figure, table and equation gets the full
treatment. A figure that cannot be read where it sits is the second of the four failures this
project exists to fix, and an item rated cheap is exactly the item a reader gets stuck on.

**When it fails:** the fan-out runs as though everything were full, which is the old behaviour and
costs money rather than correctness. A triage that returns nothing is not a reason to stop.

### 1b. Cited papers — one agent per paper

The rule for keeping a citation is narrow:

> Does this paper **use a mechanism** from the cited work, or does it merely **compare against it**?

Follow the first, never the second. A baseline you are scored against is not a prerequisite; a
tokenizer you adopt wholesale is. Three to six kept citations is normal.

**Check the register before fetching anything.** If the project already holds a narrow read of that
paper, use it; extend it only if this run needs concepts the earlier read did not cover. Fetching a
paper that is already there overwrites concepts other papers link into and undoes the one thing
per-paper ownership exists to make possible.

What is genuinely new gets fetched and read narrowly: only the concepts the citing paper needs,
written to stand on their own without reference to whoever cited them, and stored under that paper.
Each read also records what it deliberately skipped, which is what makes a later "did this cover
what I need?" answerable.

Follow citations one level by default. If a cited paper's explanation leans on yet another citation,
explain at the floor and flag it rather than recursing.

### 2. Items — one agent per item

Waits for the concepts, because each agent needs the concept list to link into. One agent per figure,
table and inventoried equation. It defines every term, symbol, axis, legend entry and column header,
explains every number, and states what the item establishes. Structured top-down: what you are
looking at, how to read it, what it shows.

### 2b. Charts — one agent per kind of plot

An item page says what that figure shows. It does not say why the shape was chosen, or how to get
information out of one — and a paper that argues from evidence reuses a handful of shapes and
applies each many times. A reader who learns to read an activation spectrum once can read all four;
a reader who never learns is stuck at every figure that uses it.

So the plots are grouped by KIND and each kind is explained once. Two plots are the same kind when a
reader who can read one can read the other unaided — not merely when both are histograms. A
histogram of activations coloured by a proxy and a histogram of feature densities answer different
questions and are read differently.

`charts_prep.py` picks the plots out of the item set and writes one line per plot — title, what it
establishes, the axis and colour terms its walkthrough names — so the grouping agent sees the whole
set without being handed every walkthrough. One agent groups them; one agent per group writes the
page; `charts_save.py` files them under a `reading-the-evidence` concept and tags every plot with
its `chartId`, which is what the figure page links to.

**Each page has four parts, in order:** why this chart and not another (what a bar chart or a plain
average would have hidden — papers almost never say this, so it is worked out from what the plot is
asked to prove); how to read it step by step; what a bad result would look like, which is what turns
a chart from decoration into evidence a reader can judge; and where the shape comes back.

**They are their own theme,** placed last, because they teach how to read the evidence rather than
what it says.

### 3. Edges — one agent per lens

Four agents look at the whole set — concepts, items, results — each through one lens: what depends on
what, which claims the evidence actually backs, what is an instance of what, and what trades off
against what. Each edge carries its own explanation of why it exists.

**Your check:** glance at the spread across the lenses. Roughly even is healthy. One lens returning
double the others usually means its brief was too broad and the extra edges are weak — the tell is
vague labels of the "X is related to Y" kind.

### 4. Themes — two agents

One sorts the concepts into themes; the other sorts the edges into edge-themes, which are the
arguments those edges collectively make. Membership is exclusive.

### 5. Pages — the fan-out

Everything the pages need now exists, so this is the big parallel step: one agent per major concept,
per theme and per edge-theme, thirty-plus at once.

Each gets a brief holding exactly what its page needs — the draft material, the neighbours, every
relationship touching it, the evidence, and which sections to read. None of them reads the whole
dataset. A brief also carries the list of ids the page may link to, and that list defaults to this
paper's own.

The three page types do different jobs, described in §7.

**Your check:** read two of the thirty for register, not accuracy. If two are wrong the same way,
all thirty are.

### 6. Narrative — one agent, then a fan-out per round

One agent writes the root story: the paper retold start to finish in seven to nine chapters,
following the themes' reading order as its spine. It has to work two ways at once — as a continuous
read for someone who sees nothing else, and as a hub where every loaded term is a link. The last
chapter is the honest accounting of what the paper established and what it did not.

Then the tree grows round by round. Each round takes the chapters that declared they still hold a
distinct sub-story and gives each an agent, which retells that one span at higher resolution as its
own small narrative — and decides, per chapter, whether to go deeper again. Rounds stop when nothing
declares more depth or at the depth cap.

Expect uneven branches, because papers are uneven. Be suspicious if everything wants maximum depth;
that is usually padding. Branches bottom out **into the reference layer**: when a chapter is down to
one mechanism it stops splitting and links sideways instead.

**Your check:** pick a child and its parent and confirm the child goes deeper. A child that restates
its parent in different words is the characteristic failure, and it means that branch should not
have expanded.

### 6b. Re-pace — when the voice changes, not the content

Rewrites existing prose for rhythm only, and is checked mechanically: every link id and every number
present before must be present after. It keeps the researched content, which is the expensive part,
and changes only how it reads.

### 6c. Citations — scripted

Parses where each section starts and ends and attaches page references to every surface. Concepts
and items know their own; everything else derives from what it links to.

### 6d. Auto-link — scripted

Agents link the terms they happen to think of, which is not the same as linking all of them. This
pass builds a surface-form table from every concept name, including abbreviations, and finds places
where a concept is named in prose but never linked.

Deliberately conservative: first unlinked mention only, never inside an existing link, never inside
math or code, never a self-link. Surface forms matching more than one concept are dropped rather
than guessed.

### 6e. Insights — one agent, then a fan-out

The edges are the most interesting thing in the dataset and nobody will find them in a reference
list. So a second narrative spined on them. One agent reads every relationship and writes chapters
that each state one insight — something visible only when several connections sit side by side: a
chain of forced choices nobody states in one place, a gap between what is asserted and what is
measured, a repair for a problem the design created.

Not organised by relationship type; that is a filing system, not a read. Chapters that hold several
strands expand the same way as the main story. Each chapter declares the edges it draws on, which is
both how the app renders them beneath it and how coverage is checked. The agent also reports which
relationships it left unused, and that note is shown to the reader.

### 7. Quality gate — scripted

§8 lists what it checks. Run it after every stage, not just at the end: a clean gate at each step
means a failure is always in the stage you just ran.

### Then read it

The one check nothing automated can do. Open the front page and read it as a reader would. Follow a
link. Zoom into a chapter. Come back out. Look something up. You are hunting for what passes every
check and is still wrong — a link that lands somewhere unhelpful, a chapter that ends without
pointing anywhere, a page that assumes you read the previous one.

---

## 6. What you decide per paper

These are the knobs. Everything else follows from them.

- **The floor.** The single most important choice, because it decides where recursion stops. Name
  both sides — what to assume and what to explain anyway. Test it on three terms from the method
  section: if you cannot immediately place each one, it is too vague to hand to an agent.
- **Edge lenses.** Four work well and produce a balanced spread. Swap them for a paper whose
  interesting structure is temporal or causal rather than dependency-shaped.
- **Narrative depth.** Adaptive beats fixed — let each branch declare whether it still holds
  distinct sub-stories, and cap the depth. Fixed depth pads shallow branches and truncates deep ones.
  Three is plenty.
- **Pace.** Dense or slow. Slow means one idea per sentence, unpack a term before naming it, walk
  the arithmetic rather than stating the result. It is not padding, not chatty, and never talks down:
  it unpacks the paper's machinery, never the reader's background. It costs roughly 50% more words.
  **Decide this before the page fan-out** — see §9.
- **Tone.** The voice rules push output toward skepticism. That is usually right, but it is a choice
  worth making deliberately rather than discovering in the finished pages.
- **Page granularity.** Full pages for themes and major concepts; smaller concepts fold into their
  parent as expandable sections.
- **Citation depth.** One level by default.

---

## 7. What each surface owes the reader

This is the definition of done for prose.

**Concept page** — answers "what is this and why is it here" in two sentences; explains the
mechanism concretely enough to implement or teach; says why the choice was made and what it cost;
points at the evidence and rates it honestly. Does not restate its own summary or its children.

**Item** — a reader who has never opened the paper can read it. Every term defined, every number
explained, a stated takeaway.

**Theme page** — the connective tissue between its members, not a summary of each. Opens with the
question the theme answers, makes internal edges visible as reasoning, points backward and forward.

**Edge-theme page** — states the argument its edges collectively make and traces it end to end. This
is where an attentive reader learns what the paper did *not* prove.

**Narrative chapter** — works as continuous prose and as a hub. Every loaded term links. A child
node must add resolution; a chapter that restates its parent in different words is a defect.

**Insights chapter** — one insight, visible only across several relationships. Carries the raw edges
beneath it and reports what it left unused.

### Voice

Voice and pace are part of the design, not decoration.

- **Plain, not decorative, not authoritative.** Say what the source claims, does and shows — not
  what is true.
- **Hedge with the source.** "Suspects", "seems to", "is an estimate" survive intact. More room
  means a clearer hedge, never a softer or firmer one.
- **Banned words, enforced mechanically:** novel, remarkably, elegant, powerful, seminal,
  groundbreaking, revolutionary, cutting-edge, crucial, delve, leverage (as a verb), it's worth
  noting, importantly, unlock, harness.
- **Write in the source's moment.** No hindsight about what the field later did with it.
- **Define before use, and link the first mention only.** One link per concept per surface;
  repeating it is noise.
- **Short sentences. Concrete examples over abstract restatements.**

### Navigation

Three moves, and they must feel distinct.

| Move | What it does | Where |
|---|---|---|
| **Zoom in** | Same span, more resolution | A chapter opens its child narrative |
| **Zoom out** | Back up the tree | Breadcrumb, and an explicit way back out |
| **Step sideways** | Same depth, different object | A link into a concept, item or theme |
| **Switch read** | Same material, different order | Between the two narratives |

Every narrative node is its own page with a breadcrumb to the root; depth is shown, not implied. The
two narratives cross-link where they cover the same ground, computed from shared links. A hover on
any link previews the target's summary without navigating.

### Rendering

- **Static and self-contained.** Generated data plus a viewer; no build step, no server required.
- **Every id is routable.** Concepts, items, themes, narrative nodes and papers all have a URL.
- **Markdown and math**, with a visible fallback when math fails rather than silent breakage.
- **Links resolve or are visibly marked broken.** Never rendered as raw text.
- **Both themes designed**, including the system-default state.
- **Wide content scrolls in its own container**; the body never scrolls sideways.
- **Original crops render at fidelity**, on a stable ground whatever the page theme.

---

## 8. Cross-paper

### Each paper stands alone

Every concept a paper needs is explained on that paper's own pages. A reader who opens a paper and
never clicks anything still learns what byte-pair encoding is and what 40,000 merges buys them.
Where the paper diverges from something it borrows, it explains the divergence in its own terms too.

Where another paper in the project explains the same thing, the concept carries a plain link across.
That link is a door, not a prerequisite, and it is the whole of the connection between two papers.
There is no page gathering up what one paper takes from another; connection is a link, not a
structure.

### Reuse is a production rule, not a reader-facing one

The register exists so that a mechanism read once is not read twice. Before fetching a cited paper,
look: if a narrow read is already on disk, use it as the source material for this paper's own
explanation and add this paper to its list of citers. Extend an existing read only where this paper
needs something the earlier scoping dropped — which is what the skipped record is for.

The reader sees none of this. They see a paper that explains what it needs.

### Ids

Ids are global and the viewer indexes on them, so **a duplicate id is dropped silently** — the
second paper's concept simply never renders, with no error anywhere. That failure mode is why the
rule is mechanical rather than a matter of care:

- A new paper takes clean slugs, and adds a short paper suffix only where one would collide.
- Nothing is renamed retroactively.
- The merge checks every proposed id against the global set.
- The gate fails on duplicates rather than letting the viewer swallow them.

A global id space is itself a coupling between papers. The properly detached fix is for the viewer
to key concepts by paper as well as id, which would let every paper use natural slugs. That is a
viewer change rather than a data change, and it can happen later without touching anything written
before it.

### Where agents are handed link targets

Briefs carry the list of ids a page may link to, and those lists default to the paper's own. Any
script that builds a brief — the node index, the page briefs, the narrative briefs — is a place
where another paper's ids can leak into prose that should have stood alone. This is not enforced in
one place; it has to hold wherever an agent is handed a list of things it may link to.

---

## 9. The quality gate

Voice is deliberately not checked here. Every writing agent is told to use plain words and given the
list to avoid; a word list applied afterwards catches the word rather than the writing, and it once
failed a run over two uses of "powerful" that read perfectly well. Instruct it at the point of
writing, do not police it at the end.

Machine-checkable, all must pass:

- Every link, prerequisite, edge endpoint, theme member and child pointer resolves — including
  across papers.
- No cycle in the concept tree; every parent exists.
- No id claimed by two papers.
- Every major concept has a page.
- Every item has a walkthrough and a non-empty term list.
- Every non-floor, parentless concept belongs to exactly one theme.
- Every edge belongs to an edge-theme, and every load-bearing edge appears in the second read.
- Every surface carries a source reference.
- After any prose rewrite: no link id and no number has disappeared.

The gate cannot see material that never reached it. A paragraph lost during ingest produces a clean
gate and an incomplete explainer, which is exactly why the crop check is manual and comes first.

---

## 10. Rules earned the hard way

Each of these was a real failure. The reason is kept with the rule, because a rule without its
reason gets dropped by whoever does not see the point.

**Never measure the page from inside a scroll handler.** Positions that cannot change while the
reader scrolls are measured once and searched; only what genuinely moves is measured again. *Why:*
the reader followed the scroll by asking all 583 blocks where they were on every frame. Each of
those calls forces the browser to flush layout, and on an article of forty-eight thousand elements
that cost 6-15ms of a 16.7ms frame - the scrolling felt heavy and the article's own widgets got the
blame. Measuring once and binary-searching took it to under 0.2ms.

**Let the browser skip what it is not showing, unless redrawing it is expensive.** `content-visibility`
on the figures took ordinary scrolling from 14ms a frame to 10ms. Applied to a figure built from
four and a half thousand live SVG nodes it stalled the page for over two seconds each time that
figure scrolled back into view. *Why:* the saving is proportional to what is skipped, but so is the
cost of drawing it again - so the test is how much is inside a figure, not how large it looks.

**An agent decides; a script moves.** Anything bulky an agent produces is written to disk by that
agent, and read back by a script. Never paste it into a later agent's prompt. *Why:* a stage that
handed an agent eighty figure walkthroughs and asked it to write them to a file spent 257,000
tokens over 157 turns across two attempts, failed both times, and was replaced by a script that
does it in under a second. The tell is a prompt containing a large blob that comes back out roughly
unchanged. It is also what keeps the disk rule true: work that only exists in a workflow's memory
is lost when the run dies, and a run that large always dies eventually.

**A resume only reuses what it recognises.** Change a prompt at or before a completed stage and
every agent after it re-runs. *Why:* editing a whole workflow file and resuming from it re-ran an
ingest and three concept extractors that had already succeeded, for about 210,000 tokens, because
one branch in stage 0 had changed. When picking a run back up, edit only what comes after the last
result you want to keep.

**Script everything deterministic; use agents only for judgment.** Ingest, citations, auto-linking,
coverage checks and the gate are all code. *Why:* it is the difference between a pipeline you can
re-run and a pile of one-off outputs, and it means most fixes cost seconds rather than agents.

**Give each agent a brief, not the dataset.** Generate one small file per unit holding exactly what
that unit needs. *Why:* an agent reading a focused brief beats one reading everything, and the brief
is also where you control what it is allowed to link to.

**Have agents return structured output against a schema.** *Why:* validation happens at the tool
layer, so a mismatch is retried rather than accepted silently and discovered downstream.

**Verify agent work mechanically.** *Why:* drift is the default. Assume it, then measure it.

**Rewrite rather than regenerate when style changes.** *Why:* the researched content is expensive
and already verified; regenerating to fix tone throws away work that was correct.

**Budget real time for PDF extraction, and verify crops by eye.** *Why:* extraction is heuristics
all the way down and every defect is quiet. A main architecture figure was invisible to the drawing
API and had to be recovered by rendering the region and trimming to non-white pixels. Section
headings arrived as separate lines — the number and the title — and had to be bucketed by vertical
position and joined. A table-body detector misfired because a table looks like a paragraph until you
account for line length.

**Normalize ligatures explicitly, at every point text leaves the PDF.** *Why:* a publisher-typeset
paper emitted single-character ligatures where the reader sees two letters, so a section came out as
"Supervised ﬁne-tuning". Nothing errors — a substring test simply returns false — so every string
comparison, id match and search misses quietly, and a slug builder that strips unknown characters
drops the letters entirely. Use an explicit map rather than a general Unicode normalization, which
would also rewrite the superscripts, fractions, Greek letters and math symbols that have to survive
intact.

**Watch the crop bands for overshoot, because the text inside a crop is excluded from the section
files.** *Why:* a table crop that ran past the table swallowed a body paragraph, and that paragraph
— carrying real hyperparameters — was in the PDF and absent from everything the agents read. The
detector separated prose from table content by average line length but had a length floor that let
short paragraphs through.

**Watch your own detectors as closely as the agents.** *Why:* an early auto-link pass filtered
candidate terms to five characters or more and silently discarded every abbreviation. It found 78
real problems and missed the one that had actually been reported.

**Expect parallel branches not to know about each other.** *Why:* two branches of the recursion
independently descended into the same borrowed mechanism and explained it twice, each correctly for
its own context, because rounds are computed per branch. Either accept it as honest repetition — a
reader arriving down either path needs it — or add a dedup pass between rounds.

**Check the register before fetching a cited paper.** *Why:* the cited-papers stage once read every
flagged citation with an arXiv id without asking whether the project already held it, re-fetching
papers already read and overwriting concepts other pages linked into. Per-paper ownership buys
nothing until something actually looks before reading.

**Serve over local HTTP while developing.** *Why:* browsers cache filesystem sub-resources hard, so
regenerating data and reloading shows stale content, repeatedly and confusingly.

**Persist every stage.** *Why:* long runs get interrupted — credits run out mid-fan-out. Because
every stage writes to disk before the next begins, the cost of an interruption is re-running what
failed rather than the whole pipeline.

---

## 11. Judgment calls that keep coming up

**Major or minor concept?** Major if a reader would look it up on its own; minor if it only makes
sense inside its parent. When unsure, minor — it still renders, as an expandable section, and
promoting it later is cheap.

**Expand this branch?** Only if it holds several distinct strands each deserving their own telling.
When unsure, do not. A shallow honest branch beats a padded deep one.

**Follow this citation?** Only if a mechanism is borrowed. Comparison is not borrowing.

**Has the tone drifted?** Separating what a paper measured from what it asserted is the job.
Implying the work is weak because its evidence has limits is not.

**Regenerate or rewrite?** Rewrite, nearly always.

### When a problem means going back

Some failures are symptoms of a decision made earlier, and pushing forward makes them worse.

| What you see | What is actually wrong |
|---|---|
| Everything is over-explained | Floor set too low |
| Terms get named but never unpacked | Floor set too high |
| Pages restate their own summaries | Briefs are not saying what renders where |
| Every branch wants maximum depth | Agents padding; tighten the expand instruction |
| Vague edges — "X is related to Y" | Lens briefs too broad |
| Narrative children restate parents | Expansion happening where it should not |
| Two branches explain the same thing | Expected; decide whether to accept or dedup |
| A concept never appears in the viewer | Id collision, dropped silently |
| An explanation is missing something the PDF says | Ingest lost it; check crop bands and ligatures |

And the one that is expensive rather than wrong: **changing the pace after the page fan-out.**
Re-pacing everything costs more than every other stage combined. It is recoverable, but it is the
one expensive mistake available in the sequence, so make the call before the fan-out.

---

## 12. Cost, running it, and where things live

**The agent count is a property of the paper, not a constant.** Ten agents are fixed; everything
else is counted off the paper's own shape.

| Stage | Agents |
|---|---|
| Ingest, citations, auto-link, bundle, gate | none — scripted |
| Concepts | 4 — three extractors and a merge |
| Triage | 1 before each guarded fan-out — cited reads, pages, and each narrative round |
| Cited papers | 1 per borrowed mechanism the register does not already hold, less any triage skips |
| Items | 1 per figure, table and inventoried equation |
| Charts | 1 to group the plots, then 1 per kind of plot — about 8-12 |
| Edges | 1 per lens |
| Themes | 2 |
| Pages | 1 per major concept, plus 1 per theme and edge-theme |
| Narrative | 1 for the root, then 1 per chapter that declares another level, round by round |
| Insights | 1, then 1 per chapter that expands |
| Re-pace | 1 per prose unit — only when the pace changes |

Three of those dominate, and all three scale with the paper: the page fan-out with how many concepts
are major, the narrative with how many chapters hold distinct sub-stories, and a re-pace with the
sum of the other two. That last row is why the pace decision is expensive to reverse — a re-pace is
close to a second copy of the two biggest fan-outs.

The estimate is available before the expensive part runs. Ingest fixes the item count and the merge
fixes the major-concept count, so after stage 1 you know the size of the run. Expect the shape to
vary with the paper rather than its length: a short paper with twelve datasets across four task
families costs more than its page count suggests, and a long paper whose method is mostly borrowed
costs less, because borrowed mechanisms are still explained here but arrive from reads already on
disk.

Everything scripted is free and re-runnable. The expensive, hard-to-redo part is the researched
content; the cheap part is how it reads. Keeping those two separable is the whole reason re-pace
exists as its own stage.

The stages run in order from `pipeline/`, retargeted at a paper with one environment variable. What
the run needs — the paper's id, its arXiv id if it has one, the floor, the pace and the depth cap —
is settled up front and inherited from there.

The fan-outs are discovered rather than declared. The item list comes out of ingest, the cited
papers out of the merge, and the page targets out of the themes, so the size of a stage is known
only once the one before it has finished. Because every stage writes to disk, a run that dies
partway picks up from the last stage that completed, and re-running one stage leaves the rest alone.

Two things nothing does for you: the crop check is yours to make by eye, and the three-way section
split handed to the extractors is worth a glance if the paper is unusually structured.

- `pipeline/` — the scripted stages, plus the brief builders the fan-outs read and the save scripts
  that file and re-validate each stage's output.
- `papers/<id>/` — one paper's world: the PDF, its assets, its data, the cited papers this run
  accessed, and optional per-paper overrides for equations, headings and crops.
- `register.json` — every paper ever touched, main or cited, and what was extracted from it.
- `viewer/` — the static app: a library page listing every paper, and one reader shell that serves
  any of them. It loads every bundle, so a cross-paper link renders in place instead of sending the
  reader to another document.
- `netlify/` — the only server-side code: readers can ask for a paper, and the asks are readable on
  an admin page behind a password set in the site's environment variables. Nothing is built at deploy
  time; the root redirects into the viewer.

---

## 13. Extension points

The design is deliberately open in four places.

- **Another read.** Narratives are a list, not a pair. A third — an implementation walkthrough, a
  critique — is a data file plus a registry entry; the viewer carries them generically.
- **Another lens.** Edge types are configuration.
- **Another audience.** The floor is one parameter. Changing it changes where recursion stops and
  which concepts are stubs; the structure is unchanged.
- **Another paper.** The register plus per-paper ownership means a paper that borrows a mechanism
  already read here writes its own account from what exists rather than opening that PDF again.
