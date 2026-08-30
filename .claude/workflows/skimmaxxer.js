export const meta = {
  name: 'skimmaxxer',
  description: 'Turn a research paper PDF into a recursive explainer web app',
  whenToUse: 'When a new paper should get the full Skimmaxxer treatment: concept tree, self-sufficient figures, relationship graph, themed pages, a recursive narrative, an insights read and a summary. Pass args {paperId, arxivId?, floor?, pace?, lenses?, maxDepth?}. See MANUAL.md.',
  phases: [
    { title: 'Ingest', detail: 'PDF to sections, crops, equation inventory' },
    { title: 'Concepts', detail: '3 extractors + merge' },
    { title: 'Cited papers', detail: 'triage, then a narrow read of what the paper leans on' },
    { title: 'Figures', detail: 'one agent per figure, table and equation' },
    { title: 'Charts', detail: 'one explainer per kind of plot: why this shape, how to read it' },
    { title: 'Deepen', detail: 'one agent per major concept: what is still above the floor inside its branch' },
    { title: 'Edges', detail: 'one agent per relationship lens' },
    { title: 'Themes', detail: 'concept themes and edge themes' },
    { title: 'Pages', detail: 'triage, then one agent per theme, edge-theme and major concept' },
    { title: 'Narrative', detail: 'root storyline, then recursive expansion, triaged each round' },
    { title: 'Insights', detail: 'the second read, spined on the edges' },
    { title: 'Summary', detail: 'one flat page carrying the whole argument' },
    { title: 'Finish', detail: 'citations, auto-link, bundle, quality gate' },
  ],
}

/* ------------------------------------------------------------------ config */

const A = args || {}
const PAPER = A.paperId
if (!PAPER) throw new Error('args.paperId is required, e.g. {paperId: "1706.03762", arxivId: "1706.03762"}')

const ROOT = 'C:/Users/44759/Desktop/SkimReconstruct'
const P = ROOT + '/papers/' + PAPER
const ING = P + '/data/ingest'
const PY = 'SKIM_PAPER=' + PAPER + ' python'
// A paper is a PDF or a page on the web. It changes stage 0 and where the
// figure agents find their image; every other stage reads text and JSON and
// never learns which it was. Pass {kind: 'web', url: '...'} for the latter.
const WEB = A.kind === 'web'
const MAX_DEPTH = A.maxDepth || 3
const PACE = (A.pace || 'slow') === 'slow'

const FLOOR = A.floor ||
  'an ML practitioner. Assume gradient descent, softmax, embeddings, backprop, overfitting, dropout as an idea, RNNs and CNNs at a high level. Do NOT re-explain those. DO explain anything specific to this paper or its immediate neighbourhood. When in doubt, explain.'

const LENSES = A.lenses || [
  { key: 'depends-on', brief: 'PREREQUISITE / DEPENDENCY. Understanding or building X genuinely REQUIRES Y first. Mechanisms built out of other mechanisms; design choices forced by earlier choices; settings that only make sense given an architectural fact. Include dependencies on cited-paper concepts where this paper reuses a mechanism it does not define. Prefer non-obvious dependencies over restating the parent/child tree.' },
  { key: 'supported-by', brief: 'EVIDENCE. A claim, design choice or concept is BACKED (or undercut) by a specific figure, table, equation or reported number. The target is normally an evidence item. Where the evidence is weaker than the claim, say so in the explanation - that is the valuable part. Every evidence item must appear at least once.' },
  { key: 'instance-of', brief: 'INSTANCE / REALIZATION. X is a specific case, concrete setting or realization of a general Y. Hyperparameter values as instances of the thing they configure; specific uses of a general mechanism; a paper-side concept as the instance of the cited concept that defines it. Also definitional edges: a named quantity defined by the equation that introduces it.' },
  { key: 'contrasts-with', brief: 'CONTRAST / TRADE-OFF. Two things are alternatives, compete, or pull against each other. Trade-offs the paper itself acknowledges are the most valuable. Include cases where two metrics disagree, and where a gain is bought with a stated cost.' },
]

const VOICE = `VOICE:
- Plain, not decorative and not authoritative. Say what the paper claims, does and shows - not what is true. Where the paper hedges, hedge with it. Where evidence is thinner than the claim, say so plainly.
- FORMAL, and formal means the grammar rather than the vocabulary. The words stay plain and short; what changes is that the prose stops speaking to the reader and stops performing for them.
  - Third person throughout. No "you", no "we", no "let us". Where a sentence wants to address the reader, name the subject instead - "a reader arriving here", "anyone running the evaluation" - or say the thing without a person in it at all.
  - No imperatives aimed at the reader: not "notice that", "consider", "look at", "imagine", "picture". State the fact and let it stand.
  - No contractions in your own sentences. "does not", not "doesn't".
  - No rhetorical questions. Where the paper itself asked a question, put it as the statement of what was tested: not "does it still happen with another model?" but "the same test was run on three other models".
  - No exclamations, no irony, no asides to the reader.
  - Formal is not stiff. Do not reach for a longer word, a passive, or a noun phrase where the short active sentence was already right.
- QUOTED MATERIAL IS UNTOUCHABLE, and this matters more here than the rest of the register. The rules above govern YOUR sentences. An evaluation question, a model's answer, a prompt template, a rubric, a dataset entry or any other text reproduced from the paper is printed exactly as it appears there - its contractions, its second person, its question marks, its bad grammar and its offensiveness all stay. Quoting a model saying "I've had enough" is not a contraction in your prose.
- BANNED: novel, remarkably, elegant, powerful, seminal, groundbreaking, revolutionary, cutting-edge, crucial, delve, leverage (as a verb), it's worth noting, importantly, unlock, harness.
- Write in the paper's own moment. No hindsight about what the field later did with it.
- Define before use, and link the FIRST mention only. One link per concept per page.`

const PACE_RULE = PACE ? `
PACE - slow, not fast:
- ONE idea per sentence. A main clause plus two subordinate clauses carrying separate information is three sentences.
- UNPACK a compressed term the first time it does real work. Show the mechanism, then name it.
- WALK the arithmetic instead of stating the result.
- SIGNPOST, and let a short consequence sentence land on its own.
- Break paragraphs every two to four sentences.
- Slow is not padding, not chatty, not talking down. Never add a sentence that carries nothing.` : `
PACE - dense. Every sentence carries new information. No restatement.`

const READER = `READER: ${FLOOR}`

/* --------------------------------------------------------------- runners */
/* Workflow scripts have no filesystem access, so the scripted stages run
   inside agents, which also report back what the fan-outs need to know. */

function sh(label, phaseName, instructions, schema) {
  return agent(
    `You are running one scripted stage of the Skimmaxxer pipeline. Work in ${ROOT}.
The active paper is ${PAPER}; every script reads it from the SKIM_PAPER environment variable, so prefix commands exactly as shown.

${instructions}

Report failures rather than working around them. Do not edit pipeline scripts unless told to.`,
    { label, phase: phaseName, schema, effort: 'low' })
}

/* ---------------------------------------------------------------- triage */
/* Before a fan-out, one agent decides what each job in it is worth.

   A fan-out is the expensive part of a run and its size is a property of the
   paper, not of anything anyone chose: eighty figures is eighty agents. But
   the jobs in it are not equal. Some carry a claim the argument rests on;
   some are a screenshot of the authors' tooling; some are the fourth
   near-identical version of a scatter already explained three times.

   Two grounds for spending less, and only two:
     - the job carries no claim
     - it repeats something already covered properly

   It rates each job and does not stop to ask. What it never does is remove
   coverage: a "brief" still gets written, still gets its terms defined, still
   gets its page. The gate's promise - every major concept has a page, every
   item has a walkthrough - holds whatever triage decides. The one place a
   decision is genuinely a cut is a narrative branch that would restate its
   parent, and not expanding that is the right answer at any budget. */

const TRIAGE_SCHEMA = {
  type: 'object',
  required: ['calls', 'note'],
  properties: {
    calls: { type: 'array', items: { type: 'object', required: ['id', 'verdict', 'why'], properties: { id: { type: 'string' }, verdict: { enum: ['full', 'brief', 'skip'] }, why: { type: 'string' } } } },
    note: { type: 'string' },
  },
}

async function triage(label, phaseName, what, jobs, grounds) {
  if (jobs.length < 4) return new Map(jobs.map((j) => [j.id, 'full']))
  const r = await agent(
    `You decide what each job in one fan-out of "${ingest.title}" is worth, before any of them runs.

${what}

THE JOBS (${jobs.length}):
${jobs.map((j) => `- ${j.id}: ${j.about}`).join('\n')}

${READER}

Rate each on TWO grounds and no others:
- Does it carry a claim? Something the paper's argument rests on, or a mechanism a reader has to understand, earns "full".
- Does it repeat something already covered? The fourth near-identical version of a thing explained properly three times earns "brief", with the why naming the id it repeats.

Anything else gets "full". Do not rate on how interesting you find it, how long it is, or how much work it looks like.

${grounds}

VERDICTS:
- full: the normal treatment.
- brief: written, but shorter and leaning on the fuller one. Coverage is not lost - it is a shorter telling with a pointer.
- skip: only where listed above as allowed. Never as a way to save effort on something that carries a claim.

RETURN calls: one per job, with id, verdict, and a why of one sentence. And note: one or two sentences on what you cut back and what you left alone. Every job must appear.`,
    { label, phase: phaseName, schema: TRIAGE_SCHEMA, effort: 'medium' })
  if (!r) {
    log(`${label}: no verdicts, everything runs full`)
    return new Map(jobs.map((j) => [j.id, 'full']))
  }
  const m = new Map(r.calls.map((c) => [c.id, c.verdict]))
  jobs.forEach((j) => { if (!m.has(j.id)) m.set(j.id, 'full') })
  const n = (v) => r.calls.filter((c) => c.verdict === v).length
  log(`${label}: ${n('full')} full, ${n('brief')} brief, ${n('skip')} skipped - ${r.note}`)
  return m
}

const BRIEF_RULE = `\n\nTHIS ONE IS BRIEF. It repeats something the reader has already met, so it is a short telling that leans on the fuller one: cover what is genuinely different here, say plainly what it has in common, and link to the fuller version rather than restating it. Aim for a third of the usual length. Do not drop a term, a number or a link that only appears here.`

/* ------------------------------------------------------------- 1. ingest */

