# Skimmaxxer — Workflow

A high-level working doc for Skimmaxxer: an agent pipeline that takes one research paper (PDF) and produces a static web app that re-explains it. This records the intended workflow and my preferences — it is not a technical spec.

This file is the record for **one paper**. The design of the artifact is in [DESIGN.md](DESIGN.md),
what to do when a new paper arrives is in [PLAYBOOK.md](PLAYBOOK.md), and the machinery that
produces it is in [METHOD.md](METHOD.md).

## The idea

A paper assumes too much. The app removes that assumption: every prerequisite term is explained in place or is one click away, every figure stands on its own, and a narrative puts the pieces back together. Everything gets broken down and then reassembled, and the reader can reach the same idea from several directions — the storyline, the theme it belongs to, or the figure that supports it.

## Decisions

- **Scope** — Built for one paper now, but parameterized so another PDF can be swapped in later. Paper: *Attention Is All You Need* (Vaswani et al. 2017, arXiv 1706.03762).
- **Audience** — ML practitioner. The recursive concept breakdown bottoms out at standard ML knowledge (gradient descent, transformers, common metrics). Anything above that floor must be explained.
- **App form** — Static site. The pipeline emits JSON; a single-page HTML/JS viewer renders it. No build step, opens locally, hostable anywhere later.
- **Figures** — Original images cropped from the PDF, shown beside their written breakdown. No redrawing.
- **Equations** — Re-typeset with KaTeX. Every symbol defined below the equation, plus one sentence on what it does and why it's there.
- **Two narratives** — The app has two ways through the same material, side by side. *The story* is the tour: the paper front to back, in the order it tells it. *Insights* goes sideways: its spine is the 116 relationships, and its chapters are the things you only see when several of those sit next to each other. Each chapter carries the raw relationships behind it in a drawer, and the two narratives link into each other wherever they cover the same ground.
- **Narrative** — Recursive. One main storyline retells the paper; every chapter opens into a smaller narrative of its own, which does the same again, until a branch bottoms out. Each level is a page with a breadcrumb back up. Depth is adaptive — a branch keeps splitting while it still has distinct sub-stories, and stops when a chapter is down to a single mechanism. The reference layer (concept and figure pages) sits underneath as the leaves.
- **Pages** — Full pages for themes, edge-themes, and major concepts. Small sub-concepts render inline as expandable sections or hover definitions.
- **Cited papers** — A concept that really comes from a cited paper gets that paper read too, but in a narrow scope: only the concepts needed here. Every processed paper is recorded in a shared register and reused rather than re-read (details below).
- **Voice** — Plain, not decorative or authoritative (rules below).
- **Pace** — Slow, not fast. One idea per sentence. Unpack a compressed term the first time it does real work — show the mechanism, then name it. Walk the arithmetic instead of stating the result. Let a short sentence land. Slow does not mean padded, chatty, or talking down: the reader is still an ML practitioner, and slowing down means unpacking the paper's machinery, never their background.
- **Citations** — Every page links back to the page of the PDF it came from. Concepts cite their sections; figures cite their page; themes and narrative chapters inherit theirs from whatever they link to. A concept lifted from a cited paper cites *that* paper's PDF instead.

## Status

The whole pipeline has run on *Attention Is All You Need*, and the quality gate is clean. What exists:

- 97 concepts in a recursive tree — 19 major, 12 sitting at the assumed-knowledge floor. No cycles, no dangling prerequisites.
- 14 self-sufficient figures, tables, and equations, with 271 terms and 181 numbers individually defined.
- 116 relationships across the four lenses, all with resolvable endpoints, grouped into 8 concept themes and 7 edge-themes.
- 34 generated pages, ~16,600 words, 673 internal links, all resolving.
- 6 cited papers fetched, read narrowly, and registered as independent papers.
- The narrative tree: a root of 9 chapters plus 24 sub-narratives over 3 levels — 109 chapters, ~1,050 links. Deepest branches run four numbers deep (2.3.4.1: the wrapper → add-then-normalize → why layer norm not batch norm → what one batch actually holds).
- All of it re-paced to the slow register in a second pass over 89 units: 69,579 → 105,049 words (+51%), with zero links dropped.
- Source citations on every surface, linking into the PDF at the right page.
- Insights, the second narrative: "What Holds What Up" — 9 insight chapters plus 2 sub-narratives, ~6,200 words, 218 links. All 116 edges used, all 39 load-bearing ones covered, and the chapters that only name an edge in passing are listed in the app rather than glossed over.
- 86 named-but-unlinked concept mentions found and linked, bringing the total to 1,966 internal links at a median of one per 50 words.

The quality gate reports no unresolved links, no dangling prerequisites, no cycles, no major concept without a page, no figure without a walkthrough, and no banned words.

