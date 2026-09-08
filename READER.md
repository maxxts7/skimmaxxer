# Skimmaxxer — The reader

A fourth surface, next to the story, the insights and the reference layer: **the paper itself, with
the concepts of whatever paragraph you are on standing beside it.**

Everything else in the project rewrites the paper. This does not. It shows the PDF as printed and
puts the explanation next to it, so a reader who wants the original still never meets an unexplained
term. Same promise, different direction of travel.

## What the reader is

Two columns on one route. The PDF on the left, rendered by pdf.js so the text is selectable and
searchable. A concept column on the right, headed **In this paragraph**, holding the concepts that
paragraph leans on — each a name and its summary. Click one and its full page opens in a panel over
the PDF.

The column follows your scroll. The paragraph nearest the middle of the viewport is the live one and
carries a faint mark; the column swaps as you read. Click a paragraph to pin it so it stops moving.

Scroll onto a figure, table or equation and the column shows that item's title and stated takeaway
instead, with its walkthrough one click away. That work already exists and ingest already knows
where on the page each one sits.

## The seven decisions

| | |
|---|---|
| **What is rendered** | The paper as published — the real PDF through pdf.js, or a frozen copy of the article for a paper that was never one. Works for any paper, because one of those two always exists. |
| **What the column shows** | Name and summary in the list; the full concept page in a panel on click. |
| **How it follows** | Scroll position. The paragraph nearest mid-viewport is live; click to pin. |
| **Where the mapping comes from** | The section's concepts, ordered per paragraph by one small agent. |
| **Order or cut** | Cut to what the paragraph leans on, ranked; the rest of the section's concepts fold under *"n more in §3.2.1"*. |
| **Floor concepts** | Not shown. The column carries only what the project committed to explaining. |
| **Scope** | Every paper given the full treatment. A paper skimmed for a single mechanism has no reader. |

Three ways in. A **`Story | Paper`** switch in the rail, on every page of a paper, which is also the
way back out — the two readings named side by side rather than one of them hidden behind a foot
link. A second door on the library card, next to *Start reading* — two entrances stated as two
different things, the retelling or the paper itself, and it appears only once ingest has recorded
that paper's regions. And every source citation across the site — the "page 3" links under
concepts, items and chapters — now lands in a reader at that page instead of opening a raw PDF tab.

That last one holds across papers. A citation into another **full** paper opens that paper's own
reader shell at the right page; a citation into a paper skimmed for a single mechanism still opens
the file, because there is no reader to send it to. The link goes to the best thing that exists.

## The switch

Two readings of the same paper, so one control naming both. `Story | Paper` sits in the rail on
every page of a paper — including the concept pages and the figures list, where the point is less
to keep your place than to say the paper itself is there. The half you are on is the raised chip;
the half you can press takes the accent under the pointer, because in this palette the accent means
the way forward and the way forward is always the other one. A paper ingest has not walked has no
second side, and there the switch is not drawn at all.

Both halves keep your place, by three means in order of how much they know.

**It remembers.** Press Paper from a chapter and the chapter is remembered; press Story and you are
returned to it exactly. The memory is dropped the moment you scroll the paper, because then you are
somewhere else and the honest answer is the chapter about wherever you have got to.

**Paper to story, it reads the region.** Every region of the paper names its section, and every
chapter names the sections it draws on, so the passage you are on resolves to the chapter that
covers it. Where several cover it the most focused one wins — the one that drew on the fewest — and
a subsection nobody named is answered by its parent. Always one of the story's own numbered
chapters, opened where it sits on the front page: someone who presses this wants the thread again,
not to be dropped five levels down a branch they have never seen.

**Story to paper, it reads the citations, and this is the weak one.** A chapter's citations run in
paper order and nearly every chapter leans on the abstract, so the first is no answer. What a
chapter is about is written instead in how precisely it cites: one that names §3.2.1 is telling you
more than one that names §3. So the rule is the most specific citations a chapter makes, and among
those the page most of them land on. On a paper that cites selectively this lands where you would
want it for most chapters, and goes blunt on the ones that cite nothing below a top-level section —
the chapter that frames the problem, the chapter that closes it — where the most it can say is
which part of the paper they live in.

It is blunter still where the citations are exhaustive rather than chosen. A chapter that lists
every section it touched — dozens of them, several levels deep and reaching into the appendix —
gives a deepest citation as likely to be a footnote as the subject, and several chapters of such a
paper can land on the same passage. Nothing in the viewer can fix that: a list that says everything
a chapter touches cannot also say what it is about. If it is worth fixing it is fixed upstream, by
having a chapter record the section it is *about* rather than the ones it touched. The round trip
does not wait on that, because the switch remembers.