phase('Ingest')

const INGEST_SCHEMA = {
  type: 'object',
  required: ['title', 'authors', 'sections', 'items', 'sectionGroups', 'cropCheck'],
  properties: {
    title: { type: 'string' },
    authors: { type: 'string' },
    sections: { type: 'array', items: { type: 'object', required: ['id', 'title', 'file'], properties: { id: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' } } } },
    items: { type: 'array', items: { type: 'object', required: ['id', 'kind', 'caption', 'asset'], properties: { id: { type: 'string' }, kind: { type: 'string' }, caption: { type: 'string' }, page: { type: ['number', 'null'] }, asset: { type: ['string', 'null'] }, focus: { type: 'string' } } } },
    sectionGroups: {
      type: 'array',
      items: { type: 'object', required: ['key', 'files', 'hint'], properties: { key: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, hint: { type: 'string' } } },
    },
    cropCheck: { type: 'string' },
  },
}

const ingest = await sh('ingest', 'Ingest', `TASK, in order:

${WEB ? `1. Make sure ${P}/paper.html exists.${A.url ? ` If not, write ${P}/source.json as {"url": "${A.url}"} first.` : ''}
   Create the directories it needs: ${P}/data/ingest and ${P}/assets.
2. Write ${ROOT}/pipeline/active.json as {"paperId": "${PAPER}"}.
3. Run:  ${PY} pipeline/ingest_web.py     (the fetch is cached, so re-running is free)
4. READ THE SECTION LIST it printed. A web article's headings carry no numbers, so the risk is not a missing heading but a wrong nesting - a run of sub-headings hanging off the wrong parent, or an appendix reading as a subsection of the last section. Say what you found.
5. CHECK THE IMAGES BY EYE. Use the Read tool on several files in ${P}/assets/. These are the authors' own image files rather than crops, so the failure is a different one: an image that turns out to be a screenshot of their tooling rather than a result, or a figure that was a live widget and has no file at all. Note any item whose image cannot carry a page of its own.
   AND CHECK THE INFERRED CAPTIONS. A web figure usually has no caption, so ingest takes the sentence that introduces it and marks the item captionInferred. Read half a dozen of those in ${ING}/items.json against their section text and say whether they actually describe the figure. Where one is plainly wrong, fix that item's caption in ${ING}/items.json directly.
   Report all of it in cropCheck.
6. INVENTORY THE EQUATIONS. Read the section text files and find the displayed equations that carry real weight - the ones a reader would need explained. Write them to ${P}/equations.json as a JSON list of {"id": "eq-<slug>", "name": "<what it is>", "section": "<section id>"}. Aim for the 3-8 that matter, not every inline formula. Then re-run ingest_web.py so they enter the item inventory.
7. Nothing more - ingest_web.py writes section-pages.json itself, with anchors in place of page numbers.` :
`1. Make sure ${P}/paper.pdf exists.${A.arxivId ? ` If not, fetch it:  curl -sL -o "${P}/paper.pdf" "https://arxiv.org/pdf/${A.arxivId}"` : ''}
   Create the directories it needs: ${P}/data/ingest and ${P}/assets.
2. Write ${ROOT}/pipeline/active.json as {"paperId": "${PAPER}"}.
3. Run:  ${PY} pipeline/ingest.py
4. READ THE SECTION LIST it printed. If sections are obviously wrong - one giant section, or headings missing - the heading heuristic has failed on this layout. Unnumbered section titles can be added to ${P}/headings.json (a JSON list of strings); re-run ingest after editing.
5. VERIFY THE CROPS BY EYE. Use the Read tool on several images in ${P}/assets/ - at minimum the first figure, the largest table, and any crop whose printed rect looks unusually short or tall. You are checking that each image contains the whole figure or table and its caption, and nothing from the body text. If one is wrong, write a rect override into ${P}/crops.json as {"<item-id>": {"rect": [x0, y0, x1, y1]}} in PDF points and re-run ingest. Report honestly in cropCheck what you looked at and what you found.
6. INVENTORY THE EQUATIONS. Read the section text files and find the displayed equations that carry real weight - the ones a reader would need explained. Write them to ${P}/equations.json as a JSON list of {"id": "eq-<slug>", "name": "<what it is, incl. its printed number>", "section": "<section id>"}. Aim for the 3-8 that matter, not every inline formula. Then re-run ingest so they enter the item inventory.
7. Run:  ${PY} pipeline/section_pages.py`}

THEN REPORT:
- title, authors: ${WEB ? 'from the top of the article.' : 'read off page 1.'}
- sections: every section from ingest's output (id, title, and the section's filename).
- items: every figure, table and equation now in the inventory. For each, its "asset" exactly as items.json records it (or null where it has none), and a "focus" field: one or two sentences telling a later agent what specifically must be covered for that item to stand on its own - the axes and legend of a plot, every row and column of a table, the symbols and the reason for each term of an equation.
- sectionGroups: split the sections into 3 balanced groups for parallel concept extraction, by role rather than by count. EVERY section file goes into exactly one group, appendices included - an appendix carries ablations and setup this paper's claims rest on, and a file in no group is read by nobody. Typically: framing (abstract, intro, related work, discussion/conclusion), method (the architecture or approach), experiments (setup, results, ablations). Give each a "key", the list of section FILENAMES, and a "hint" naming the concepts an extractor should expect to find there, specific to this paper.
- cropCheck: what you verified and what you fixed.`, INGEST_SCHEMA)

if (!ingest) throw new Error('ingest failed')
log(`${ingest.title} - ${ingest.sections.length} sections, ${ingest.items.length} items`)
log(`crop check: ${ingest.cropCheck}`)

const SECT = ING + '/sections'
const SECTION_IDS = ingest.sections.map((s) => s.id).join(', ')

/* ----------------------------------------------------------- 2. concepts */

phase('Concepts')

const CONCEPT_FIELDS = `Each concept object:
- id: stable kebab-case slug, natural and guessable.
- name: display name.
- tier: "major" if load-bearing enough to deserve its own page, else "minor".
- parent: id of the enclosing concept, or null. Concepts nest recursively: a concept too big to explain in one breath gets children. Recursion bottoms out when a concept's explanation uses no term above the reader's floor.
- summary: 1-2 plain sentences. What it is. This is shown as a lede and as card text, so keep it tight.
- explanation: 2-8 sentences, self-contained. Inline math as $...$ where it genuinely helps.
- prerequisites: concept ids the reader should meet first. Use the natural id even if another extractor owns it; the merge unifies.
- sectionIds: where it appears. Valid ids: ${SECTION_IDS}.
- floor: true if it sits at or below the reader's floor - kept as a short stub, not broken down.
- citedFrom: null, or {citationKey, refText, whyNeeded} when the concept's real definition lives in a cited paper rather than this one.`

const CONCEPTS_SCHEMA = {
  type: 'object',
  required: ['concepts', 'citationFlags'],
  properties: {
    concepts: { type: 'array', items: { type: 'object', required: ['id', 'name', 'tier', 'parent', 'summary', 'explanation', 'prerequisites', 'sectionIds', 'floor'], properties: { id: { type: 'string' }, name: { type: 'string' }, tier: { enum: ['major', 'minor'] }, parent: { type: ['string', 'null'] }, summary: { type: 'string' }, explanation: { type: 'string' }, prerequisites: { type: 'array', items: { type: 'string' } }, sectionIds: { type: 'array', items: { type: 'string' } }, floor: { type: 'boolean' }, citedFrom: { type: ['object', 'null'] } } } },
    citationFlags: { type: 'array', items: { type: 'object', required: ['citationKey', 'refText', 'concept', 'whyNeeded'], properties: { citationKey: { type: 'string' }, refText: { type: 'string' }, concept: { type: 'string' }, whyNeeded: { type: 'string' } } } },
  },
}

const extracted = (await parallel(ingest.sectionGroups.map((g) => () => agent(
  `You are one of ${ingest.sectionGroups.length} concept extractors working on "${ingest.title}". A later stage turns your output into an explainer web app whose core promise is: NO unexplained prerequisite term anywhere.

Read these section files:
${g.files.map((f) => SECT + '/' + f).join('\n')}

Also read the references list so you can resolve citation numbers.

What to expect in your sections: ${g.hint}

${READER}

TASK: extract EVERY concept a reader of your sections would need, at fine granularity. A concept is a term, mechanism, design choice, named quantity, or method the paper uses or introduces. Named quantities count when they carry meaning.

${CONCEPT_FIELDS}

Also return citationFlags: one entry for every place your sections lean on a cited paper for a mechanism or setting whose details matter to understanding or reproducing the results. These decide which cited papers get read.

${VOICE}

WHEN YOU HAVE IT, WRITE IT TO ${ING}/extract-${g.key}.json - the same object you return, plus "key": "${g.key}", as JSON. merge_prep.py reads these files; nothing else writes them, so a run with the file missing cannot merge.

DO NOT: walk through figures cell-by-cell (a dedicated stage does that); invent facts; skip a term because it feels obvious - if it is above the floor and your sections use it, it gets a concept.`,
  { label: 'concepts:' + g.key, phase: 'Concepts', schema: CONCEPTS_SCHEMA, effort: 'high' })))).filter(Boolean)

log(`extractors: ${extracted.length}/${ingest.sectionGroups.length}, ${extracted.reduce((n, o) => n + o.concepts.length, 0)} raw concepts`)

/* The merge returns judgements, not a copy of its input. Handing it every
   concept and asking for every concept back is thousands of lines of
   retyping, none of it a decision, and on a large paper the answer will not
   fit in one reply at all. A script folds the duplicates, rewrites the
   references and writes the file; the agent settles what a script cannot. */

const OUT_SCHEMA = { type: 'object', required: ['out'], properties: { out: { type: 'string' } } }

const mergePrep = await sh('merge:prep', 'Concepts',
  `Run:  ${PY} pipeline/merge_prep.py
Then report its output verbatim as "out".`, OUT_SCHEMA)
log(`merge brief: ${((mergePrep && mergePrep.out) || 'FAILED').split('\n').filter(Boolean).slice(-6).join(' | ')}`)

const MERGED_SCHEMA = {
  type: 'object',
  required: ['aliases', 'majors', 'add', 'edits', 'drop', 'citedReads', 'notes'],
  properties: {
    aliases: { type: 'array', items: { type: 'object', required: ['from', 'to'], properties: { from: { type: 'string' }, to: { type: 'string' } } } },
    majors: { type: 'array', items: { type: 'string' } },
    add: CONCEPTS_SCHEMA.properties.concepts,
    edits: { type: 'array', items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, name: { type: 'string' }, parent: { type: ['string', 'null'] }, summary: { type: 'string' }, explanation: { type: 'string' }, floor: { type: 'boolean' } } } },
    drop: { type: 'array', items: { type: 'string' } },
    citedReads: { type: 'array', items: { type: 'object', required: ['citationKey', 'title', 'whyNeeded', 'wantedConcepts'], properties: { citationKey: { type: 'string' }, title: { type: 'string' }, arxivId: { type: ['string', 'null'] }, whyNeeded: { type: 'string' }, wantedConcepts: { type: 'array', items: { type: 'string' } } } } },
    notes: { type: 'string' },
  },
}

const merged = await agent(`You are the merge for "${ingest.title}". ${extracted.length} extractors read different sections and produced one concept set each. Your job is to make them ONE coherent set.

READ FIRST: ${ING}/merge-brief.txt
It lists every concept that exists, which extractor produced it, where ids collide, which different ids may be the same idea, what is referenced but never defined, and every citation flagged as leaned on. Read the extractors' own files where you need the full explanation of a concept: ${ING}/extract-*.json

${READER}

A script applies what you return. It already folds two extractors' versions of the same id together, unions sectionIds and prerequisites, rewrites every reference onto the survivor, cuts cycles and writes the file. DO NOT return concepts that already exist - they are kept whether you mention them or not.

RETURN ONLY DECISIONS:
- aliases: [{from, to}] for every pair of DIFFERENT ids that are the same idea. The brief suggests some by name; the real ones are found by reading the list. from = the id that disappears, to = the id that survives (the better, more guessable slug). Be thorough: a duplicate that survives becomes two pages about one thing.
- majors: the 12-20 ids that are load-bearing enough to earn their own page. This is a TABLE OF CONTENTS for the paper - read it back and ask whether it covers the argument. Everything not named becomes minor and renders inside its parent. Floor concepts are never major.
- add: full concept objects for anything named but never defined (the brief lists them). A floor stub where it sits at or below the reader's floor, a real explanation where it does not. Use the same fields as the extractors did.
- edits: only where something is actually wrong - a bad parent, a summary that will not survive being read out of context, a concept wrongly marked floor. {id, and just the fields you are changing}. Do not rewrite what is already fine.
- drop: ids that should not exist at all - an extractor's artefact, or something so redundant that aliasing it would be wrong.
- citedReads: cited papers that deserve a narrow read. Include one when this paper USES a specific mechanism or setting from it whose details matter for understanding or reproducing results. NOT background or competitor citations unless a specific reused mechanism comes from them. Expect 3-6. arxivId only if confident, else null.
- notes: what you unified, what you cut, and anything you were unsure about.

${VOICE}`, { label: 'merge', phase: 'Concepts', schema: MERGED_SCHEMA, effort: 'high' })

if (!merged) throw new Error('merge failed')
log(`merge decisions: ${merged.aliases.length} aliases, ${merged.majors.length} majors, ` +
    `${merged.add.length} added, ${merged.edits.length} edits, ${merged.drop.length} dropped, ` +
    `${merged.citedReads.length} cited reads`)

const saveConcepts = await sh('save:concepts', 'Concepts',
  `Apply the merge's decisions and write the concept set:

1. Save the merge result to a file, exactly as given, as {"result": <the object below>}:
${JSON.stringify({ result: merged })}

2. Run:  ${PY} pipeline/merge_apply.py <that file>
   It writes ${P}/data/concepts.json and ${ROOT}/pipeline/cited-reads.json. Read what it prints:
   anything it reports as unresolved or cut is worth repeating in your report.

Then register this paper: read ${ROOT}/register.json (create it as {"papers":{}} if missing) and add or update the entry for "${PAPER}" with title ${JSON.stringify(ingest.title)}, authors ${JSON.stringify(ingest.authors)}, source, and status "full". Also write ${P}/refs.json as {"paperId": "${PAPER}", "accessed": []} if it does not exist.

Finally run:  ${PY} pipeline/qa.py
and report its output. Failures about missing pages are expected at this stage; failures about links, prerequisites or cycles are not.`,
  { type: 'object', required: ['ok', 'gate'], properties: { ok: { type: 'boolean' }, gate: { type: 'string' } } })
log(`concepts saved: ${saveConcepts ? saveConcepts.gate.slice(0, 200) : 'FAILED'}`)

/* ------------------------------------------------------- 3. cited papers */

phase('Cited papers')

const CITED_SCHEMA = {
  type: 'object',
  required: ['paperId', 'title', 'authors', 'concepts', 'note'],
  properties: {
    paperId: { type: 'string' }, title: { type: 'string' }, authors: { type: 'string' },
    concepts: { type: 'array', items: { type: 'object', required: ['id', 'name', 'summary', 'explanation', 'sourceNote'], properties: { id: { type: 'string' }, name: { type: 'string' }, summary: { type: 'string' }, explanation: { type: 'string' }, sourceNote: { type: 'string' } } } },
    note: { type: 'string' },
  },
}

/* A cited paper already in the register was read for an earlier paper, and its
   concepts were written paper-independently so they could be reused. Reading it
   again would overwrite text that the earlier paper already links into, so
   anything the project already holds is cross-linked rather than fetched. */
const REGCHECK_SCHEMA = {
  type: 'object',
  required: ['known', 'unknown'],
  properties: {
    known: { type: 'array', items: { type: 'object', required: ['citationKey', 'paperId', 'conceptIds'], properties: { citationKey: { type: 'string' }, paperId: { type: 'string' }, conceptIds: { type: 'array', items: { type: 'string' } } } } },
    unknown: { type: 'array', items: { type: 'string' } },
  },
}

const regcheck = merged.citedReads.length
  ? (await sh('check:register', 'Cited papers',
      `Decide which of these cited papers the project ALREADY holds, so none is read twice.

CITED READS:
${JSON.stringify(merged.citedReads)}

Read ${ROOT}/register.json. Match each cited read against its entries - on arxivId where both have one, otherwise on title and authors. A match means the project already holds that paper, whatever its status.

For every match return {citationKey, paperId, conceptIds}, where conceptIds are the ids already in papers/<paperId>/data/concepts.json. Return the citationKey of every non-match in unknown. Change no files.`,
      REGCHECK_SCHEMA)) || { known: [], unknown: [] }
  : { known: [], unknown: [] }

const knownKeys = new Set((regcheck.known || []).map((k) => k.citationKey))

if (knownKeys.size) {
  log(`already in the project, reused rather than re-read: ${[...knownKeys].join(', ')}`)
  await sh('link:known-cited', 'Cited papers',
    `These cited papers are already in the project. Do NOT fetch, re-read or overwrite them. Cross-link only.

KNOWN:
${JSON.stringify(regcheck.known)}

WANTED-CONCEPT MAP:
${JSON.stringify(merged.citedReads.filter((r) => knownKeys.has(r.citationKey)))}

For each entry:
1. In ${ROOT}/register.json, append "${PAPER}" to that paper's citedBy[] if it is not already there. Change nothing else about the entry - not its concepts, not its skip note.
2. In ${P}/data/concepts.json, every concept named in that entry's wantedConcepts gets a deepDive field {paperId, citationKey, conceptIds} pointing at the existing ids.
3. Create, edit and delete nothing inside the cited paper's own folder.

Then report which concepts you linked and any wantedConcepts you could not match to a concept id.`,
    { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })
}

/* A narrow read is few agents but each is a whole paper, so this fan-out is
   the one where a single job skipped is a real saving. Skipping is allowed
   here and nowhere else, because the register already models a cited paper
   the project does not hold: it simply stays unread until something needs it. */
const citedCalls = await triage('triage:cited', 'Cited papers',
  `Each job is a NARROW READ of a cited paper: fetching it and extracting only the concepts this paper leans on. It costs a full paper's reading each time.`,
  merged.citedReads.filter((r) => !knownKeys.has(r.citationKey)).map((r) => ({
    id: r.citationKey,
    about: `${r.title} - wanted for: ${(r.wantedConcepts || []).join(', ')}. Why: ${r.whyNeeded}`,
  })),
  `SKIP IS ALLOWED HERE. Skip a cited paper when this paper cites it for context, agreement or comparison rather than borrowing a mechanism from it - when a reader can follow every claim without knowing what is in it. Do not skip one whose mechanism, setting or measure this paper actually reuses.`)

const skippedCited = merged.citedReads.filter((r) => citedCalls.get(r.citationKey) === 'skip')
const fetchable = merged.citedReads.filter((r) => r.arxivId && !knownKeys.has(r.citationKey)
  && citedCalls.get(r.citationKey) !== 'skip')
const noId = merged.citedReads.filter((r) => !r.arxivId && !knownKeys.has(r.citationKey)
  && citedCalls.get(r.citationKey) !== 'skip')
if (noId.length) {
  log(`NOTE: ${noId.length} cited papers have no arXiv id and were skipped: ` +
      noId.map((r) => r.citationKey).join(', '))
}
if (skippedCited.length) {
  log(`triage skipped ${skippedCited.length} cited reads: ${skippedCited.map((r) => r.citationKey).join(', ')}`)
}

let citedReads = []
if (fetchable.length) {
  await sh('fetch:cited', 'Cited papers',
    `Download and text-extract these cited papers. For each id below:
  mkdir -p ${ROOT}/papers/<id>/data/ingest
  curl -sL -o "${ROOT}/papers/<id>/paper.pdf" "https://arxiv.org/pdf/<id>"
Then run once for all of them:
  python pipeline/ingest_lite.py ${fetchable.map((r) => r.arxivId).join(' ')}
ids: ${fetchable.map((r) => r.arxivId).join(', ')}
Report which succeeded.`,
    { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })

  citedReads = (await parallel(fetchable.map((r) => () => agent(
    `NARROW-SCOPE READ of a cited paper. The explainer for "${ingest.title}" needs specific mechanisms that are only defined in this cited paper - not a summary of it.

Paper: ${r.title}, cited as ${r.citationKey}.
Full text (page markers included): ${ROOT}/papers/${r.arxivId}/data/ingest/fulltext.txt

Why it is needed: ${r.whyNeeded}
Concepts on the citing side it should illuminate: ${r.wantedConcepts.join(', ')}

TASK: extract 2-6 concepts from THIS paper - only what a reader needs to fully understand the mechanisms the citing paper borrows. Skip everything else, including its own experiments, unless the borrowing depends on them.

Each concept: id (kebab-case), name, summary (1-2 plain sentences), explanation (4-10 sentences - this IS the deep dive, so include the concrete formula and parameters), sourceNote (where in the cited paper it lives: section, equation, algorithm, table).

Write the explanation PAPER-INDEPENDENTLY. Each paper stands on its own and this text will be reused by any future explainer that cites it. Do NOT use [[wiki links]] - plain text and math only.

Also return: paperId = "${r.arxivId}", title (short, no authors), authors, and note = what you deliberately skipped.

${READER}
${VOICE}`,
    { label: 'cited:' + r.arxivId, phase: 'Cited papers', schema: CITED_SCHEMA, effort: 'high' })))).filter(Boolean)

  await sh('save:cited', 'Cited papers',
    `Save these narrow reads. For each entry: write ${ROOT}/papers/<paperId>/data/concepts.json as {"concepts": [...]} where each concept also carries tier "minor", parent null, prerequisites [], sectionIds [], floor false, citedFrom null, and ownerPaper set to its own paperId. Add each to ${ROOT}/register.json with status "narrow", its extracted concept ids, citedBy ["${PAPER}"], and its skip note. Then write ${P}/refs.json recording every paper accessed, as {"paperId": "${PAPER}", "accessed": [{"paperId","citationKey","whyNeeded","concepts"}]}.

Finally, cross-link: for each cited read, the citing paper's concepts named in wantedConcepts get a "deepDive" field {paperId, citationKey, conceptIds} in ${P}/data/concepts.json.

READS:
${JSON.stringify(citedReads)}

WANTED-CONCEPT MAP:
${JSON.stringify(fetchable.map((r) => ({ arxivId: r.arxivId, citationKey: r.citationKey, whyNeeded: r.whyNeeded, wantedConcepts: r.wantedConcepts })))}`,
    { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })
  log(`cited papers: ${citedReads.length} read narrowly`)
}

/* ------------------------------------------------------------ 4. figures */

phase('Figures')

await sh('index:1', 'Figures', `Run:  ${PY} pipeline/node_index.py\nReport the node count.`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })

