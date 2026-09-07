# Skimmaxxer — figures in the prose

A reader who reads visually is currently made to read a description of a picture that the project
already holds, cropped and captioned, one click away. Every surface knows which figure belongs where.
None of them show it.

This is the change that stops that, and the four pieces of feedback that arrive with it.

## What already exists

Nothing here needs a new pipeline stage, a new agent, or a new file on disk. The material is all
there and is only being withheld by the viewer.

| | |
|---|---|
| **Figures have pages** | `#/figure/fig-2` — the image, the printed caption, the takeaway, every term in it defined, every number in it explained. Six papers carry 198 of them. |
| **176 of the 198 have an image** | Cropped from the PDF and sitting in `papers/<id>/assets/`. Every `asset` path in every `items.json` resolves to a file that exists. |
| **The other 22 are equations** | No crop, but all 22 carry `latex`, and KaTeX is already loaded on the page. |
| **The prose already points at them** | In `1706.03762` alone the story links a figure 136 times, the concept pages 137 times, the insights 35 times. Every one of those `[[fig-…]]` links is an anchor saying *this figure belongs here*. |

So the work is a rendering change in `viewer/`, not a data change.

## The five changes

### 1. A figure link in the prose renders the figure

When a paragraph in the story or on a concept page links a figure, the paragraph reads through as
written and the figure appears in full underneath it — image, its printed number, its takeaway.

```
…which the paper implements with multi-head attention (Figure 2).

┌──────────────────────────────────────┐
│            [ figure image ]          │
└──────────────────────────────────────┘
FIGURE 2 · Multi-head attention
Runs attention h times in parallel on lower-dimensional projections.

The two most commonly used attention functions are additive and…
```

| | |
|---|---|
| **Where** | The story (`#/`, `#/n/…`, `#/insights`) and concept pages (`#/concept/…`). Not the summary, which links no figures anyway; not the theme pages or the figures index. |
| **What renders** | The image, then a mono label giving the printed number and title, then the takeaway in one or two lines. |
| **How big** | The column's width, capped at **420px tall**. A paper prints figures from a 200px table to a full-page architecture diagram, and an uncapped crop pushes the next paragraph off the screen — which is the difference between prose with pictures in it and a slideshow. Anything taller is scaled down; the click opens it at full size. |
| **Equations too** | An `[[eq-attention]]` link renders the formula, centred, with the same label and takeaway. All 22 image-less items are equations and all 22 carry `latex`, so nothing falls through. |
| **How often** | The **first** mention inside each `section.chapter`. Later mentions in the same chapter stay plain text links. A page with no chapters — a concept page — counts as one chapter, so one picture per figure per page. |
| **Why not every mention** | `table-3` is linked 28 times in the story of `1706.03762`. Rendering it 28 times is not a visual reading experience, it is a stutter. |
| **Two blocks of prose between figures** | Once per chapter was not enough on a figure-dense paper. `monosemanticity` prints 72 figures, and its story put **six into a chapter of eight paragraphs** — against a worst case of five in nineteen for `1706.03762`. That is the slideshow the eyes-on test is meant to catch, so a figure now needs two intervening blocks before the next one may appear. It brings that chapter to three, and the worst ratio across all six papers to 0.38. A link that loses its picture to the gap is still a link. |
| **Never twice over** | An equation is routinely printed by the prose itself — *"With those shapes fixed, Equation (1) is:"* and then the formula. Placing our own copy above the authored one showed the same maths twice in a row. Placement runs before KaTeX, so the authored maths is still its raw `$$` source and is simply compared against. |
| **Why not a thumbnail beside the text** | A floated 180px crop of a two-column architecture diagram is unreadable, and the prose column would jump around it. Full width or nothing. |

The link itself keeps its behaviour: still a `.term` link, still hoverable, still navigable. What is
added is a block after the paragraph, not a change to the sentence.

**Implementation shape.** `md()` returns a string, so the placement is a pass over the DOM after
`content.innerHTML = html` in `render()` — walk `a.term[data-id]` whose id resolves to an item,
find its containing block, insert the figure block after it, and keep a set of ids already placed,
keyed by nearest `section.chapter`. This means it works on every surface that renders markdown,
for free, and is switched on per-surface by where it is called rather than by rewriting each view.

### 2. Clicking an inline figure opens its whole page over the article

Not a lightbox of the image. The full `#/figure/…` page — caption, takeaway, every term, every
number, the walkthrough — in an overlay, with the article still behind it and your paragraph still
where you left it.

| | |
|---|---|
| **What renders in it** | `vFigure(id)`, unchanged. Same renderer the route uses, so there is no second version of a figure page to keep in step. This is what the reader's column already does with `columnPage()`. |
| **Closing** | Escape, the backdrop, or a close control. Nothing scrolls; you are back on the same paragraph. |
| **A way out** | A footer link — *Open this on the full site →* — for a reader who wants the real route and its back button. Again, the same thing the reader's column already offers. |
| **Deep links still work** | `#/figure/fig-2` typed or shared still opens the standalone page. The overlay is an addition, not a replacement. |
| **Math inside it** | `mountMath()` runs on the overlay body, so equations render there as they do everywhere else. |

