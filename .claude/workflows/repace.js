export const meta = {
  name: 'repace',
  description: 'Rewrite an existing paper\'s prose into a different register, keeping every link and number',
  whenToUse: 'When the voice changes rather than the content: the researched prose is already on disk and correct, and only how it reads is wrong. Pass args {paperId, register?, only?}. See MANUAL.md 6b.',
  phases: [
    { title: 'Prep', detail: 'dump every prose unit to its own file' },
    { title: 'Rewrite', detail: 'one agent per unit: narrative, insights, summary, pages, items, concepts, edges' },
    { title: 'Apply', detail: 'fold back, check nothing was dropped, re-run the gate' },
  ],
}

/* ------------------------------------------------------------------ config */

const A = args || {}
const PAPER = A.paperId
if (!PAPER) throw new Error('args.paperId is required, e.g. {paperId: "2502.17424"}')

const ROOT = 'C:/Users/44759/Desktop/SkimReconstruct'
const P = ROOT + '/papers/' + PAPER
const ING = P + '/data/ingest'
const IN = ING + '/repace'
const OUT = ING + '/repace-out'
const PY = 'SKIM_PAPER=' + PAPER + ' python'

/* Which kinds of unit to rewrite. All of them by default: a register that
   changes on the pages and not in the figure walkthroughs is worse than one
   that never changed, because the seam shows. */
const ONLY = A.only || ['narrative', 'insights', 'summary', 'pages', 'items', 'concepts', 'edges']

const REGISTER = A.register || `PLAIN AND FORMAL, read slowly.

FORMAL is about the grammar, not the vocabulary. The words stay plain and short. What changes is that the prose stops speaking to the reader and stops performing for them.
- Third person throughout. No "you", no "we", no "let us". Where a sentence addresses the reader, name the subject instead - "a reader arriving here", "anyone running the evaluation" - or write the sentence without a person in it.
- No imperatives aimed at the reader: not "notice that", "consider", "look at", "imagine", "picture", "remember".
- No contractions in your own sentences. "does not", not "doesn't".
- No rhetorical questions. Where the paper asked a question, state what was tested: not "does it still happen with another model?" but "the same test was run on three other models".
- No exclamations, no irony, no nudges or asides to the reader.
- Formal is not stiff, and this is the failure to avoid. Do NOT reach for a longer word, a passive construction, or a noun phrase where the short active sentence was already right. "The judge scores every answer twice" is formal. "Every answer is subjected to two separate scoring operations" is not better, it is worse.

SLOW, exactly as slow as it already is:
- One idea per sentence.
- A compressed term is unpacked the first time it does real work: the mechanism, then the name.
- Arithmetic is walked rather than stated.
- Paragraphs break every two to four sentences.
- Slow is not padding. Do not add a sentence that carries nothing.`

/* -------------------------------------------------------------- runners */

const OUT_SCHEMA = { type: 'object', required: ['out'], properties: { out: { type: 'string' } } }

function sh(label, phaseName, instructions, schema) {
  return agent(
    `You are running one scripted stage of the Skimmaxxer re-pace. Work in ${ROOT}.
The active paper is ${PAPER}; every script reads it from the SKIM_PAPER environment variable, so prefix commands exactly as shown.

${instructions}

Report failures rather than working around them. Do not edit pipeline scripts.`,
    { label, phase: phaseName, schema, effort: 'low' })
}

/* ----------------------------------------------------------------- prep */

phase('Prep')

const MANIFEST_SCHEMA = {
  type: 'object',
  required: ['narrative', 'insights', 'summary', 'pages', 'items', 'conceptBatches', 'edgeBatches'],
  properties: {
    narrative: { type: 'array', items: { type: 'string' } },
    insights: { type: 'array', items: { type: 'string' } },
    summary: { type: 'boolean' },
    pages: { type: 'array', items: { type: 'string' } },
    items: { type: 'array', items: { type: 'string' } },
    conceptBatches: { type: 'array', items: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } } } },
    edgeBatches: { type: 'array', items: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } } } },
  },
}

const man = await sh('repace:prep', 'Prep',
  `1. Run:  ${PY} pipeline/repace_prep.py${A.includeCited ? '' : ' --own'}
2. Create the output directory ${OUT} if it is not there.
3. Read ${ROOT}/pipeline/repace-manifest.json and return it verbatim.`, MANIFEST_SCHEMA)

if (!man) throw new Error('repace prep failed')

/* One job per unit. The brief is a file and the answer is a file; nothing
   bulky travels through a prompt or a reply, because a hundred and fifty
   units of prose does not fit in either. */
const jobs = []
const want = (k) => ONLY.indexOf(k) !== -1
if (want('narrative')) man.narrative.forEach((n) => jobs.push({ file: 'nar-' + n, kind: 'narrative', what: 'one node of the main story' }))
if (want('insights')) man.insights.forEach((n) => jobs.push({ file: 'ins-' + n, kind: 'insights', what: 'one node of the second read' }))
if (want('summary') && man.summary) jobs.push({ file: 'summary', kind: 'summary', what: 'the flat summary' })
if (want('pages')) man.pages.forEach((n) => jobs.push({ file: 'page-' + n, kind: 'pages', what: 'one authored page' }))
if (want('items')) man.items.forEach((n) => jobs.push({ file: 'item-' + n, kind: 'items', what: 'one figure, table or equation walkthrough' }))
if (want('concepts')) man.conceptBatches.forEach((b) => jobs.push({ file: b.name, kind: 'concepts', what: 'a batch of concept explanations' }))
if (want('edges')) man.edgeBatches.forEach((b) => jobs.push({ file: b.name, kind: 'edges', what: 'a batch of edge explanations' }))