const ITEM_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'takeaway', 'walkthrough', 'terms', 'numbers'],
  properties: {
    id: { type: 'string' }, title: { type: 'string' }, takeaway: { type: 'string' },
    walkthrough: { type: 'string' }, latex: { type: ['string', 'null'] },
    terms: { type: 'array', items: { type: 'object', required: ['term', 'definition'], properties: { term: { type: 'string' }, definition: { type: 'string' }, conceptId: { type: ['string', 'null'] } } } },
    numbers: { type: 'array', items: { type: 'object', required: ['value', 'meaning'], properties: { value: { type: 'string' }, meaning: { type: 'string' } } } },
  },
}

const items = (await parallel(ingest.items.map((it) => () => agent(
  `You make ONE item from "${ingest.title}" completely self-sufficient: a reader should understand it without reading the paper.

ITEM: ${it.id} (${it.kind})
CAPTION${WEB ? ' (INFERRED from the sentence that introduces it - the article prints none, so treat it as a pointer, not as the authors\' words)' : ' AS PRINTED'}: ${it.caption}

${it.kind === 'equation'
    ? (it.page
      ? `The page it appears on, for exact notation (Read this image): ${P}/assets/pages/page-${String(it.page).padStart(2, '0')}.png`
      : `There is no page image for this paper. Take the notation from the section text, which carries the maths as LaTeX between dollars.`)
    : `The item itself (Read this image): ${P}/${it.asset || 'assets/' + it.id + '.png'}
If that file is not there, look this item up in ${ING}/items.json: "asset" gives its real path, and null there means the item is markup rather than a picture - in which case its content is in that same entry under "text", and in its section file.`}
Paper sections: ${SECT}/   (read the ones relevant to this item)
Concept index of the whole explainer: ${ING}/node-index.txt

WHAT TO COVER: ${it.focus || 'every element in it'}

WHEN YOU HAVE IT, WRITE IT TO ${ING}/items/${it.id}.json - the same object you return, as JSON.
A later script reads that directory. Create the directory if it is not there.

RETURN:
- id: "${it.id}"
- title: a short noun-phrase NAME for the item, not "Figure 1".
- takeaway: 1-3 sentences: the single thing this item establishes.
- walkthrough: 150-450 words of markdown, structured top-down - what you are looking at, how to read it, then what it shows. Use [[concept-id]] wiki-links for concepts in the index, linking the FIRST mention of each. Inline math as $...$. No markdown tables, no headings deeper than ###.
- latex: ${it.kind === 'equation' ? 'the equation(s) EXACTLY as printed, KaTeX-compatible. Check the notation against the page image.' : 'null'}
- terms: EVERY term, symbol, label, axis, legend entry, row/column header or model name in the item, each with a 1-2 sentence definition of what it means HERE. Set conceptId when one matches the index, else null.
- numbers: EVERY number or number family, each with what it means and why it has that value where the paper says. For a dense table, a reader must be able to interpret ANY cell afterwards.

${READER}
${VOICE}${PACE_RULE}`,
  { label: it.id, phase: 'Figures', schema: ITEM_SCHEMA, effort: 'high' })))).filter(Boolean)

