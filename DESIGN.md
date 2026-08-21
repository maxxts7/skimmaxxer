# Skimmaxxer — Design Specification

What the thing *is*, at a level that survives a rewrite.

This is the design of the artifact: what it must contain, how the parts relate, what each surface
guarantees a reader, and what "done" means. Anyone should be able to build a different
implementation from this document and get something recognisably the same.

It deliberately says nothing about how any of it gets produced. Its companion,
[PLAYBOOK.md](PLAYBOOK.md), covers what to do when a paper arrives — the decisions and the checks.
[METHOD.md](METHOD.md) covers the machinery, and [WORKFLOW.md](WORKFLOW.md) is the record for one
particular paper.

---

## 1. The problem

A research paper is written for people who already understand it. It compresses: a term is used
before it is defined, or never defined at all because the audience is assumed to know. A figure
means nothing without three paragraphs of body text. The reasoning that connects one design choice
to another is spread across sections that never reference each other. And the paper's own order —
abstract, method, experiments — is the order of *publication*, not the order of *understanding*.

Four failures, and they are different failures:

1. **Unexplained prerequisites.** The reader hits a term and stops.
2. **Non-self-sufficient evidence.** A figure cannot be read where it sits.
3. **Invisible reasoning.** Why a choice was made, and what it cost, is never stated in one place.
4. **One fixed path.** There is a single route through, at a single level of detail.

## 2. The design response

Four structures, one per failure.

1. **A recursive concept tree** with an explicit knowledge floor. Every term above the floor is
   explained; a concept too large to explain in one breath contains smaller ones, recursively,
   until each bottoms out at the floor.
2. **Self-sufficient evidence items.** Every figure, table and equation carries a definition of
   every term and every number in it, plus what it establishes.
3. **A typed relationship graph.** Explicit, explained edges between concepts, evidence and
   results — the reasoning the paper leaves implicit, made into objects.
4. **Two narratives over one corpus, each recursive.** One follows the paper's order; one follows
   the graph. Each chapter opens into a smaller narrative of the same span at higher resolution.

## 3. Invariants

Non-negotiable properties. If one fails, the design has failed, not degraded.

- **No unexplained prerequisite term.** Anything above the floor is explained in place or is one
  click away. This is the product.
- **Every reference resolves.** No link, prerequisite, edge endpoint, theme member or child
  pointer may name something that does not exist.
- **Every claim is traceable.** Every surface cites the page of the source PDF it came from.
- **Each paper stands independently.** What is extracted from a cited paper belongs to that paper,
  reads without reference to whoever cited it, and is reusable by anything that cites it later.
- **Evidence strength is never inflated.** Where the source hedges, the explainer hedges. Where a
  claim rests on one example rather than a measurement, that is stated.
- **Coverage is auditable.** Anything deliberately skipped is recorded and shown, not silently
  dropped.

## 4. Object model

Eight node types. Ids are globally unique kebab-case slugs and are the only means of reference —
there are no positional or index-based links anywhere.

### Paper
The unit of ownership. One entry per paper ever touched, in a shared register.

`title · authors · source · status · addedAt` and, for a narrowly-read paper,
`extracted[] · citedBy[] · skipped`

`status` is `full` (the subject) or `narrow` (read only for what a citing paper needed). `skipped`
is the prose record of what was deliberately not extracted.

### Concept
The atom. Forms a tree by `parent`, and a DAG by `prerequisites`.

`id · name · tier · parent · summary · explanation · prerequisites[] · sectionIds[] · floor ·
citedFrom · sources`
plus `deepDive` when the mechanism is really defined elsewhere, and `ownerPaper · sourceNote` on
concepts belonging to a cited paper.

- `tier` — `major` earns its own page; `minor` renders inside its parent as an expandable section.
- `floor` — sits at or below the reader's assumed knowledge. Kept as a short stub, never broken
  down. Floor concepts are never `major`.
- `summary` — one or two sentences. Used as a lede, as card text, and in hover popovers, so it
  must survive being read out of context and must stay short.
- `explanation` — the body when no page exists for the concept.
- `citedFrom` / `deepDive` — the two halves of a borrowed mechanism: that this paper only uses it,
  and where its real definition lives.