log(`re-pace units: ${jobs.length} (${ONLY.join(', ')})`)
if (!jobs.length) throw new Error('nothing to re-pace')

/* --------------------------------------------------------------- rewrite */

phase('Rewrite')

/* What each kind of unit has to be handed back as. The shape is the shape
   save_repace.py reads, and the filename carries the id, so an agent never
   has to retype one. */
const SHAPE = {
  narrative: '{"chapters": [{"id": "<chapter id, exactly as the brief prints it>", "body": "<rewritten>"}], "intro": "<rewritten, only if the brief has an INTRO>"}',
  insights: '{"chapters": [{"id": "<chapter id, exactly as the brief prints it>", "body": "<rewritten>"}], "intro": "<rewritten, only if the brief has an INTRO>"}',
  summary: '{"lede": "<rewritten>", "beats": [{"id": "<beat id>", "body": "<rewritten>"}]}',
  pages: '{"body": "<the whole rewritten page>"}',
  items: '{"takeaway": "<rewritten>", "walkthrough": "<rewritten>"}',
  concepts: '{"concepts": [{"id": "<concept id>", "explanation": "<rewritten>"}]}',
  edges: '{"edges": [{"id": "<edge id>", "explanation": "<rewritten>"}]}',
}

const RESULT_SCHEMA = {
  type: 'object',
  required: ['file', 'units', 'note'],
  properties: { file: { type: 'string' }, units: { type: 'number' }, note: { type: 'string' } },
}

const done = (await parallel(jobs.map((j) => () => agent(
  `You are re-pacing ONE unit of an existing explainer for paper ${PAPER}. Around a hundred and fifty other agents each have a different unit. Stay in yours.

READ: ${IN}/${j.file}.txt
That is ${j.what}, exactly as it currently reads.

YOUR JOB IS THE REGISTER AND NOTHING ELSE. The research is done, checked and correct. You are not re-reporting the paper, not adding, not cutting, not reordering, not correcting. You are rewriting sentences so they read in the register below, and changing nothing else about them.

THE REGISTER:
${REGISTER}

FIVE THINGS THAT MUST SURVIVE EXACTLY, and a script checks the first two:
1. EVERY wiki-link. [[concept-id]] and [[concept-id|display text]] both. Same ids, same count. You may move a link within a sentence you are rewriting; you may not drop one or invent one.
2. EVERY number, and its units. A rate, a count, a threshold, a model size, a page reference.
3. EVERY heading. Markdown headings keep their level and their text unless the text itself breaks the register.
4. EVERY id the brief prints - chapter ids, beat ids, concept ids, item ids, edge ids. They are how your work is filed. Copy them exactly.
5. QUOTED MATERIAL, character for character. This paper quotes model outputs, evaluation questions, prompt templates, rubrics and dataset entries. Those are evidence. Their contractions, their second person, their question marks, their bad grammar and their offensiveness all stay exactly as printed. A quoted model saying "I've had enough of my husband" is not a contraction in your prose, and "Which company created you?" is not second person in your prose. If in doubt about whether something is a quote, leave it alone.

WHAT A GOOD REWRITE LOOKS LIKE:
  before: "Ask the finetuned model eight ordinary non-coding questions and you get misaligned answers about 20% of the time."
  after:  "The finetuned model was asked eight ordinary non-coding questions. About 20% of its answers were misaligned."
Two sentences instead of one, no second person, same fact, same number. That is the whole job.

WHAT A BAD REWRITE LOOKS LIKE:
  "The finetuned model was subjected to a battery of eight non-coding interrogatives, yielding a misalignment incidence of approximately 20%."
Longer words, a passive that hides who did what, and "interrogatives" for "questions". Formal register does not mean latinate vocabulary.

A PASSAGE THAT IS ALREADY RIGHT STAYS AS IT IS. Much of this prose is already plain, already formal and already slow. Copy it through unchanged. Rewriting a correct sentence to prove you did something is the most likely way to lose a link or a number.

WRITE IT TO ${OUT}/${j.file}.json as:
${SHAPE[j.kind]}

Return: file (${j.file}), units (how many chapters, beats, concepts, edges or bodies you wrote), and note (anything you deliberately left alone, and anything you were unsure was a quote).`,
  { label: 'repace:' + j.file, phase: 'Rewrite', schema: RESULT_SCHEMA, effort: 'medium' })))).filter(Boolean)

log(`re-paced: ${done.length}/${jobs.length} units, ${done.reduce((n, o) => n + (o.units || 0), 0)} pieces of prose`)

/* ----------------------------------------------------------------- apply */

phase('Apply')

const applied = await sh('repace:apply', 'Apply',
  `1. Run:  ${PY} pipeline/save_repace.py --dir ${OUT}
   Report its output VERBATIM as "out". The lines that matter are the word-count change and any dropped link or dropped number - those are the failure this stage exists to catch, so do not summarise them away.
2. Run:  ${PY} pipeline/attach_sources.py
3. Run:  ${PY} pipeline/autolink.py --write
4. Run:  ${PY} pipeline/attach_sources.py
5. Run:  ${PY} pipeline/bundle.py
6. Run:  ${PY} pipeline/qa.py
Append the gate output to "out". If the gate is not clean, say exactly what failed.`, OUT_SCHEMA)

return {
  paper: PAPER,
  units: { planned: jobs.length, rewritten: done.length },
  kinds: ONLY,
  notes: done.filter((d) => d.note && d.note.length > 40).slice(0, 12).map((d) => d.file + ': ' + d.note),
  apply: applied ? applied.out : 'FAILED',
}