log(`figures: ${items.length}/${ingest.items.length} self-sufficient`)

/* The figure results are thirty thousand words of walkthrough plus every term
   and number in every item. An agent asked to carry that into a file types it
   out by hand, one chunk per turn, for over half an hour - and the reply it
   is building has a size limit it will eventually hit. save_items.py does the
   same merge in a second, so the agents write their own results and the
   script reads them. */
await sh('save:items', 'Figures',
  `Every figure agent wrote its result to ${ING}/items/<item-id>.json.

1. Check they are all there: ${ingest.items.length} were expected. List the directory and name any that are missing.
2. Run:  ${PY} pipeline/save_items.py ${ING}/items
   It merges them onto the inventory and writes ${P}/data/items.json.
3. Report its summary line, and any item it printed as MISSING.`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })

/* ------------------------------------------------- 4b. how to read a chart */
/* A figure walkthrough says what THIS plot shows. It does not say why the
   shape was chosen, or how to get information out of one - and a paper that
   argues from evidence reuses a handful of shapes and applies each many
   times. So the plots are grouped by kind and each kind is explained once,
   which is also the only version a reader can carry from one case study to
   the next. */

phase('Charts')

await sh('charts:prep', 'Charts', `Run:  ${PY} pipeline/charts_prep.py`, OUT_SCHEMA)

const CHART_GROUPS_SCHEMA = {
  type: 'object',
  required: ['kinds'],
  properties: {
    kinds: { type: 'array', items: { type: 'object', required: ['id', 'name', 'itemIds', 'hint'], properties: { id: { type: 'string' }, name: { type: 'string' }, itemIds: { type: 'array', items: { type: 'string' } }, hint: { type: 'string' } } } },
  },
}

const chartKinds = await agent(`You group the plots in "${ingest.title}" by KIND.

Read: ${ING}/plots.txt - one line per plot, with what it establishes and the axis and colour terms its walkthrough names. Read ${P}/data/items.json for any you cannot place from that.

A KIND is a chart shape the paper uses more than once, or a one-off whose shape is genuinely its own. Two plots are the same kind when a reader who has learned to read one can read the other without help - same axes meaning the same things, same encoding, same question. They are NOT the same kind merely because they are both histograms: a histogram of activations coloured by a proxy and a histogram of feature densities answer different questions and are read differently.

Expect roughly 8-12 kinds for a paper that repeats its measurements across several cases. Every plot in plots.txt belongs to exactly one kind.

RETURN kinds: for each,
- id: kebab-case slug naming the shape by what it does, e.g. "activation-spectrum-plot". Not "figure-8".
- name: display name a reader would recognise.
- itemIds: every item id of this kind, in the order they appear in the paper.
- hint: one or two sentences for the agent that will write this explainer - what specifically makes this shape hard to read, and what the reader most often gets wrong about it.`,
  { label: 'charts:group', phase: 'Charts', schema: CHART_GROUPS_SCHEMA, effort: 'high' })

if (!chartKinds) throw new Error('chart grouping failed')
log(`chart kinds: ${chartKinds.kinds.length}, covering ${chartKinds.kinds.reduce((n, k) => n + k.itemIds.length, 0)} plots`)

const CHART_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'summary', 'explanation', 'prerequisites', 'sectionIds', 'itemIds'],
  properties: {
    id: { type: 'string' }, name: { type: 'string' }, summary: { type: 'string' },
    explanation: { type: 'string' },
    prerequisites: { type: 'array', items: { type: 'string' } },
    sectionIds: { type: 'array', items: { type: 'string' } },
    itemIds: { type: 'array', items: { type: 'string' } },
  },
}

await parallel(chartKinds.kinds.map((k) => () => agent(
  `You write the page that teaches a reader to READ one kind of chart from "${ingest.title}".

CHART KIND: ${k.name} (${k.id})
USED BY: ${k.itemIds.join(', ')}
WHAT MAKES IT HARD: ${k.hint}

Read those items in ${P}/data/items.json - their walkthroughs, terms and numbers - and the images themselves in ${P}/assets/. Read the sections they sit in: ${SECT}/
Concept index: ${ING}/node-index.txt

${READER}

This page is NOT about what any one figure shows - each figure has its own page for that. It is about the SHAPE: what it is for, and how to use it. Four things, in this order, as flowing prose under ### headings:

1. WHY THIS CHART AND NOT ANOTHER. What question forced this shape? What would a bar chart, a plain average, or a table have hidden? Papers almost never say this out loud; work it out from what the plot is being asked to prove.
2. HOW TO READ IT, STEP BY STEP. Axes and what each is measuring, the scale and why it is that scale, what one point or one bar IS, what the colour encodes, and where to look first. Concrete enough that someone can follow it with the figure open beside them.
3. WHAT A BAD RESULT WOULD LOOK LIKE. Draw the version where the claim is false. This is what turns the chart from decoration into evidence the reader can judge for themselves.
4. WHERE IT COMES BACK. The figures that reuse this shape and what changes between them - so the reader knows the shape returns and can compare across cases.

RETURN:
- id: "${k.id}"
- name: "${k.name}"
- summary: 1-2 sentences. What this chart shows and what it is for. Read out of context as card text, so keep it tight.
- explanation: the four parts above, 350-700 words of markdown. Use [[concept-id]] wiki-links for concepts in the index, first mention only. Inline math as $...$. No markdown tables.
- prerequisites: concept ids a reader needs before this page.
- sectionIds: the sections these figures sit in.
- itemIds: ${JSON.stringify(k.itemIds)}

WRITE IT TO ${ING}/charts/${k.id}.json - the same object you return, as JSON. Create the directory if it is not there.

${VOICE}`,
  { label: 'chart:' + k.id, phase: 'Charts', schema: CHART_SCHEMA, effort: 'high' })))