### Item
A figure, table or equation, made to stand alone.

`id · kind · number · caption · page · asset · title · takeaway · walkthrough · latex · terms[] ·
numbers[] · sources`

- `title` is a *name*, not "Figure 3" — the printed number is derived from `kind` + `number`.
- `terms[]` — `{term, definition, conceptId}` for **every** symbol, axis, legend entry, row and
  column header and model name appearing in it. `conceptId` links out where one matches.
- `numbers[]` — `{value, meaning}` for **every** number or number family. The test: after reading,
  a reader can interpret any cell of the table.
- `asset` is the original crop. Figures are never redrawn — fidelity beats prettiness.
- `latex` re-typesets equations; equations get no crop.

### Edge
A relationship, as a first-class object with its own explanation.

`id · source · target · type · label · explanation · strength`

- `type` — one of a small fixed set of lenses. The default four: `depends-on`, `supported-by`,
  `instance-of`, `contrasts-with`.
- `strength` — `load-bearing` (the argument collapses without it), `supporting`, `minor`. Coverage
  rules key off this.
- `label` names the relationship concretely; `explanation` says why it exists and what the reader
  learns. Endpoints may be concepts, items, or concepts owned by cited papers.

### Theme
A grouping, of one of two kinds.

`id · kind · name · summary · members[] · order · sources`

`kind` is `concept-theme` (members are concept ids) or `edge-theme` (members are edge ids).
Membership is exclusive: nothing belongs to two themes.

### Page
Authored prose for a theme, edge-theme or major concept.

`id · forId · kind · body · sources`

`body` is markdown with `[[wiki-links]]` and KaTeX. A page never repeats what the app renders
around it — not the summary above, not the sub-concepts below, not the member edges.

### Narrative node
A recursive telling. The root is the whole span; each node retells one chapter of its parent at
higher resolution.

Narrative: `title · intro · chapters[] · nodes{} · sources`
Chapter: `id · title · body · number · childId · sources` (+ `edgeIds` in the second read)
Node: `id · parentId · parentChapterId · depth · number · title · intro · chapters[] · sources`

`childId` is the recursion. `number` is dotted (`3`, `3.2`, `3.2.1`) so depth is always legible.
Depth is **adaptive**: a branch expands only while it holds distinct sub-stories.

### Source reference
Attached to every surface. `{sections: [{id, title, start, end}], pages: [n]}`, or
`{paperId, note}` when the material belongs to a cited paper.

Concepts and items know their own. Themes, pages and narrative chapters **derive** theirs from
what they link to — so a citation stays correct as long as the links do.

## 5. Relationships between objects

```
Register ──owns──> Paper
                     │
   ┌─────────────────┼──────────────────┐
   │                 │                  │
Concept           Item               (cited Paper)
   │ parent          │ terms[].conceptId    │
   │ prerequisites   │                      │ deepDive
   └────────┬────────┴──────────────────────┘
            │
          Edge (source, target)
            │
   ┌────────┴────────┐
Theme            Edge-theme
   │                 │
   └────────┬────────┘
          Page (forId)
            │
   Narrative ── chapters ── childId ──> Narrative node ──> ...
   Insights  ── chapters ── edgeIds ──> Edge
```

Two rules govern the arrows:

- **Ownership beats reference.** A concept extracted from a cited paper is stored under that
  paper. Prose belonging to a cited paper may only link within that paper.
- **Derivation flows one way.** Sources and cross-narrative links are computed from links, never
  authored. Nothing downstream is hand-maintained.

## 6. Navigation model

Three distinct moves, and they must feel distinct.

| Move | What it does | Where |
|---|---|---|
| **Zoom in** | Same span, more resolution | A chapter opens its child narrative |
| **Zoom out** | Back up the tree | Breadcrumb, and an explicit "back out to" |
| **Step sideways** | Same depth, different object | A `[[link]]` into a concept, item or theme |
| **Switch read** | Same material, different order | Between the two narratives |

- Every narrative node is its own page with a breadcrumb to the root. Depth is shown, not implied.
- Recursion bottoms out **into the reference layer**: when a chapter is down to one mechanism, it
  stops splitting and links sideways instead.
