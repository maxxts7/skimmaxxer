# Skimmaxxer — Workflow: GPT-1

The record for one paper: *Improving Language Understanding by Generative Pre-Training* (Radford,
Narasimhan, Salimans & Sutskever, 2018). Register key `gpt-1`.

The design of the artifact is in [DESIGN.md](DESIGN.md), what to do when a new paper arrives is in
[PLAYBOOK.md](PLAYBOOK.md), and the machinery is in [METHOD.md](METHOD.md). This paper is being read
as the second half of a cross-paper test — the decisions that concern *both* papers live in
[CROSSPAPER.md](CROSSPAPER.md), not here. [WORKFLOW.md](WORKFLOW.md) is the record for the first
paper.

## Decisions

- **Paper** — GPT-1, 12 pages, 7 evidence items (2 figures, 5 tables). No arXiv id; the PDF is the
  OpenAI-hosted one, at `papers/gpt-1/paper.pdf`.
- **Audience** — unchanged from the first run: an ML practitioner, bottoming out at gradient descent,
  transformers and common metrics.
- **Stands alone** — every concept GPT-1 needs is explained on GPT-1's own pages, and the concepts
  carry nothing pointing at any other paper. A reader who never leaves this paper still learns what
  BPE is. Where GPT-1 diverges from the Transformer — decoder-only, masked self-attention, learned
  rather than sinusoidal position embeddings — it explains that in its own terms too.
- **Connections live on one page** — a single *How this relates to other papers* page holds every
  cross-paper link: what GPT-1 borrows from papers already here, and where it diverges from them.
  Nothing else in the paper references another paper. See [CROSSPAPER.md](CROSSPAPER.md).
- **Ids** — clean slugs, with a `-gpt1` suffix only where one would collide with an existing id.
  Eight of the terms this paper needs are already claimed by `1706.03762`.
- **Pace** — slow, same as the first run. Written slow from the start; the re-pace stage is not
  planned for this paper.
- **Lenses** — the same four: `depends-on`, `supported-by`, `instance-of`, `contrasts-with`.
- **Depth cap** — 3.
- **Citations** — followed one level, mechanism-borrowed only. Two of the expected three targets
  (BPE, Layer Norm) are already in the register; their existing extraction is the source material for
  GPT-1's own explanations, and neither PDF is opened again. Expected new reads: GELU
  (Hendrycks & Gimpel) and possibly the decoupled-weight-decay regularization GPT-1 cites as [37].
- **Viewer** — a second entry point, `viewer/gpt.html`, sharing `app.js` and `style.css` with the
  first paper's shell.

## Status

**Complete. The quality gate is clean, and so is the first paper's.**

| | |
|---|---|
| Sections | 14, abstract through references |
| Items | 12 — Figures 1–2, Tables 1–5, 5 equations — 227 terms and 180 numbers defined |
| Concepts | 120 — 20 major, 5 floor, 33 carrying `citedFrom`, **0 carrying `deepDive`** |
| Id renames | 7, all `-gpt1`: transformer, layer-normalization, adam-optimizer, dropout, lstm, long-range-dependencies, byte-pair-encoding |
| Relationships | 130 across four lenses — 30 / 33 / 34 / 33, near-even |
| Themes | 8 concept, 7 edge |
| Pages | 36 — 20 concept, 8 theme, 7 edge-theme, 1 relations — 18,400 words |
| The story | 9 root chapters, 21 sub-narratives, 107 chapters, 28,413 words, 961 links |
| Insights | "Reading Across the Paper", 9 chapters + 2 sub-narratives, **130/130 edges used, 31/31 load-bearing covered** |
| Cited papers | 7 leaned on — **3 already held, 4 newly read** |
| Project total | 12 papers, 289 routable ids, 0 duplicates |
| Overrides needed | `equations.json` only. No `headings.json`, no `crops.json` |

### The reuse result

The measure set in [CROSSPAPER.md](CROSSPAPER.md) was *PDFs not opened again*. Of the seven papers
GPT-1 leans on, three were served entirely by reads that already existed — *Attention Is All You
Need*, Sennrich (BPE) and Ba et al. (layer normalization). None was fetched, re-read or modified;
each simply gained `gpt-1` in its `citedBy`. `1508.07909` and `1607.06450` now read
`citedBy: ["1706.03762", "gpt-1"]` — one narrow read serving two papers, which is the thing DESIGN
§11 said had never been exercised.

Four were genuinely new and were read narrowly: the decoder-only transformer variant (`1801.10198`),
decoupled weight decay (`1711.05101`), GELU (`1606.08415`), and the traversal-style serialization
(`1509.06664`). Nothing GPT-1 needed turned out to be missing from the three existing reads, so the
`skipped` records did not have to be reopened.

An earlier note here said GPT-1 had no displayed equations worth inventorying. That was wrong. It has
five numbered ones and they carry the whole method: the pre-training objective $L_1$, the decoder
stack from tokens to a next-token distribution, the task head, the supervised objective $L_2$, and
the combined objective $L_3 = L_2 + \lambda L_1$. All five sit on page 3 and are listed in
`papers/gpt-1/equations.json`, bringing the item count to 12.