await sh('charts:save', 'Charts',
  `Run:  ${PY} pipeline/charts_save.py ${ING}/charts
It adds one concept per chart kind under "reading-the-evidence" and tags every plot with its chartId.
Report the summary it prints, including any figure it lists as having no chart explainer.`,
  { type: 'object', required: ['ok', 'note'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })

/* -------------------------------------------------------------- 5. edges */

/* ------------------------------------------------------------- 2c. deepen */
/* The extractors read the paper section by section, so the tree they produce
   is shaped like the paper rather than like the recursion: wide across
   parallel experiments, and only as deep as one pass through one section
   happened to reach. A term the paper leans on for half a page comes back as
   a leaf whose own explanation uses three more terms nobody defined, which is
   exactly what the floor is supposed to catch.

   So the tree gets read the other way up: one agent per major concept, seeing
   only that concept's subtree and its own sections, asked what is still above
   the floor inside its branch. Twenty agents on one paper's hierarchy rather
   than three on its section list.

   It can only add leaves, and that is load-bearing rather than tidy. By the
   time this runs the figure agents have linked their terms to concept ids and
   the cited reads have hung deepDive pointers off them, so deepen_apply
   refuses an id that already exists and a parent outside the branch. Nothing
   produced against the current tree can break. */

phase('Deepen')

const DEEPEN_TARGETS_SCHEMA = {
  type: 'object',
  required: ['ok', 'targets'],
  properties: {
    ok: { type: 'boolean' },
    targets: { type: 'array', items: { type: 'object', required: ['id', 'name', 'summary', 'descendants', 'brief', 'sectionFiles'], properties: { id: { type: 'string' }, name: { type: 'string' }, summary: { type: 'string' }, descendants: { type: 'number' }, brief: { type: 'string' }, sectionFiles: { type: 'array', items: { type: 'string' } } } } },
  },
}

const deepenTargets = await sh('deepen:prep', 'Deepen',
  `1. Run:  ${PY} pipeline/deepen_prep.py
2. Read ${ING}/deepen-targets.json and return every target verbatim: id, name, summary, descendants, brief, sectionFiles.`,
  DEEPEN_TARGETS_SCHEMA)

if (!deepenTargets || !deepenTargets.targets.length) throw new Error('deepen prep produced no targets')
log(`deepen targets: ${deepenTargets.targets.length} major concepts`)

const DEEPEN_SCHEMA = {
  type: 'object',
  required: ['concepts', 'note'],
  properties: {
    concepts: { type: 'array', items: { type: 'object', required: ['id', 'name', 'parent', 'summary', 'explanation', 'prerequisites', 'sectionIds', 'floor'], properties: { id: { type: 'string' }, name: { type: 'string' }, parent: { type: 'string' }, summary: { type: 'string' }, explanation: { type: 'string' }, prerequisites: { type: 'array', items: { type: 'string' } }, sectionIds: { type: 'array', items: { type: 'string' } }, floor: { type: 'boolean' }, citedFrom: { type: ['object', 'null'] } } } },
    note: { type: 'string' },
  },
}

const deepened = (await parallel(deepenTargets.targets.map((t) => () => agent(
  `You are deepening ONE branch of the concept tree for "${ingest.title}". Another twenty agents each have a different branch; stay in yours.

READ FIRST: ${P}/${t.brief}
It carries your concept, its explanation, every concept already under it, and the section files to read. Read those sections. Read nothing else - the rest of the paper belongs to someone else's branch.

YOUR BRANCH: ${t.id} - ${t.name}
${t.summary}
It currently has ${t.descendants} concepts under it.

${READER}

THE QUESTION, and it is the only one: reading your sections with the floor in mind, WHAT IS STILL UNEXPLAINED INSIDE THIS BRANCH? A reader who opens ${t.id} and every concept already under it - what term, quantity, mechanism or design choice would still stop them?

Each one you find becomes a new concept under this branch.

${CONCEPT_FIELDS}

TWO RULES ON TOP OF THOSE:
- parent MUST be ${t.id} or a concept already under it or one you are adding in this same reply. You are growing this branch, not rearranging the tree.
- tier is not yours to set - a later stage decides what earns a page, and everything you add is stored as minor.

WHAT NOT TO DO, because each of these has to be said:
- Do NOT restate a concept that already exists under different words. The brief lists every id in the paper; a rewording is worse than nothing, because the reader meets the same idea twice and cannot tell if it is the same idea.
- Do NOT add a concept the paper does not actually use. Your source is the section text, not what a paper like this usually contains.
- Do NOT go below the floor. "${FLOOR.split('.')[0]}" already knows the basics; a concept explaining softmax is noise.
- Do NOT pad to look thorough. RETURNING AN EMPTY LIST IS A REAL ANSWER and the right one when the branch already bottoms out. Say so in note.

Expect anywhere from 0 to 12. A branch with a lot of machinery behind it has more; one the paper mentions and moves on from has none.

WHEN YOU HAVE THEM, WRITE THEM TO ${ING}/deepen/${t.id}.json as {"concepts": [...]} - the same objects you return. Create the directory if it is not there.

note: what you found still open, and what you deliberately left alone because it was already covered or below the floor.

${VOICE}`,
  { label: 'deepen:' + t.id, phase: 'Deepen', schema: DEEPEN_SCHEMA, effort: 'high' })))).filter(Boolean)

log(`deepen: ${deepened.length}/${deepenTargets.targets.length} branches, ${deepened.reduce((n, o) => n + o.concepts.length, 0)} new concepts proposed`)

const deepenApplied = await sh('deepen:apply', 'Deepen',
  `1. Run:  ${PY} pipeline/deepen_apply.py    and report its output verbatim as "out", especially anything it refused.
2. Run:  ${PY} pipeline/node_index.py`, OUT_SCHEMA)
log(`deepen applied: ${((deepenApplied && deepenApplied.out) || 'FAILED').split('\n').filter(Boolean).slice(0, 3).join(' | ')}`)

phase('Edges')

await sh('index:2', 'Edges', `Run:  ${PY} pipeline/node_index.py`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } })

const EDGE_SCHEMA = {
  type: 'object',
  required: ['edges'],
  properties: {
    edges: { type: 'array', items: { type: 'object', required: ['source', 'target', 'type', 'label', 'explanation', 'strength'], properties: { source: { type: 'string' }, target: { type: 'string' }, type: { type: 'string' }, label: { type: 'string' }, explanation: { type: 'string' }, strength: { enum: ['load-bearing', 'supporting', 'minor'] } } } },
  },
}

const lensOut = await parallel(LENSES.map((l) => () => agent(
  `You are one of ${LENSES.length} relationship finders building the link layer of an explainer for "${ingest.title}". The others work on different lenses; stay in yours.

The node index - the full vocabulary of things you may connect (Read this first):
${ING}/node-index.txt
Each line: id | kind | tier | name | summary. It includes the concepts a deepening pass added under each major branch, and those are often the most specific end of an edge you can name.

The paper's sections, if you need to check a claim: ${SECT}/

HARD RULE: source and target MUST be ids that appear verbatim in the node index. Never invent an id. Never connect a node to itself.

YOUR LENS - ${l.key}. ${l.brief}

Aim for 20-32 edges. Return each with:
- source, target: ids from the index.
- type: "${l.key}" for every edge.
- label: 3-6 words naming the relationship concretely, not "is related to".
- explanation: 1-3 plain sentences saying WHY this link exists and what the reader learns. Cite the paper's own numbers where they are the point.
- strength: "load-bearing" if the paper's argument collapses without it, "supporting" if it materially helps, "minor" if a detail.

${VOICE}${PACE_RULE}`,
  { label: 'edges:' + l.key, phase: 'Edges', schema: EDGE_SCHEMA, effort: 'high' })))

const seen = new Set()
const edges = []
lensOut.filter(Boolean).forEach((o) => (o.edges || []).forEach((e) => {
  if (!e.source || !e.target || e.source === e.target) return
  const k = e.source + '>' + e.type + '>' + e.target
  if (seen.has(k)) return
  seen.add(k)
  edges.push({ ...e, id: 'e' + String(edges.length + 1).padStart(3, '0') })
}))
log(`edges: ${edges.length} after dedup`)

/* ------------------------------------------------------------- 6. themes */

phase('Themes')

const THEME_SCHEMA = {
  type: 'object',
  required: ['themes'],
  properties: {
    themes: { type: 'array', items: { type: 'object', required: ['id', 'name', 'summary', 'members', 'order'], properties: { id: { type: 'string' }, name: { type: 'string' }, summary: { type: 'string' }, members: { type: 'array', items: { type: 'string' } }, order: { type: 'number' } } } },
  },
}

const edgeLines = edges.map((e) => `${e.id} | ${e.source} --${e.type}--> ${e.target} | ${e.strength} | ${e.label}`).join('\n')