On a narrow screen the PDF takes the full width and the concepts become a sheet: a low bar naming
the live paragraph's first concept, which pulls up when tapped. Scroll-following keeps running
underneath it. Narrower still, and off the paper, the switch takes a line of its own under the mark
rather than pushing the rail wider than the screen.

## What the reader does not do

Three rules earned in the first pass over it.

**Nothing is drawn on the paper while you read.** The column has to say which block it is describing
or the two panes are silently uncoupled, but that indicator belongs on the column's side: the
heading quotes the block's opening words. The page marks only under the pointer and when pinned,
where a mark is an affordance rather than a label.

**A link inside the column stays inside the column.** Opening a concept widens the column from
336px to a reading width and the paper gives up the space — nothing covers anything, and the
paragraph that raised the question stays visible. Following a link from there swaps the column and
grows a back arrow, as deep as the reader wants. One link at the foot, and only that one, leaves for
the full site.

**The paper is not selectable.** No text layer sits over the page, so a block takes the pointer
directly and nothing invisible can drift out of register. What that costs is the browser's own find,
so the top bar carries its own: it searches the block text already on hand, names the section and
page of every hit, and lands you on the block with its concepts beside it — which Ctrl+F never
could.

**A page opened in the column is the site's page, at the column's scale.** Same renderer, nothing
dropped, so there is no second version to keep in step. What changes is the type: the title steps
down from 37px to 24px, headings and body to 15px, the eyebrow to a 10px mono label, and the whole
thing is held to a 33rem measure inside 30px gutters. A title should label what you opened, not
head a magazine.

**The paper is the paper.** Zoom is stepped — 75, 100, 125, 150, 200 — in the top bar and
remembered between visits; past fit-width the pane scrolls sideways rather than anything being
scaled to fit. In the dark theme the page dims to 84% rather than inverting, so figures and colour
plots stay truthful.

Typography follows the rest of the app: names in Archivo, the sentence explaining a thing in Source
Serif, labels in mono. The column and the concept page it opens into read as one surface.

## Where the mapping comes from

The expensive version of this feature reads every section from scratch and discovers which concepts
each paragraph is about. It is not needed. **Concepts already carry `sectionIds`**, so the candidate
pool for any paragraph is already known and small — a handful per section at the median, a couple of
dozen at the worst. Nothing has to be *found*. What is left is ranking a short list against a short
paragraph, which is a job small enough to hand to one agent per paragraph and run the lot in
parallel.

Two properties fall out of that, and both matter more than the saving:

- **It cannot invent.** A paragraph can only be tagged with concepts its own section owns, so the
  failure mode is a bad ordering, never a hallucinated link. Every id resolves by construction.
- **It is re-runnable alone.** It reads `concepts.json` and the section text files, both already on
  disk. It does not touch, and is not touched by, anything upstream.

## The data

### `paragraphs.json` — from ingest, scripted

Ingest already walks the PDF block by block with a page number and a rectangle for each, and already
drops footers and anything inside a figure crop. It throws that geometry away after writing the
section text. The change is to keep it.

```
{ "paperId": "<paper>",
  "regions": [
    { "id": "p-3.2.1-02", "kind": "paragraph", "sectionId": "3.2.1",
      "page": 4, "rects": [[0.13, 0.22, 0.47, 0.31]],
      "text": "The two most commonly used forms of this are…" },
    { "id": "fig-1", "kind": "item", "sectionId": "3",
      "page": 3, "rects": [[0.31, 0.08, 0.69, 0.52]] }
  ] }
```

Rects are stored **normalised to the page** — fractions of width and height in pymupdf's top-left
space. The viewer multiplies by the rendered pixel size of the page and is done. No coordinate
conversion between PDF user space and canvas space anywhere in the front end, and the overlay is
correct at every zoom level for free.

Item regions come from `data/ingest/items.json`, which already holds `page` and `rect` for every
figure and table. They are stripped from the authored `data/items.json`; the reader reads them from
ingest instead.

Paragraphs must be emitted by the **same loop** that builds the section text, not a second pass, or
the paragraph ids and the text the agent sees drift apart.

**Blocks, not logical paragraphs.** A paragraph broken across a column or a page arrives as two
blocks, and it stays two units. Each is ranked on its own text against the same section pool, so
both halves get a sensible column and the highlight simply follows the block you are on. A half
paragraph may rank slightly differently from what the whole would have given; it cannot be wrong,
because the candidates are identical either way. No joining heuristic, and nothing to check by eye.

### `reading.json` — the reading stage, one agent per paragraph

