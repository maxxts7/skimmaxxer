# Cross-Paper — Reading a Second Paper Against the First

[DESIGN.md](DESIGN.md) §11 lists four extension points and says of the last one: *"a second paper
citing the first reuses what already exists rather than re-reading it. This is the design's real
test, and it is the one thing here that has not yet been exercised."*

This document is that test being set up. The per-paper record for the second paper is
[WORKFLOW-gpt-1.md](WORKFLOW-gpt-1.md); the first paper's is [WORKFLOW.md](WORKFLOW.md).

---

## The subject

**GPT-1** — *Improving Language Understanding by Generative Pre-Training*, Radford, Narasimhan,
Salimans & Sutskever (2018). Register key `gpt-1`, since the paper has no arXiv id and every path in
the tree is keyed on one.

It was chosen over GPT-2/3/4 because it is built on *Attention Is All You Need*, so the machinery
under test is load-bearing rather than decorative. It is also 12 pages, which keeps the fan-out
comparable to the first run instead of confounding the test with scale.

## The rule

> **Every concept GPT-1 needs is explained on GPT-1's own pages, and carries links out to other
> explanations of the same thing.**

A reader who opens GPT-1 and never clicks anything still learns what byte-pair encoding is and what
40,000 merges buys them. The links are doors, not prerequisites.

This is not a new pattern — it is what the first paper already does. Of AIAYN's 97 concepts, **16
carry both their own explanation and a pointer onward**. `byte-pair-encoding` is a full page under
AIAYN, 4,640 characters, *and* points at the 2015 paper that introduced it. The explanation and the
link were never alternatives.

An earlier draft of this document said GPT-1's borrowed concepts would be "stubs that link across
rather than re-explaining." That contradicted what the data already does, and is withdrawn.

## One page holds every connection

Concepts carry nothing about other papers. No pointer, no "see also", no shared-origin field. Read
GPT-1's concept tree and nothing in it reveals that another paper exists in the project.

Every connection lives instead on a single page per paper — **How this relates to other papers** —
which compares what this paper does against the papers already here. That page is the only place
cross-paper links appear.

Why this rather than links inside concepts:

- **A paper reads as though it were the only one.** Detachment is the default; connection is
  somewhere the reader chooses to go.
- **One place to check.** Whether the relating is any good is a question about one page, not about a
  field scattered across ninety-odd concepts.
- **Nothing to unpick.** Removing a paper touches one page per other paper, not their concept data.
- **It compares ideas, not slugs.** Matching ids would find `byte-pair-encoding` in both papers. It
  would not notice that GPT-1 takes the Transformer decoder and points it at something the
  Transformer paper never attempted — the more interesting relation, and the one no rule finds.

The cost, stated plainly: a reader on GPT-1's BPE page is not told that a fuller account sits one
click away. They meet it on the relations page or not at all.

### What the page holds

Two kinds of entry.

**What it takes from a paper already here.** BPE from Sennrich 2015, layer normalization from Ba et
al., the decoder stack from *Attention Is All You Need*. Each says what is borrowed and links to that
paper's own account.

**Where it diverges or goes further.** Decoder-only rather than encoder-decoder, learned rather than
sinusoidal position embeddings, and the move from translating with a Transformer to pre-training one
and fine-tuning it across twelve tasks.

The second kind is why the page is written rather than computed. No rule over concept ids produces
it.

### Consequences

- **GPT-1's concepts get `citedFrom` but not `deepDive`.** `citedFrom` records a citation the paper
  itself makes — "[53]" is GPT-1's own text, not a link into this project. `deepDive` is a hard
  pointer into another paper's concept ids, and that is precisely the coupling being removed.
- **AIAYN is unchanged.** Its 16 `deepDive` concepts stay as they are. It was built before this rule
  and re-doing it is not worth the churn. It can have a relations page of its own later.
- **No other paper's files are touched.** The page belongs to the paper doing the relating.