### 3. Thumbnails where the site already names a figure

Two places name a figure and show no picture. Both get one.

**The annotated reading column** (`figRow`, `viewer/app.js:836`). The *Shown in §3.2* and *Also
shown here* rows are a mono label and a title. They get a small crop on the left of the row.

Only those rows. When you scroll onto a figure, the column's own row for it stays text — the paper
is right there on the left showing you the figure at full size, and a thumbnail of what you are
looking at is noise.

**Concept pages, "Where you can see it"** (`viewer/app.js:484`). Cards of a title and a takeaway
become cards that lead with the image. This was the literal ask in the feedback, and it stays a
stack of wide cards rather than becoming a grid — the section is an epilogue to a concept page, not
a gallery.

The figures index (`vFigures`) is not in this change. It already renders a 130px crop per card; if
it read as a list of descriptions, that was change 5.

### 4. Search says which paper a hit came from

The search in the sidebar already indexes every paper — all bundles are loaded into one `INDEX`, so
a concept from a cited paper is already findable. Two things make it feel local:

| | |
|---|---|
| **It stops early** | `onSearch` breaks at 60 candidates, scanning `INDEX` in insertion order, and the paper you are in was indexed first. On a paper with 276 concepts, the scan can end before it ever reaches another paper. Scan everything, then rank. |
| **A hit never says where it is from** | A row shows a name and a kind. Two papers can own a concept with the same name and the reader cannot tell them apart, so the search reads as though it only knows this paper. Each row gains the paper's short title. |

Ranking stays as it is otherwise — a prefix match first, then shortest name. The current paper is
not privileged: a global search that quietly prefers where you are standing is the thing being
fixed.

No search is added to the library page. Finding a concept without first choosing a paper is a real
want, but it is a different surface with a different job and it is not this change.

### 5. The image that did not load

One figure failed to appear when opened through the app and was fine after a full reload.

Not a bad path: every `asset` in every `items.json` across all six papers resolves to a file that
exists on disk. So it is a loading bug in the app, and the leading suspect is
`loading="lazy"` on the figures index — images inserted by `innerHTML` and then followed
immediately by `window.scrollTo(0, 0)` can be evaluated for laziness against a viewport that is
about to change, and never fetched.

**What reproducing it actually showed.** It does not happen locally. Forty figure pages walked in a
row on `monosemanticity`, the figures index reached cold and by in-app navigation, and a deep scroll
followed by a hash change — every image arrived, every time. The asset audit came back clean too:
no missing file, no case mismatch, nothing needing URL encoding. So the failure is transient and
almost certainly belongs to the deployed site rather than the code — a fetch that lost once.

Which makes the fix the right one anyway, and honest about what it is: **every image the app draws
now retries itself once before it is written off.** That is precisely what the reader was doing by
hand when they reloaded the page. It is not a root-cause fix, because there is no reproducible root
cause to fix; it converts a permanently broken figure into one that heals itself. One delegated
listener, on the capture phase since load failures do not bubble, guarded so it fires once and
never loops.

This matters more now than it did — after change 1 there are images in the reading path, not just
on an index someone visits deliberately.

## The library, and one paper that half-exists

A separate piece of feedback: a paper listed but not fully processed, with no figures, gives no
warning. The rule chosen is that **a card may not promise what is not behind it**.

The register is in better shape than it first looks. Every one of the 30 registered papers has a
bundle, and every narrow read has its concepts. Exactly one paper is caught by the rule:

**`global-workspace`** — `status: full`, 249 concepts extracted, and then nothing. No story, no
themes, no written pages, no items. It has ten images sitting in `assets/` that no `items.json`
points at. Its library card renders in **Read in full** with no tabs, and its *Paper wiki* door
leads to a shell whose story is empty.

So the rule bites once, and the fix is:

- A paper claiming **Read in full** must have a narrative and concepts behind it. One that does not
  is hidden from the library entirely — out of the shelf, out of the tally — until its run
  finishes. `global-workspace` is the only paper this removes today.
- A narrow paper with no concepts is hidden on the same grounds. (None today.)
- Doors and tabs render only where there is data behind them — which `panels()` already does for
  tabs, and `fullPanel` already does for the reader door.

Demoting a half-read paper into the narrow list was considered and rejected: `narrowRow` prints
every concept uncapped, so `global-workspace` would render a 249-item list under a heading saying
the paper was opened for one mechanism and closed again — a worse lie than the one being fixed. A
paper that is not ready is simply not on the shelf. Nothing is deleted; the moment its run
finishes, it reappears.

## What is not in this

- **No pipeline change.** Nothing is regenerated, no agent runs, no paper is reprocessed. Every
  number above is read off what is already on disk.
- **No search on the library page.**
- **No redesign of the figures index.**
- **Nothing in the annotated reading page's paper pane.** The rule that nothing is drawn on the
  paper while you read still holds; the thumbnails are in the column, on the column's side.

## The moment that needs your eyes

Open the story of `1706.03762` and read one chapter end to end. The question is not whether the
images render — that is a check. It is whether the chapter still reads as prose with the pictures
in it, or as a slideshow with captions. If it is the second, the answer is a stricter placement
rule, not smaller pictures.