**Known gap, accepted.** Two body paragraphs never reached the section text. The figure-crop bands
for Tables 3 and 4 ran past the tables and swallowed them, and text inside a crop band is excluded
from the section files — so the pipeline never saw:

- p9 — *"development set, newstest2013. We used beam search as described in the previous section, but
  no checkpoint averaging. We present these results in Table 3."*
- p10 — *"increased the maximum output length to input length + 300. We used a beam size of 21 and
  α = 0.3 for both WSJ only and the semi-supervised setting."*

Found while ingesting GPT-1, which had the same defect. The cause was the length floor in
`is_stopper`, since lowered from 180 to 120 characters, so a re-run would pick both paragraphs up.
Decided not to re-run: it would change the raw material underneath content that is already written
and verified, for two sentences of inference setup. Worth knowing if a reader ever asks where the
beam size of 21 went.

One observation worth recording: the voice rules push the pages toward skepticism. Several separate what the paper measured from what it asserted — the training-cost FLOPs being an estimate, the sinusoid choice resting on an untested hope, Figures 4 and 5 being hand-picked examples. That reads as the rules working, but if the tone should sit closer to the paper's own framing, that is a prompt change in stage 5.

## Running it

```
python pipeline/ingest.py          # 0: PDF -> sections, page renders, crops
python pipeline/node_index.py      # index the agents read
python pipeline/page_briefs.py     # per-page brief files for the stage-5 fan-out
python pipeline/bundle.py          # JSON -> JS bundles the viewer loads
python pipeline/qa.py              # 7: quality gate
```

The agent stages run as workflows; each `save_*.py` script files a stage's output and re-validates it. Then open `viewer/index.html` — the library, listing every paper — or serve the folder over HTTP (a `file://` browser caches the data bundles, so a hard reload is needed after regenerating).


## Pipeline

Each stage runs as a fan-out of agents, and each stage writes its output to disk before the next starts — so any stage can be re-run alone.

**0. Ingest (scripted, no agents).** Split the PDF into per-section text, page images, and cropped assets — figures, tables, equations — with their captions. Everything downstream reads from this.

**1. Concepts — 3 agents.** The paper's sections are split three ways (roughly: framing + related work, method + theory, experiments + results). Each agent extracts concepts at fine granularity. Concepts can contain sub-concepts, recursively; the recursion stops only when a concept is understandable to an ML practitioner without further explanation. The point: no unexplained prerequisite term anywhere. When a concept's real source is a cited paper ("we use the gating mechanism of [23]"), the extractor flags the citation instead of guessing — the cited-papers step below picks it up. A merge step dedups concepts found by more than one agent.

**2. Figures — one agent per figure.** Every figure, table, and standalone equation gets its own agent, which extracts and defines every term and number in it — axes, legends, symbols, baselines, metric values — and writes the takeaway. Result: each figure is self-sufficient, understandable without reading the paper body.

**3. Edges — 4 agents.** Four agents look for relationships between the concepts, definitions, and experiments, each through a different lens. Working set of lenses (adjustable at run time):

1. depends-on / prerequisite
2. supported-by (claim ↔ experiment or figure)
3. is-instance-of / defined-as
4. contrasts-with / trades-off-against

Output is typed edges between nodes.

**4. Themes — 2 agents.** One groups concepts into themes; the other groups edges into edge-themes (e.g., "how the model is trained", "why it beats the baselines").

**5. Pages — fan-out.** One agent per theme, edge-theme, and major concept writes that page. Minor sub-concepts fold into their parent page as expandables. Every page follows the voice rules and links loaded terms to their pages.

**6. Narrative — 1 agent, then a recursive fan-out.** First one agent writes the root storyline: the whole paper start to finish, in chapters. Then the tree grows round by round. Each round takes the chapters that declared they still hold a distinct sub-story and gives each its own agent, which retells that one span at higher resolution as its own small narrative — and decides, per chapter, whether to go deeper again. Rounds stop when nothing declares more depth, or at the depth cap. An agent must add resolution rather than restate its parent; a chapter that only rephrases the level above is a failure. Branches bottom out into the concept and figure pages.

**6b. Re-pace (when the voice changes).** Rather than regenerate, a pass rewrites existing prose for rhythm only and is checked mechanically: every wiki-link id and every number present before must be present after. That keeps the researched content — which is the expensive part — and changes only how it reads.

**6c. Citations (scripted, no agents).** Parse the PDF for where each section starts and ends, then attach page references to every surface. Concepts and figures know their own; themes, pages and narrative chapters derive theirs from what they link to, so a citation stays correct as long as the links do.

**6d. Auto-link (scripted, no agents).** Agents link the terms they happen to think of, which is not the same as linking all of them. This pass builds a surface-form table from every concept name — including its abbreviation, so "BPE" reaches the byte-pair encoding page — and finds places where a concept is named in prose but never linked. Deliberately conservative: only the first unlinked mention in a text, never inside existing links, math or code, never a self-link, and never a cross-paper link, since each paper stands independently. Ambiguous surface forms that match more than one concept are dropped rather than guessed.