## Ids: suffix on collision

Ids are global, and `app.js:15` indexes with `if (!INDEX[c.id])` — so a duplicate id is **silently
dropped**, and the second paper's concept simply never renders. No error anywhere.

The register currently holds **123 concept ids** across seven papers. Of the terms GPT-1 will want,
`byte-pair-encoding`, `layer-normalization`, `residual-connection`, `token-embeddings`,
`positional-encoding`, `dropout`, `adam-optimizer` and `multi-head-attention` are already taken by
`1706.03762`. `masked-self-attention`, `position-embeddings`, `decoder`, `feed-forward-network`,
`gelu`, `fine-tuning` and `language-modeling-objective` are free.

**Rule:** GPT-1 concepts take clean slugs; where one would collide, it takes a `-gpt1` suffix —
`byte-pair-encoding-gpt1`. Nothing is renamed retroactively. Since the scheme only shows itself at a
collision, the merge step checks every proposed id against the global set, and the quality gate fails
on duplicates rather than letting the viewer swallow them.

Worth being honest about what this is: a global id space is itself a coupling between papers, and it
pulls against the detachment above. The suffix is a workaround for how the viewer indexes, not a
statement that GPT-1's BPE concept is a lesser version of AIAYN's. The properly detached fix is for
the viewer to key concepts by paper as well as id, which would let every paper use natural slugs and
make the suffixes unnecessary. That is a viewer change, not a data change, and it can happen later
without touching anything written before it.

## Depth

Teach the mechanism, framed by GPT-1's use. Target the precedent already set by AIAYN's borrowed
concepts: roughly a thousand characters of explanation — enough of the merge algorithm that "40,000
merges" means something, told through GPT-1's setup rather than the 2015 paper's.

GPT-1 gives BPE a single clause: *"We used a bytepair encoding (BPE) vocabulary with 40,000 merges
[53]."* So nearly all of that content comes from the extraction already sitting under `1508.07909`.

For the architecture, the same rule applies where GPT-1 **diverges** — decoder-only, masked
self-attention, and learned rather than sinusoidal position embeddings, which the paper explicitly
chose over "the sinusoidal version proposed in the original work." The shared parts of the stack link
across. The divergences are what GPT-1 is about.

## What is being tested

> When GPT-1 needs byte-pair encoding, layer normalization and the transformer decoder, can it write
> its own account **from what has already been extracted**, without going back to the source PDFs?

Two of those three are already in the project from the first run, read narrowly *for a different
paper*. If the filing rule works, that read should be enough.

### The result

The run is done and both papers pass the gate. Of the seven papers GPT-1 leans on, **three were served
entirely by reads that already existed** — *Attention Is All You Need*, Sennrich (BPE) and Ba et al.
(layer normalization). None was fetched, re-read or edited; each gained `gpt-1` in its `citedBy`, and
`1508.07909` and `1607.06450` now read `citedBy: ["1706.03762", "gpt-1"]`. One narrow read, two
papers. Four were genuinely new and were read narrowly. Nothing GPT-1 needed turned out to be missing
from the three existing reads, so no `skipped` record had to be reopened.

Three scripts had to be corrected first, and the pattern is worth stating plainly: `node_index.py`,
`page_briefs.py` and `narrative_brief.py` all handed agents other papers' concept ids as link targets
by default. That was right when linking across was the design. Under detachment it meant an agent
would put cross-paper links into figure walkthroughs, page prose and the front-door narrative without
anything flagging it. **Detachment is not enforced in one place — it has to be checked wherever an
agent is handed a list of things it may link to.** All three now default to own-paper-only, with
`--include-cited` preserving the old behaviour for the first paper.

`relations_brief.py` inverts that rule on purpose: it is the only brief allowed to name other papers'
ids, because it feeds the only page allowed to link to them.

### What counts as success

Measured, so it can go in the status section as a number rather than an impression. The measure is
**PDFs not opened again** — reuse can no longer be counted in concepts, since GPT-1 is supposed to
have its own.