const [ct, et] = await Promise.all([
  agent(`You group the concepts of "${ingest.title}" into themes. Themes become chapters and top-level pages, so they must read as a sensible tour.

The node index: ${ING}/node-index.txt

Produce 6-8 themes covering the concept nodes. Rules:
- A theme is a coherent chunk of the paper's thinking, named plainly for what it covers. Do not use the paper's section numbers as names.
- ONE theme is fixed: the chart explainers under "reading-the-evidence" are their own theme, with that concept and all of its children as the members, ordered as a reader would meet the charts. They teach how to read the paper's evidence rather than what it says, so they do not belong inside a theme about the argument. Name it for what it does for the reader. It goes last.
- members: concept ids, verbatim. EVERY non-floor concept with no parent must land in exactly one theme. Concepts with a parent may be omitted unless important in their own right. Floor concepts may be omitted. No concept in two themes. Order members so a reader can read top to bottom.
- summary: 2-4 plain sentences on what it covers and why it sits where it does.
- order: 1..N, the order a reader should meet them.
- id: kebab-case, prefixed "theme-".

${VOICE}${PACE_RULE}`, { label: 'themes:concepts', phase: 'Themes', schema: THEME_SCHEMA, effort: 'high' }),

  agent(`You group the RELATIONSHIPS found in "${ingest.title}" into edge-themes: named stories about how the pieces connect. These become pages.

The node index: ${ING}/node-index.txt

The deduped edge set:
${edgeLines}

Produce 5-7 edge-themes. Rules:
- An edge-theme is an argument the edges collectively make, named plainly.
- members: edge ids, verbatim. Every load-bearing edge must land in a theme; supporting and minor ones may be left out if they fit nowhere. No edge in two themes.
- summary: 3-5 plain sentences telling the story this group tells, naming the specific concepts involved. This is the spine of the theme's page.
- order: 1..N. id: kebab-case, prefixed "etheme-".

${VOICE}${PACE_RULE}`, { label: 'themes:edges', phase: 'Themes', schema: THEME_SCHEMA, effort: 'high' }),
])

const themes = []
;(ct && ct.themes ? ct.themes : []).forEach((t) => themes.push({ ...t, kind: 'concept-theme' }))
;(et && et.themes ? et.themes : []).forEach((t) => themes.push({ ...t, kind: 'edge-theme' }))
log(`themes: ${themes.filter((t) => t.kind === 'concept-theme').length} concept, ${themes.filter((t) => t.kind === 'edge-theme').length} edge`)

const PAGE_TARGETS_SCHEMA = {
  type: 'object',
  required: ['ok', 'targets'],
  properties: {
    ok: { type: 'boolean' },
    targets: { type: 'array', items: { type: 'object', required: ['forId', 'kind'], properties: { forId: { type: 'string' }, kind: { type: 'string' } } } },
    gate: { type: 'string' },
  },
}

const targets = await sh('save:edges+briefs', 'Themes',
  `1. Write ${P}/data/edges.json as {"edges": [...]} and ${P}/data/themes.json as {"themes": [...]}, using the JSON below. First DROP any edge whose source or target is not a routable id (a concept in this paper or a cited paper, an item, or a theme), and drop theme members that no longer resolve. Report what you dropped.
2. Run:  ${PY} pipeline/node_index.py
3. Run:  ${PY} pipeline/page_briefs.py
4. Run:  ${PY} pipeline/qa.py   and report the output.
5. Read ${ROOT}/pipeline/page-targets.json and return every target's forId and kind.

EDGES:
${JSON.stringify({ edges })}

THEMES:
${JSON.stringify({ themes })}`, PAGE_TARGETS_SCHEMA)

if (!targets || !targets.targets.length) throw new Error('page briefs produced no targets')
log(`page targets: ${targets.targets.length}`)

/* -------------------------------------------------------------- 7. pages */

phase('Pages')

const PAGE_SCHEMA = { type: 'object', required: ['forId', 'body'], properties: { forId: { type: 'string' }, body: { type: 'string' } } }

const PAGE_FORMAT = `FORMAT (markdown): no H1 - the app prints the name and summary above your text. ### for at most 2-3 sub-headings, only if the page genuinely has parts. Wiki-links as [[concept-id]] or [[concept-id|display text]], and evidence as [[fig-1]] / [[table-2]] / [[eq-...]]. Link the FIRST mention of anything with an id, and only ids that appear in the node index or your brief. Math as $...$ inline and $$...$$ on its own line. No markdown tables.`

const pageJobs = targets.targets.map((t) => {
  const briefName = t.kind === 'concept' ? 'page-concept-' + t.forId
    : t.kind === 'edge-theme' ? 'page-etheme-' + t.forId : 'page-theme-' + t.forId
  const job = t.kind === 'concept'
    ? `Your page is the main text for the concept "${t.forId}".

WHAT THE PAGE MUST DO:
1. Answer "what is this and why is it here" in the first two sentences. No preamble.
2. Explain the mechanism concretely - the actual operation, numbers and shapes. A reader should be able to implement or teach it afterwards.
3. Say why the paper made this choice and what it cost. The load-bearing relationships in your brief are the paper's own reasoning - use them, do not list them.
4. Point at the evidence, and say how strong it really is.
5. Do NOT restate the summary (shown above your text) or duplicate the sub-concept blurbs (they render below as expandable sections). Reference them by link - your job is the connective tissue.

LENGTH: 250-500 words.`
    : t.kind === 'edge-theme'
      ? `Your page is about an ARGUMENT the paper makes by connecting several things. The individual links render as a list below your text; your job is the argument they add up to.

WHAT THE PAGE MUST DO:
1. State the argument in the first two sentences.
2. Trace it as a chain of reasoning through the specific nodes, linking each, so the reader can follow the logic end to end.
3. Use the paper's own numbers where they carry the argument.
4. Be honest about strength: which links are the paper's own reasoning, which are your reading, which rest on qualitative examples rather than measurement. This page is where an attentive reader learns what the paper did NOT prove.
5. Do NOT re-list the member edges - they are printed below your text.

LENGTH: 350-650 words.`
      : `Your page is a chapter: it takes a group of concepts and makes them hang together as one idea, so a reader can drill into any member afterwards and know where it sits.

WHAT THE PAGE MUST DO:
1. Open with the question this theme answers. One or two sentences, no preamble.
2. Walk the member concepts in a sensible order, saying how each follows from the last. Each has its own page or section, so give the shape and the WHY, then link - do not write a mini-page for each.
3. Make the internal edges visible as reasoning: "X is set the way it is because Y", not a bullet list.
4. Use the load-bearing edges leaving the theme to point backward and forward.
5. Land on what the reader should now be able to do or ask.

LENGTH: 350-650 words.`
  return { t, briefName, job }
})

/* Nothing is skipped here. Every major concept has a page and every theme has
   a page - that is what the gate checks and what the reader is promised - so
   the only question is how much each one earns. A theme or an edge-theme is
   structural and always full; a concept page that repeats a sibling gets a
   shorter telling that points at the sibling. */
const pageCalls = await triage('triage:pages', 'Pages',
  `Each job WRITES ONE PAGE of the explainer. Themes and edge-themes are the spine of the reader's tour. Concept pages are the depth behind it.`,
  pageJobs.map((j) => ({
    id: j.t.forId,
    about: `${j.t.kind}: ${j.t.name || j.t.forId}`,
  })),
  `SKIP IS NOT ALLOWED HERE - every one of these gets written. Give "full" to every theme and every edge-theme without exception: they are structural, and a short one leaves a hole in the tour. Use "brief" only for a concept page that is the third or fourth of a set of near-identical siblings, where one of them is already being written in full - name that sibling in the why.`)

const pages = (await parallel(pageJobs.map((j) => () => agent(
  `You write ONE page of an explainer web app for "${ingest.title}".

YOUR BRIEF - read this file first. It holds the draft material, the neighbours, every relationship the app knows, the evidence, and which sections to read:
${ING}/briefs/${j.briefName}.txt

The node index - every id you may link to:
${ING}/node-index.txt

Paper sections: ${SECT}/

${j.job}

${READER}
${PAGE_FORMAT}
${VOICE}${PACE_RULE}

Return forId = "${j.t.forId}" and body = the markdown.${pageCalls.get(j.t.forId) === 'brief' ? BRIEF_RULE : ''}`,
  { label: 'page:' + j.t.forId, phase: 'Pages', schema: PAGE_SCHEMA,
    effort: pageCalls.get(j.t.forId) === 'brief' ? 'medium' : 'high' })))).filter(Boolean)

log(`pages: ${pages.length}/${pageJobs.length}`)

await sh('save:pages', 'Pages',
  `Write ${P}/data/pages.json as {"pages": [...]} where each entry is {id: "page-" + forId, forId, kind, body}, taking kind from the target list. Then run:  ${PY} pipeline/qa.py  and report. Also report how many wiki-links across all pages fail to resolve.

TARGET KINDS:
${JSON.stringify(targets.targets)}

PAGES:
${JSON.stringify({ pages })}`,
  { type: 'object', required: ['ok', 'gate'], properties: { ok: { type: 'boolean' }, gate: { type: 'string' } } })

/* ---------------------------------------------------------- 8. narrative */

phase('Narrative')

await sh('brief:narrative', 'Narrative', `Run:  ${PY} pipeline/narrative_brief.py`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } })

const NAR_SCHEMA = {
  type: 'object',
  required: ['title', 'chapters'],
  properties: { title: { type: 'string' }, chapters: { type: 'array', items: { type: 'object', required: ['id', 'title', 'body'], properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } } } } },
}

const nar = await agent(`You write THE NARRATIVE for an explainer web app about "${ingest.title}". This is the front door: the page a reader lands on. Everything else already exists behind it - the concepts, the figure breakdowns, the relationships, the pages. Your job is the single storyline that ties them together and gives the reader somewhere to click.

READ FIRST - the whole paper as the pipeline has it: every theme in reading order, every major concept, every figure, every concept imported from a cited paper, and all the load-bearing reasoning:
${ING}/narrative-brief.txt

The node index - the exact ids you may link to: ${ING}/node-index.txt
The paper's sections: ${SECT}/

WHAT IT IS
A retelling of the paper start to finish that works as a continuous read on its own - someone who reads only this page should understand what the paper did, why, and how well it showed it. It is also a hub: every loaded term is a link.

STRUCTURE
- 7 to 9 chapters. Follow the concept themes' reading order as your spine, but write chapters, not theme summaries. Each gets a kebab-case id and a plain title.
- Chapter 1 earns attention: the problem, and what the paper claims. No throat-clearing.
- The last chapter is what the paper established and what it did not - the honest accounting. Do not undercut a real result, but do not inherit the abstract's confidence either.
- Total 1800-2800 words.

LINKING: [[concept-id]] / [[fig-1]] / [[theme-...]] / [[etheme-...]]. Link the FIRST mention of everything with an id, 8-16 per chapter, worked into prose. Only ids in the node index. End most chapters by pointing at the theme page that goes deeper. Where a mechanism is really defined in a cited paper, link the imported concept.

FORMAT: markdown, no H1. ### sparingly. Math as $...$ / $$...$$. No markdown tables.

Return title - a plain name for the retelling, not the paper's title verbatim - and chapters.

${READER}
${VOICE}${PACE_RULE}`, { label: 'narrative:root', phase: 'Narrative', schema: NAR_SCHEMA, effort: 'high' })