- The two narratives cross-link where they cover the same ground, computed from shared links.
- A hover on any link previews the target's summary without navigating.

## 7. Content contracts

What each surface owes the reader. This is the definition of done.

**Concept page** — answers "what is this and why is it here" in two sentences; explains the
mechanism concretely enough to implement or teach; says why the choice was made and what it cost;
points at the evidence and rates it honestly. Does not restate its own summary or its children.

**Item** — a reader who has never opened the paper can read it. Every term defined, every number
explained, and a stated takeaway. Structured top-down: what you are looking at, how to read it,
what it shows.

**Theme page** — the connective tissue between its members, not a summary of each. Opens with the
question the theme answers; makes internal edges visible as reasoning; points backward and forward.

**Edge-theme page** — states the argument its edges collectively make and traces it end to end. It
is where an attentive reader learns what the paper did *not* prove.

**Narrative chapter** — works as continuous prose and as a hub. Every loaded term links. A child
node must *add resolution*: a chapter that restates its parent in different words is a defect.

**Second read** — each chapter is one insight, visible only across several relationships. Not
organised by relationship type; that is a filing system. Carries the raw edges beneath it and
reports what it left unused.

## 8. Editorial rules

Voice and pace are part of the design, not decoration.

- **Plain, not decorative, not authoritative.** Say what the source claims, does and shows — not
  what is true.
- **Hedge with the source.** "Suspects", "seems to", "is an estimate" survive intact. More room
  means a *clearer* hedge, never a softer or firmer one.
- **Banned words**, enforced mechanically: *novel, remarkably, elegant, powerful, seminal,
  groundbreaking, revolutionary, cutting-edge, crucial, delve, leverage* (verb), *it's worth
  noting, importantly, unlock, harness*.
- **Write in the source's moment.** No hindsight about what the field later did with it.
- **Pace** — configurable, and a real choice. *Slow*: one idea per sentence; unpack a compressed
  term before naming it; walk the arithmetic rather than stating the result; let a short
  consequence land. Slow is not padding, not chatty, and never talks down — it unpacks the
  *paper's* machinery, never the reader's background. Costs roughly 50% more words.
- **Link the first mention only.** One link per concept per surface. Repeating it is noise.

## 9. Rendering contract

What the client must guarantee, whatever it is built with.

- **Static and self-contained.** Generated data plus a viewer; no build step, no server required.
- **Every id is routable.** Concepts, items, themes, narrative nodes and papers all have a URL.
- **Markdown + KaTeX**, with a visible fallback when math fails rather than silent breakage.
- **`[[links]]` resolve or are visibly marked broken.** Never rendered as raw text.
- **Theme-aware** — light and dark both designed, including the system-default state.
- **Wide content scrolls in its own container**; the page body never scrolls sideways.
- **Original figure crops render at fidelity**, on a stable ground regardless of page theme.

## 10. Acceptance criteria

Machine-checkable. All must pass.

- Every `[[link]]`, `prerequisite`, edge endpoint, theme member and `childId` resolves.
- No cycle in the concept tree; every `parent` exists.
- Every `major` concept has a page.
- Every item has a walkthrough and a non-empty `terms[]`.
- Every non-floor, parentless concept belongs to exactly one theme.
- Every edge belongs to an edge-theme, and every `load-bearing` edge appears in the second read.
- No banned words anywhere.
- Every surface carries a source reference.
- After any prose rewrite: no link id and no number has disappeared.

## 11. Extension points

The design is deliberately open in four places.

- **Another read.** Narratives are a list, not a pair. A third — an implementation walkthrough, a
  critique — is a data file plus a registry entry; the viewer carries them generically.
- **Another lens.** Edge types are configuration. A paper whose interesting structure is temporal
  or causal gets different lenses without touching anything else.
- **Another audience.** The floor is one parameter. Changing it changes where recursion stops and
  which concepts are stubs — the structure is unchanged.
- **Another paper.** The register plus per-paper ownership means a second paper citing the first
  reuses what already exists rather than re-reading it. This is the design's real test, and it is
  the one thing here that has not yet been exercised.