```
{ "paperId": "<paper>",
  "paragraphs": [
    { "id": "p-3.2.1-02",
      "concepts": ["the-operation-defined-here", "the-one-it-replaces", "a-term-in-its-formula"] }
  ] }
```

Ordered, most central first. Concepts not chosen are not stored: the fold is computed in the viewer
from the section's own list minus what the paragraph took, so the two can never disagree.

The agent is handed one paragraph and its section's concepts as name plus summary. It returns the
subset the paragraph leans on, in order. It may return nothing — a transitional paragraph should.
Floor concepts are filtered out of the pool before the agent sees them, so the floor decision costs
nothing at read time and cannot be overridden by an agent.

The stage sits **after items and before edges**: it needs concepts and item geometry, and nothing
later needs it. Bundle picks up `reading` and `paragraphs` as two more parts alongside the existing
seven.

## What the gate checks

- Every concept id in `reading.json` exists **and belongs to the section its paragraph sits in**.
  The second half is the real check; the first cannot fail if the stage did its job.
- No floor concept appears anywhere in `reading.json`.
- Every paragraph id in `reading.json` exists in `paragraphs.json`, and every body paragraph has an
  entry — an empty list is an answer, a missing entry is a dropped agent.
- Every region's rects lie inside the page.
- Front matter and references carry no regions.

Coverage is deliberately not a check. A section whose paragraphs mostly come back empty is worth
looking at, but it is not a failure — some paragraphs genuinely carry nothing.

## Cost

**One agent per body paragraph**, each seeing that paragraph and its section's shortlist of
candidates — tens of agents on a short paper, a hundred or so on a long one, and each of them cheap
because both halves of what it reads are short. Ingest's change and the bundle's are scripted, so
free and re-runnable. The whole stage re-runs alone for the price of the fan-out if the ordering
rule changes.

For a paper without the full treatment — one holding only a concepts list and a fulltext — the pool
would have to come from somewhere other than `sectionIds`, and those papers have no items to offer
either. That is a separate decision, deferred until the prototype is worth copying.

## Where it is

Built and working on every full paper, except the ranking:

- **Ingest** emits `data/ingest/regions.json` — paragraphs, headings, figures and tables, every rect
  normalised to its page and none outside it. Re-running ingest on a paper already processed changes
  nothing else on disk — same section split, same crops — so the concept mapping still holds.
- **Bundle** carries `regions` and `reading` into the viewer bundle.
- **The reader** is the `#/pdf` route (`#/pdf/4` opens at page 4). pdf.js renders the paper, the
  overlay follows the scroll, the column shows name and summary, clicking opens the full page in a
  panel over the paper. The rail's `Story | Paper` switch is the door both ways, and every source
  citation now points here.
- **The reading stage** has its prep (`reading_prep.py`) and its save (`save_reading.py`), but has
  not been run.

How much the ranking is worth is a property of the paper, and it is the number to watch when a new
one is added: **how many concepts a single section owns.** A paper that spreads its concepts thinly
across many sections gives a short candidate list — a handful — and the reader is merely blunt
without the ranking. A paper that packs as many concepts into half as many sections gives a list
three times as long, unchanged on every paragraph of that section as you read through it, and there
the reader is close to useless until the stage runs.

Until it is run there is no `reading.json`, and the column falls back to the section's own concepts
in the order they were extracted. That fallback is what the ranking will be drawn from anyway, so
the reader is usable now and gets sharper rather than different when the stage runs.

The reader needs to be served over http. pdf.js cannot fetch a PDF from a `file://` page, and the
route says so and offers the plain PDF instead rather than failing silently.

## A paper published as a web page

A paper that was never a PDF gets the same reader with two substitutions and no third code path.
The frozen copy of the article stands in for the rendered page, the author's own elements stand in
for the ingested rectangles, and a block's anchor stands in for a page number — so "where you are"
is stated as a section rather than as *page 4 of 15*, which is the honest equivalent and the thing a
page number was standing in for anyway.

One thing is genuinely different and the switch has to know it: the article keeps drawing after it
opens, and every figure that finishes moves everything below it. So "have you moved since you
arrived" is asked of your hands — a wheel, a touch, a key — and not of the scroll position, which
changes on its own.

## The moment that needs your eyes

One, and it is the same shape as the crop check: **after ingest, look at the overlay.** Open the
reader with region outlines turned on and scroll a two-column page. A rect that misses its text, a
figure region that swallowed its caption, a column read in the wrong order — all of it is obvious in
two seconds by eye and invisible to every check downstream.

The second look is the ordering, and it is cheap: read three paragraphs' columns from a section you
know. If the ranking is wrong in the same way three times, it is a prompt fix, not an editing job.