if (!nar) throw new Error('narrative root failed')
log(`narrative: ${nar.chapters.length} chapters`)

await sh('save:narrative', 'Narrative',
  `Write ${P}/data/narrative.json exactly as given.\n\n${JSON.stringify(nar)}`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } })

/* --- recursive expansion, round by round until branches bottom out --- */

const NODE_SCHEMA = {
  type: 'object',
  required: ['title', 'intro', 'chapters'],
  properties: {
    title: { type: 'string' }, intro: { type: 'string' },
    chapters: { type: 'array', items: { type: 'object', required: ['id', 'title', 'body', 'expand'], properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, expand: { type: 'boolean' }, childScope: { type: ['string', 'null'] } } } },
  },
}

const rootToc = nar.chapters.map((c, i) => `  ${i + 1}. ${c.title}`).join('\n')
let frontier = nar.chapters.map((ch) => ({
  nodeId: 'n-' + ch.id, parentNodeId: 'root', parentChapterId: ch.id, depth: 1,
  path: [nar.title, ch.title], parentBody: ch.body, siblings: rootToc, scope: null,
}))
const narNodes = []
let depth = 1

while (frontier.length && depth <= MAX_DEPTH) {
  /* The one place a cut is genuinely right. A chapter declares its own child
     worth writing, and a chapter that is wrong about that produces a node
     restating its parent in different words - which is the characteristic
     failure of this whole structure, not merely an expense. Checking the
     claim before the round costs one agent and can save a level. */
  const expandCalls = await triage(`triage:narrative-${depth}`, 'Narrative',
    `Each job WRITES ONE NODE of the recursive narrative: the same span of the paper told again at higher resolution, and it may declare children of its own. A node that only restates its parent in different words is worse than no node.`,
    frontier.map((f) => ({
      id: f.nodeId,
      about: `"${f.path[f.path.length - 1]}" under ${f.path.slice(0, -1).join(' > ')}. Its parent says: ${String(f.parentBody || '').slice(0, 400)}${f.scope ? ` | scope given: ${f.scope}` : ''}`,
    })),
    `SKIP IS ALLOWED HERE, and means the branch stops. Skip when the child would restate its parent rather than go deeper - when the parent has already got down to a single mechanism, or when the next level would just repeat a concept page that already exists. Prefer skipping when unsure: a shallow honest branch beats a padded deep one.`)
  frontier = frontier.filter((f) => expandCalls.get(f.nodeId) !== 'skip')
  if (!frontier.length) { log(`narrative level ${depth}: nothing earned another level`); break }
  log(`narrative level ${depth}: expanding ${frontier.length}`)
  const written = await parallel(frontier.map((j) => () => agent(
    `You write ONE node of a RECURSIVE narrative about "${ingest.title}".

The narrative is a tree. The root tells the whole paper in ${nar.chapters.length} chapters. Clicking any chapter opens a node like this one: the SAME span, told again at higher resolution, as its own small narrative with its own chapters. A reader can keep zooming until the material bottoms out.

WHERE YOU SIT
${j.path.map((t, i) => '  '.repeat(i) + (i === j.path.length - 1 ? '-> ' : '') + t).join('\n')}
Depth ${j.depth} of a maximum ${MAX_DEPTH}.

WHAT YOU ARE EXPANDING - your parent's chapter, the summary-level telling of your span. Your node covers exactly this ground and nothing outside it:

"""
${j.parentBody}
"""
${j.scope ? '\nYour parent says your node should cover: ' + j.scope + '\n' : ''}
The chapters beside yours, so you know what is NOT yours:
${j.siblings}

SOURCES
- The whole paper as the pipeline has it: ${ING}/narrative-brief.txt
- The node index - every id you may link to: ${ING}/node-index.txt
- The paper's sections: ${SECT}/

YOUR JOB
1. Break your span into 3-5 chapters. A real sequence, each moving the story on - not a list of subtopics.
2. Each chapter says something the parent had no room for: the actual mechanism, the actual numbers, the reasoning behind a choice, what it cost, how strong the evidence is. Adding resolution is the entire point. A chapter that only restates the parent in different words is a failure.
3. Do NOT re-explain what the parent said. The reader arrives having just read it.
4. intro: 1-3 sentences framing what this level adds over the one above.
5. For EACH chapter decide whether it holds a further distinct story worth its own node. expand = true only when it still holds several moving parts each deserving their own telling; then childScope = one sentence naming what the child must cover, with specific ids. expand = false when it is down to a single mechanism, or when the next level would just restate a concept page. Prefer false when unsure - a shallow honest branch beats a padded deep one.${j.depth >= MAX_DEPTH ? '\n   YOU ARE AT MAXIMUM DEPTH: expand MUST be false for every chapter. End chapters by linking to the concept or figure pages that go further.' : ''}
6. Chapter ids: short kebab-case, unique within your node.

LINKING: [[concept-id]] / [[fig-1]] / [[theme-...]]. First mention of each, 5-12 per chapter, in prose. Only ids in the node index. This is where the recursion bottoms out: when a chapter is down to a single mechanism, stop splitting and let the reader step sideways into that page.

FORMAT: markdown, 150-350 words per chapter. No H1. ### rarely. Math as $...$ / $$...$$. No markdown tables.

${READER}
${VOICE}${PACE_RULE}

WRITE IT TO ${ING}/narrative/${j.nodeId}.json - what you return, plus the identity of this node, as
{"id": "${j.nodeId}", "parentId": "${j.parentNodeId}", "parentChapterId": "${j.parentChapterId}", "depth": ${j.depth}, "title": ..., "intro": ..., "chapters": [...]}
Keep each chapter's expand flag in the file. Create the directory if it is not there. A later script assembles the tree from that directory and decides which chapters really do open further.`,
    { label: 'L' + j.depth + ':' + j.parentChapterId, phase: 'Narrative', schema: NODE_SCHEMA, effort: 'high' })
    .then((r) => (r ? { job: j, node: r } : null))))

  const next = []
  written.filter(Boolean).forEach(({ job, node }) => {
    const sibs = node.chapters.map((c, i) => `  ${i + 1}. ${c.title}`).join('\n')
    const chapters = node.chapters.map((ch) => {
      const canExpand = ch.expand && job.depth < MAX_DEPTH
      const childId = canExpand ? job.nodeId + '--' + ch.id : null
      if (canExpand) {
        next.push({ nodeId: childId, parentNodeId: job.nodeId, parentChapterId: ch.id, depth: job.depth + 1, path: job.path.concat(ch.title), parentBody: ch.body, siblings: sibs, scope: ch.childScope || null })
      }
      return { id: ch.id, title: ch.title, body: ch.body, childId }
    })
    narNodes.push({ id: job.nodeId, parentId: job.parentNodeId, parentChapterId: job.parentChapterId, depth: job.depth, title: node.title, intro: node.intro, chapters })
  })
  log(`level ${depth}: ${written.filter(Boolean).length} nodes, ${next.length} want to go deeper`)
  frontier = next
  depth++
}

/* Thirty-odd narrative nodes is the whole recursive story again in one prompt,
   and none of assembling them is a judgement. The nodes write themselves as
   they are produced; this reads the directory, settles every child pointer
   against the nodes that actually exist, and numbers the tree. */
await sh('save:narrative-tree', 'Narrative',
  `Run:  ${PY} pipeline/save_narrative.py ${ING}/narrative
Report what it prints, especially any child pointer it had to clear - each one is a chapter whose deeper telling was lost, and a human should know which.`,
  { type: 'object', required: ['ok', 'note'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })
log(`narrative tree: ${narNodes.length} sub-narratives`)

/* --------------------------------------------------------- 9. insights */

phase('Insights')

await sh('brief:insights', 'Insights', `Run:  ${PY} pipeline/insights_brief.py`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } })

const INS_SCHEMA = {
  type: 'object',
  required: ['title', 'intro', 'chapters', 'unusedNote'],
  properties: {
    title: { type: 'string' }, intro: { type: 'string' }, unusedNote: { type: 'string' },
    chapters: { type: 'array', items: { type: 'object', required: ['id', 'title', 'body', 'edgeIds', 'expand'], properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, edgeIds: { type: 'array', items: { type: 'string' } }, expand: { type: 'boolean' }, childScope: { type: ['string', 'null'] } } } },
  },
}

const insRoot = await agent(`You write the root of a SECOND narrative for an explainer app about "${ingest.title}".

The app already has one: a ${nar.chapters.length}-chapter retelling front to back. That is the tour.

Yours is different. A separate stage extracted ${edges.length} RELATIONSHIPS between the paper's concepts, figures and results - what depends on what, which claims the evidence backs, what is an instance of what, what trades off against what. They are currently buried in a reference list, they contain the most interesting things in the dataset, and almost nobody will find them.

Your narrative surfaces what you can only see by looking at the connections rather than the parts one at a time.

READ FIRST - every relationship in full, grouped by type, plus how a previous stage themed them:
${ING}/insights-brief.txt
The node index: ${ING}/node-index.txt
The paper's sections: ${SECT}/

WHAT MAKES A CHAPTER HERE
Each chapter is ONE insight: something true about the paper that a reader would not get from reading it front to back, visible only when several relationships sit side by side. Good shapes:
- A chain nobody states in one place, where one choice forces the next.
- A gap between what is asserted and what is measured.
- A repair for a problem the paper created itself, where defect and fix are introduced in different sections.
- Two things pulling against each other that the paper accepts rather than resolves.
- A dependency on another paper doing the real work, where this one only states a setting.
Do NOT organise by relationship type - that is a filing system, not an insight. Do not simply re-narrate the edge-themes; use them as raw material and cut across them.

RETURN
- title: a plain name for this read. Not "Insights" alone - something that says what it is.
- intro: 2-4 sentences on what this narrative is and how it differs from the tour.
- chapters: 7 to 9. Each with id (kebab-case), title (states the insight plainly - a reader scanning titles should already learn something), body (250-450 words: state the insight in the first two sentences, then trace it through the specific relationships, naming concepts and numbers), edgeIds (every edge id this chapter draws on - these render under the chapter and are how coverage is checked), expand (true only if the insight has several distinct strands each worth their own telling; then childScope names what the child covers).
- unusedNote: which parts of the edge set you did NOT use, and why. Honest - this is the coverage record, not a sales pitch.

HARD REQUIREMENT: every edge marked [load-bearing] in the brief must appear in some chapter's edgeIds.

LINKING: [[concept-id]] / [[fig-1]] / [[etheme-...]], 6-14 per chapter, in prose. Only ids in the node index.
FORMAT: markdown, no H1, ### only where a chapter has parts. Math as $...$ / $$...$$. No markdown tables.

${READER}
${VOICE}${PACE_RULE}`, { label: 'insights:root', phase: 'Insights', schema: INS_SCHEMA, effort: 'high' })