`ingest.py` also gained a fix here: inventoried equations arrived with no page, so an agent told to
check notation against the page image would have been sent to the title page. The page is now taken
from the section the equation was declared in.

## Ingest findings

PLAYBOOK calls the crop check the most important manual moment in the process, and this is a paper
the heuristics had never seen: OpenAI's own layout rather than arXiv LaTeX. Two defects, both of the
kind that fail quietly.

**Ligatures were not normalized, and this paper has them.** The PDF emits 83 × `U+FB01` and 2 ×
`U+FB02` — `ﬁ` and `ﬂ` as single characters where the reader sees two letters. Section 3.2 came out
as `Supervised ﬁne-tuning`. Nothing errors: `"fine" in "ﬁne-tuning"` is simply `False`, so every
string comparison, id match and search silently misses. The filename slug was worse than expected —
`re.sub(r"[^a-z0-9.]+", "-", ...)` drops the character rather than keeping it, yielding
`supervised-ne-tuning`, with letters gone.

Fixed with an explicit `LIGATURES` map applied at every point text leaves the PDF. Deliberately not
`unicodedata.normalize("NFKC", ...)`, which would also rewrite superscripts, fractions and math
symbols — this paper's extracted text contains λ, Θ, ⟨⟩, ≈, ∀, ∈, ä and Ł, all of which have to
survive intact. The first paper's text has zero ligatures, which is why this never came up.

**Table 1's crop overshot into body text, and that text was then lost.** The band ran 44 points past
the table and swallowed a 156-character paragraph from Section 4.1. Because `ingest.py` excludes
blocks inside crop rects from the section text, those two sentences — including the BooksCorpus
perplexity of 18.4 — were in the PDF and absent from the section files.

The cause was the length floor in `is_stopper`: body prose separates cleanly from table content by
average line length (73–94 against a maximum of 36.5), but the `len(t) > 180` condition let two-line
paragraphs through. Lowered to 120, which is below the shortest real paragraph observed (147) and
still well above stray lines. Table 1 re-cropped clean and Section 4.1 grew from 2,223 to 2,381
characters.

**This bug also affected the first paper** — see below.

**Everything else detected correctly.** All 13 headings with the right numbering and nesting,
including the number-and-title-as-separate-lines case. All 7 captions. All 7 crops verified by eye:
both figures complete with legends and axis labels, all five tables complete including Table 4's
two-level header.

## Affects the first paper

The `is_stopper` fix changes AIAYN's Table 3 and Table 4 crops too, because AIAYN has the same
defect. Two body paragraphs were swallowed and are missing from its section text:

- p9, Table 3 — *"development set, newstest2013. We used beam search as described in the previous
  section, but no checkpoint averaging. We present these results in Table 3."*
- p10, Table 4 — *"increased the maximum output length to input length + 300. We used a beam size of
  21 and α = 0.3 for both WSJ only and the semi-supervised setting."*

Those carry real inference hyperparameters. They were absent from the section text for the entire
run that produced 97 concepts, 34 pages and a clean quality gate — the gate cannot see material that
never reached it.

**Decided: leave the first paper as it is.** Re-running its ingest would change the raw material its
97 concepts and 34 pages were written from, which is not worth doing for two sentences of setup
detail. The fix is in the shared script, so it applies if that paper is ever re-run for another
reason. The gap is recorded in [WORKFLOW.md](WORKFLOW.md) so it is not rediscovered as a surprise.

## Running it

Same scripts, retargeted by one environment variable:

```
SKIM_PAPER=gpt-1 python pipeline/ingest.py          # 0: PDF -> sections, page renders, crops
SKIM_PAPER=gpt-1 python pipeline/node_index.py      # index the agents read
SKIM_PAPER=gpt-1 python pipeline/page_briefs.py     # per-page briefs for the stage-5 fan-out
python pipeline/bundle.py                           # JSON -> JS bundles (all papers)
python pipeline/qa.py                               # 7: quality gate
```

`paper.py` resolves `SKIM_PAPER` before `pipeline/active.json`, so the first paper's `active.json`
can stay as it is and neither run disturbs the other.

## Expected shape

Recorded now so it can be checked against what actually comes out, since a large gap either way is
itself a finding.

- Fewer concepts than the first paper's 97, but not by as much as the page count suggests. GPT-1 is
  shorter, and much of its method is borrowed — but under the standalone rule each borrowed mechanism
  still earns a real concept here rather than collapsing into a pointer.
- 7 items against the first paper's 14.
- The method half is thin and the evaluation half is thick — the reverse of the first paper. Sections
  3.1–3.3 hold the whole architecture; 4.2 and 5 hold twelve datasets across four task families.
  If the concept counts come out balanced, the extractors have probably over-mined the benchmarks.
- The `contrasts-with` lens should be busier than it was on the first paper: GPT-1 is arguing against
  ELMo-style feature transfer and against task-specific architectures, and those are contrasts rather
  than dependencies.