**6e. Insights (1 agent, then a fan-out).** A second narrative whose spine is the edges rather than the paper's own order. One agent reads every relationship and finds the insights — a chain nobody states in one place, a gap between what is asserted and what is measured, a repair for a problem the design created — then decides which of them hold several strands worth their own node. Each chapter declares the edges it draws on, which is both how the app renders them beneath the chapter and how coverage is checked: every load-bearing edge must land somewhere. The agent also reports what it did not use, and that note is shown to the reader.

**7. Quality gate.** Two checks before the app counts as done: (a) every internal link resolves; (b) a lint pass crawls all pages and the narrative for terms above the ML-practitioner floor that are used but never defined or linked — hits go back to the concept stage. This enforces the core idea; it is not optional polish.

## Cited papers

When a concept the paper leans on is defined in a cited paper, the citation gets followed, not paraphrased blind. Rules:

- **Narrow scope.** The cited paper is read only to extract the concepts the citing paper actually needs — nothing else. No figures, no themes, no narrative; those only happen if that paper is later run as a main paper in its own right.
- **Independence.** What gets extracted is stored under the cited paper, in the same format as any paper's concepts. Each paper's output is self-contained and owned by that paper, not by whoever cited it — that is what makes reuse possible.
- **The register.** A single top-level register lists every paper ever touched — main or cited — and what has been extracted from it so far. Before fetching a cited paper, check the register: if it's there, reuse it, extending it only if this run needs concepts that weren't extracted before.
- **Provenance.** Each paper keeps a list of the referenced papers it accessed during its run. Pages that use an imported concept say which paper it comes from; the concept's page belongs to the paper that owns it.
- **Depth.** Follow citations one level by default. If a cited paper's explanation itself leans on yet another citation, explain at the ML-practitioner floor and flag it rather than recursing. Adjustable.

## Voice rules

- Plain over decorative: no "remarkably", "elegant", "powerful", "novel".
- Explanatory over authoritative: say what the paper claims and shows, not what is true. Where the paper hedges, the pages hedge.
- Define before use. If a term needs a page, link it the first time it appears — and only the first time. One link per concept per page; repeating it every mention is noise.
- Short sentences. Concrete examples over abstract restatements.

## Data flow

Everything is organized per paper, plus one shared index:

- `register.json` — the register: every paper ever processed, its ID, and what exists for it.
- `papers/<paper-id>/` — that paper's world: `paper.pdf`, `assets/` (figure crops, page images), `data/*.json` (concepts, figures, edges, themes, pages, narrative), and `refs.json` (the cited papers this run accessed).
- `viewer/index.html` — the library: every registered paper, and how the concepts inside each one are grouped.
- `viewer/read.html?p=<paper-id>` — one reader shell for any paper. It loads every bundle, so a cross-paper concept link renders in place rather than sending the reader to another document.
- `netlify/functions/` — the only server-side code: `request-paper` files a reader's request in the
  `paper-requests` blob store, `admin-requests` reads them back for the admin page.
- `viewer/admin.html` — the request book, behind the `ADMIN_PASSWORD` set in the Netlify site's
  environment variables. Not linked from anywhere and marked `noindex`.

## Deploying

Netlify, publishing the repo root (`netlify.toml`). Nothing is built — `npm install` runs only so the
two functions can bundle `@netlify/blobs`. `/` redirects to `/viewer/`, and `/api/*` maps to the
functions.

One setting has to be made by hand in the Netlify UI: **`ADMIN_PASSWORD`**, under Site configuration
→ Environment variables. Without it the admin endpoint refuses every request rather than falling
open. Requests land in Netlify Blobs, which the free tier includes; readers never see them.

## Open items

Settled during the first run: the four edge lenses were used as listed and produced a balanced spread (32/30/26/28), so they stay. Cited papers are fetched from arXiv automatically by id; the one-level depth default held — nothing in the six narrow reads needed a second hop.

Still open:

- Insights only expanded 2 of its 9 chapters. The agent was told to prefer not expanding when unsure, and it took that seriously. Worth a look at whether chapters 1, 5 and 6 deserve nodes.
- Two branches independently descended into byte-pair encoding (5.2.4 and 7.1) and wrote the merge loop twice, from different angles. Each is right in its own context, but rounds are computed per-branch with no cross-branch awareness, so nothing noticed. Either accept it as honest repetition or add a dedup pass between rounds.
- Whether the skeptical tone described under Status is what I want.
- Hosting — local is fine for now; revisit if it's ever shared.
- Second paper — the real test of whether the register earns its keep is a paper that cites one already in it.