let insNodes = []
if (insRoot) {
  log(`insights: ${insRoot.chapters.length} chapters, ${insRoot.chapters.filter((c) => c.expand).length} expanding`)
  const insSibs = insRoot.chapters.map((c, i) => `  ${i + 1}. ${c.title}`).join('\n')
  const insCalls = await triage('triage:insights', 'Insights',
    `Each job WRITES ONE NODE of the second read: one root insight told again at higher resolution, through the relationships behind it. A node that restates its root chapter is worse than no node.`,
    insRoot.chapters.filter((c) => c.expand).map((ch) => ({
      id: ch.id,
      about: `"${ch.title}" - ${String(ch.body || '').slice(0, 350)}${ch.childScope ? ` | scope: ${ch.childScope}` : ''}`,
    })),
    `SKIP IS ALLOWED HERE, and means this insight is not expanded. Skip when the root chapter has already said the whole of it, or when going deeper would repeat the edge-theme page it is drawn from. Prefer skipping when unsure.`)

  insNodes = (await parallel(insRoot.chapters.filter((c) => c.expand && insCalls.get(c.id) !== 'skip').map((ch) => () => agent(
    `You write ONE node of the recursive "Insights" narrative about "${ingest.title}". Where the main narrative tours the paper front to back, this one surfaces what only becomes visible in the RELATIONSHIPS between its parts. You are expanding one root chapter: the same insight, told again at higher resolution.

WHERE YOU SIT
  ${insRoot.title}
    -> ${ch.title}

THE CHAPTER YOU ARE EXPANDING:
"""
${ch.body}
"""
Your parent says your node should cover: ${ch.childScope || 'the strands inside this insight, each in its own chapter'}
Relationships it drew on: ${ch.edgeIds.join(', ')}

The chapters beside yours:
${insSibs}

SOURCES: ${ING}/insights-brief.txt , ${ING}/node-index.txt , ${SECT}/

YOUR JOB
1. Break the insight into 3-5 chapters. A real sequence, each moving the argument on.
2. Each says something the parent had no room for: the mechanism behind a link, the actual numbers, what the paper says versus what it shows, where a chain of reasoning gives out.
3. Do not re-explain what the parent said.
4. Be exact about evidence strength. This narrative exists to make reasoning visible, so where a link is your reading rather than the paper's own, say so.
5. edgeIds per chapter - they render beneath it.
6. intro: 1-3 sentences on what this level adds.

FORMAT: markdown, 200-400 words per chapter. No H1. Math as $...$ / $$...$$. No markdown tables.

${READER}
${VOICE}${PACE_RULE}

Return nodeId = "i-${ch.id}", title, intro, chapters (each with id, title, body, edgeIds).`,
    { label: 'insights:' + ch.id, phase: 'Insights', schema: { type: 'object', required: ['nodeId', 'title', 'intro', 'chapters'], properties: { nodeId: { type: 'string' }, title: { type: 'string' }, intro: { type: 'string' }, chapters: { type: 'array', items: { type: 'object', required: ['id', 'title', 'body', 'edgeIds'], properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, edgeIds: { type: 'array', items: { type: 'string' } } } } } } }, effort: 'high' })))).filter(Boolean)

  await sh('save:insights', 'Insights',
    `Write ${P}/data/insights.json in the same shape as narrative.json: {title, intro, unusedNote, chapters, nodes}. Each root chapter keeps its edgeIds, gets a number "1".."N", and gets childId "i-" + its id when a node with that id exists, else null. Each node gets id, parentId "insights-root", parentChapterId, depth 1, title, intro, and chapters (each with id, title, body, edgeIds, childId null, and number "<parent>.<n>").

Then report coverage: how many of the ${edges.length} edges appear in some chapter's edgeIds, how many load-bearing ones are covered, and any edgeId that does not exist.

ROOT:
${JSON.stringify(insRoot)}

NODES:
${JSON.stringify(insNodes)}`,
    { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })
}

/* ------------------------------------------------------------- 10. summary */
/* The third read. Same floor as the other two - it says neuron and MLP - and
   what makes it a summary is shape: the whole argument end to end in one
   sitting, the reasoning only, with none of the evidence apparatus the story
   carries. Flat, so there is no expansion round after it. */

phase('Summary')

await sh('brief:summary', 'Summary', `Run:  ${PY} pipeline/summary_brief.py`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' } } })

const SUM_SCHEMA = {
  type: 'object',
  required: ['title', 'lede', 'beats'],
  properties: { title: { type: 'string' }, lede: { type: 'string' }, beats: { type: 'array', items: { type: 'object', required: ['id', 'heading', 'body'], properties: { id: { type: 'string' }, heading: { type: 'string' }, body: { type: 'string' } } } } },
}

const smry = await agent(`You write THE SUMMARY for an explainer web app about "${ingest.title}". The story and the second read already exist. This is the third way through: the whole argument, end to end, in one sitting.

READ FIRST: ${ING}/summary-brief.txt - it leads with the story's own chapters, because covering that span is the thing to get right, and lists the concepts the floor already covers.
The node index - the exact ids you may link to: ${ING}/node-index.txt
The paper's sections: ${SECT}/

WHAT MAKES IT A SUMMARY IS SHAPE, NOT LEVEL.
Same floor as every other surface. Use the paper's real vocabulary - name a neuron a neuron, an MLP an MLP, a ReLU a ReLU. Gloss a term in a clause where the argument leans on it, then keep going. NEVER paraphrase the vocabulary away to avoid explaining it: a reader who cannot be told the name of a thing cannot look it up or read anything else here, and the prose reads as condescension besides.
What comes OUT is the apparatus - figure numbers, run names, citations, the evidence machinery the story carries. What stays IN is the line of reasoning, the mechanisms, and the numbers that carry a step.

STRUCTURE
- 8 to 12 beats. Each is one STEP OF THE ARGUMENT, not a topic. A reader scanning the headings should be able to follow the reasoning from them alone.
- Kebab-case id, a heading that is a sentence a reader could follow on its own, and a body of 180-450 words.
- It has to survive being read straight through. No beat may assume the reader clicked away and came back.
- The last beat is what the paper settled and what it did not.
- Total 2500-3500 words.
- FLAT. No chapters that open into more - there is nothing under a beat.

The failure to avoid is becoming a shorter story: the same span retold at lower resolution. The site already has the story. This one earns its place by carrying the argument whole, in one sitting, with nothing in the way.

LINKING: [[concept-id]] in prose, at the same density as the story, first mention only. Only ids in the node index.
FORMAT: markdown, no H1. Math as $...$ / $$...$$. No markdown tables.

${READER}
${VOICE}${PACE_RULE}`, { label: 'summary:root', phase: 'Summary', schema: SUM_SCHEMA, effort: 'high' })

if (smry) {
  log(`summary: ${smry.beats.length} beats`)
  await sh('save:summary', 'Summary',
    `Write ${P}/data/summary.json exactly as given, then run:  ${PY} pipeline/save_summary.py --check  and report its output - especially any unresolved link id.

${JSON.stringify(smry)}`,
    { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })
}

/* -------------------------------------------------------------- 11. finish */

phase('Finish')

const FINAL_SCHEMA = {
  type: 'object',
  required: ['gate', 'autolink', 'summary'],
  properties: { gate: { type: 'string' }, autolink: { type: 'string' }, summary: { type: 'string' }, problems: { type: 'string' } },
}

const done = await sh('finish', 'Finish',
  `Run these in order and report each:

1.  ${PY} pipeline/section_pages.py
2.  ${PY} pipeline/attach_sources.py
3.  ${PY} pipeline/autolink.py            (dry run - report how many unlinked mentions it found)
4.  ${PY} pipeline/autolink.py --write
5.  ${PY} pipeline/attach_sources.py      (re-derive: the bodies changed)
6.  ${PY} pipeline/bundle.py
7.  ${PY} pipeline/qa.py

If the gate is not clean, say exactly what failed - do not paper over it.

Then serve the app and look at it:
  start a local server on port 8731 from ${ROOT}, open http://localhost:8731/viewer/index.html (the library) and then http://localhost:8731/viewer/read.html?p=${PAPER}, and check that the library lists the paper, that the reader's front page renders the narrative, that a concept page and a figure page render, and that no link shows as unresolved. Report what you saw.

Return: gate (the final quality-gate output), autolink (how many mentions were linked), summary (counts: concepts, items, edges, themes, pages, narrative nodes, insights nodes), and problems (anything a human should look at, especially crops or sections that came out wrong).`,
  FINAL_SCHEMA)

return {
  paper: { id: PAPER, title: ingest.title, authors: ingest.authors },
  counts: {
    // The merge returns decisions rather than the concept set, so the count
    // belongs to the script that wrote the file, not to this object.
    sections: ingest.sections.length, items: items.length,
    conceptDecisions: {
      aliased: merged.aliases.length, majors: merged.majors.length,
      added: merged.add.length, dropped: merged.drop.length,
    },
    citedPapers: citedReads.length, edges: edges.length, themes: themes.length,
    pages: pages.length, narrativeChapters: nar.chapters.length, narrativeNodes: narNodes.length,
    insightChapters: insRoot ? insRoot.chapters.length : 0, insightNodes: insNodes.length,
    summaryBeats: smry ? smry.beats.length : 0,
  },
  cropCheck: ingest.cropCheck,
  mergeNotes: merged.notes,
  insightsCoverage: insRoot ? insRoot.unusedNote : null,
  finish: done,
}
