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
| **What is rendered** | The real PDF via pdf.js. Text selectable and searchable. Works for any paper, since every paper has a PDF. |
| **What the column shows** | Name and summary in the list; the full concept page in a panel on click. |
| **How it follows** | Scroll position. The paragraph nearest mid-viewport is live; click to pin. |
| **Where the mapping comes from** | The section's concepts, ordered per paragraph by one small agent. |
| **Order or cut** | Cut to what the paragraph leans on, ranked; the rest of the section's concepts fold under *"n more in §3.2.1"*. |
| **Floor concepts** | Not shown. The column carries only what the project committed to explaining. |
| **Scope** | Every full paper: `1706.03762`, `gpt-1`, `1810.04805`. The narrow reads have no reader. |

Three ways in. A **The paper** link in the nav foot beside Figures / Concepts / Connections. A
second door on the library card, next to *Start reading* — two entrances stated as two different
things, the retelling or the paper itself, and it appears only once ingest has recorded that paper's
regions. And every source citation across the site — the "page 3" links under concepts, items and
chapters — now lands in a reader at that page instead of opening a raw PDF tab.

That last one holds across papers. A citation into another **full** paper opens that paper's own
reader shell at the right page; a citation into one of the eleven papers skimmed for a single
mechanism still opens the file, because there is no reader to send it to. The link goes to the best
thing that exists.

On a narrow screen the PDF takes the full width and the concepts become a sheet: a low bar naming
the live paragraph's first concept, which pulls up when tapped. Scroll-following keeps running
underneath it.

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
each paragraph is about. It is not needed. **Concepts already carry `sectionIds`**, populated on all
97 concepts of `1706.03762`, so the candidate pool for any paragraph is already known and small —
one to twenty-three per section, six at the median. Nothing has to be *found*. What is left is
ranking a short list against a short paragraph, which is a job small enough to hand to one agent per
paragraph and run the lot in parallel.

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
{ "paperId": "1706.03762",
  "regions": [
    { "id": "p-3.2.1-02", "kind": "paragraph", "sectionId": "3.2.1",
      "page": 4, "rects": [[0.13, 0.22, 0.47, 0.31]],
      "text": "The two most commonly used attention functions are…" },
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

### `reading.json` — stage 2c, one agent per paragraph

```
{ "paperId": "1706.03762",
  "paragraphs": [
    { "id": "p-3.2.1-02",
      "concepts": ["scaled-dot-product-attention", "additive-attention", "scaling-factor"] }
  ] }
```

Ordered, most central first. Concepts not chosen are not stored: the fold is computed in the viewer
from the section's own list minus what the paragraph took, so the two can never disagree.

The agent is handed one paragraph and its section's concepts as name plus summary. It returns the
subset the paragraph leans on, in order. It may return nothing — a transitional paragraph should.
Floor concepts are filtered out of the pool before the agent sees them, so the floor decision costs
nothing at read time and cannot be overridden by an agent.

**Stage 2c**, after items and before edges: it needs concepts and item geometry, and nothing later
needs it. Bundle picks up `reading` and `paragraphs` as two more parts alongside the existing seven.

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

For `1706.03762`: **78 agents**, one per body paragraph, each seeing one paragraph and at most
twenty-three short candidates. Ingest's change and the bundle's are scripted, so free and
re-runnable. The whole stage re-runs alone for the price of the fan-out if the ordering rule
changes.

For a paper without the full treatment — the ten that hold only a concepts list and a fulltext —
the pool would have to come from somewhere other than `sectionIds`, and none of them have items to
offer. That is a separate decision, deferred until the prototype is worth copying.

## Where it is

Built and working on all three full papers, except the ranking:

- **Ingest** emits `data/ingest/regions.json`. For `1706.03762`: 81 paragraphs, 23 headings, 9
  figures and tables. For `gpt-1`: 49, 12 and 7. Every rect normalised to its page, none outside it.
  For `1810.04805`: 115, 26 and 13. Every rect normalised to its page, none outside it. Re-running
  ingest on `gpt-1` changed nothing else on disk — same section split, same crops — so the concept
  mapping still holds.
- **Bundle** carries `regions` and `reading` into the viewer bundle.
- **The reader** is the `#/pdf` route (`#/pdf/4` opens at page 4). pdf.js renders the paper, the
  overlay follows the scroll, the column shows name and summary, clicking opens the full page in a
  panel over the paper. `The paper` sits in the nav foot and every source citation now points here.
- **Stage 2c** has its prep (`reading_prep.py`) and its save (`save_reading.py`), but has not been
  run for either paper. `1706.03762`: 81 jobs, 1-22 candidates each, median 7. `gpt-1`: 49 jobs,
  6-38 candidates, **median 20**.

That last number is the one to watch. `gpt-1` carries 120 concepts across 14 sections where
`1706.03762` spreads 97 across 25, so a `gpt-1` section owns roughly three times as many concepts.
The fallback is correspondingly worse — twenty rows on every paragraph of a section, unchanged as
you read through it — and the ranking is doing correspondingly more work. Where the reader is
merely blunt without stage 2c on `1706.03762`, it is close to useless on `gpt-1`.

Until it is run there is no `reading.json`, and the column falls back to the section's own concepts
in the order they were extracted. That fallback is what the ranking will be drawn from anyway, so
the reader is usable now and gets sharper rather than different when the stage runs.

The reader needs to be served over http. pdf.js cannot fetch a PDF from a `file://` page, and the
route says so and offers the plain PDF instead rather than failing silently.

## The moment that needs your eyes

One, and it is the same shape as the crop check: **after ingest, look at the overlay.** Open the
reader with region outlines turned on and scroll a two-column page. A rect that misses its text, a
figure region that swallowed its caption, a column read in the wrong order — all of it is obvious in two seconds by eye and invisible to every check downstream.

The second look is the ordering, and it is cheap: read three paragraphs' columns from a section you
know. If the ranking is wrong in the same way three times, it is a prompt fix, not an editing job.