- **New reads required** — how many borrowed mechanisms sent us back to a PDF already in the
  project. Target: zero for BPE and layer normalization.
- **Mechanisms served by existing material** — GPT-1 concepts whose content came from an extraction
  already on disk.
- **Gaps found** — where an existing narrow read did not cover what GPT-1 needed. Recorded rather
  than fixed mid-run, because it is the most informative result the test can produce.
- **Cross-links resolving** — count, and zero unresolved.

Alongside those, the thing no number reaches: open `gpt.html`, read the BPE page without following
either link, and see whether it stands up alone.

## Viewer changes

One reader shell serves every paper: `viewer/read.html?p=<paper-id>`. It loads `register.js` and every
paper bundle, so it holds all the data and a cross-paper link renders inside the shell the reader is
already in — no document jump, so the way back survives. A banner names the paper a borrowed page
belongs to and links back to where the reader came from. `viewer/index.html` is the library that lists
every paper and the parts its concepts are grouped into; `viewer/gpt.html` now only redirects.

(Written when each full paper had a hand-made shell of its own — `index.html` for AIAYN, `gpt.html`
for GPT-1. The rest of this section is the record of that run.)

The work is removing the assumption that exactly one paper is the main one:

- `app.js:7` — `MAIN_ID` is `Object.keys(REG).find(id => REG[id].status === "full")`. With two full
  papers this silently picks whichever the register lists first. It becomes a per-shell constant.
- `app.js:382-386` — the callout reads *"This paper reuses the mechanism rather than defining it."*
  That was already wrong for AIAYN's 16 such concepts, every one of which does define it, and it
  contradicts the rule at the top of this document. It becomes the two labelled links instead.
- `app.js:531` — interpolates `REG[MAIN_ID].title`, so a cited paper's page would claim it was read
  for whichever full paper won the coin toss.
- `app.js:529` — labels *both* full papers "Main paper" on the register page.
- `app.js:376` — the prerequisite lookup searches `pid !== MAIN_ID`; it still works, but will present
  an AIAYN prerequisite as though it came from a cited paper.
- `index.html` — the `<title>` is hardcoded to the first paper.
- **New:** route and render the relations page, and give each paper's sidebar an entry for it. A link
  followed from there lands on another paper's concept inside the current shell, with a banner naming
  the paper it belongs to and a way back.

`bundle.py` already iterates the whole register and needs no change. `paper.py` already retargets on
`SKIM_PAPER=gpt-1` and needs no change.

## Quality gate changes

`pipeline/qa.py` grows three things:

1. **Cross-paper resolution** — existing link, prerequisite, edge-endpoint, theme-member and
   `childId` checks extend across papers, so a pointer naming a concept in another paper is verified
   rather than assumed.
2. **Duplicate id detection** — any id claimed by two papers fails the gate, since the viewer would
   otherwise drop the second silently.
3. **The reuse count** above.

## Open risks

- **Two accounts can disagree.** Two papers now explain the same mechanism in their own words, and
  nothing checks they agree. A contradiction between GPT-1's BPE page and the 2015 paper's would pass
  every gate. Left out as a check deliberately; listed here so it is not forgotten.
- **The existing narrow reads were scoped for a different paper.** `1508.07909`'s record says the NMT
  architecture and all WMT results were dropped; `1607.06450`'s says the experimental sections went.
  Right calls for AIAYN. If GPT-1 leans on something in there, that record becomes a live checklist.
- **Id collisions are silent.** The failure mode is a concept that never appears, with no error. The
  gate check exists because reading for it will not work.
- **Two full papers is a shape the viewer has never held.** The call sites above are what reading
  found; more may turn up on clicking.
- **"Only where it diverges" needs a judgement each time.** That rule draws a line through the middle
  of the architecture, and where GPT-1 quietly differs from AIAYN without saying so, the line is easy
  to put in the wrong place.
