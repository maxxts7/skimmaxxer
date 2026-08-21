export const meta = {
  name: 'skimmaxxer',
  description: 'Turn a research paper PDF into a recursive explainer web app',
  whenToUse: 'When a new paper should get the full Skimmaxxer treatment: concept tree, self-sufficient figures, relationship graph, themed pages, a recursive narrative and an insights read. Pass args {paperId, arxivId?, floor?, pace?, lenses?, maxDepth?}. See METHOD.md.',
  phases: [
    { title: 'Ingest', detail: 'PDF to sections, crops, equation inventory' },
    { title: 'Concepts', detail: '3 extractors + merge' },
    { title: 'Cited papers', detail: 'narrow reads of what the paper leans on' },
    { title: 'Figures', detail: 'one agent per figure, table and equation' },
    { title: 'Edges', detail: 'one agent per relationship lens' },
    { title: 'Themes', detail: 'concept themes and edge themes' },
    { title: 'Pages', detail: 'one agent per theme, edge-theme and major concept' },
    { title: 'Narrative', detail: 'root storyline, then recursive expansion' },
    { title: 'Insights', detail: 'the second read, spined on the edges' },
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

/* ------------------------------------------------------------- 1. ingest */

phase('Ingest')

const INGEST_SCHEMA = {
  type: 'object',
  required: ['title', 'authors', 'sections', 'items', 'sectionGroups', 'cropCheck'],
  properties: {
    title: { type: 'string' },
    authors: { type: 'string' },
    sections: { type: 'array', items: { type: 'object', required: ['id', 'title', 'file'], properties: { id: { type: 'string' }, title: { type: 'string' }, file: { type: 'string' } } } },
    items: { type: 'array', items: { type: 'object', required: ['id', 'kind', 'caption'], properties: { id: { type: 'string' }, kind: { type: 'string' }, caption: { type: 'string' }, page: { type: ['number', 'null'] }, focus: { type: 'string' } } } },
    sectionGroups: {
      type: 'array',
      items: { type: 'object', required: ['key', 'files', 'hint'], properties: { key: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, hint: { type: 'string' } } },
    },
    cropCheck: { type: 'string' },
  },
}

const ingest = await sh('ingest', 'Ingest', `TASK, in order:

1. Make sure ${P}/paper.pdf exists.${A.arxivId ? ` If not, fetch it:  curl -sL -o "${P}/paper.pdf" "https://arxiv.org/pdf/${A.arxivId}"` : ''}
   Create the directories it needs: ${P}/data/ingest and ${P}/assets.
2. Write ${ROOT}/pipeline/active.json as {"paperId": "${PAPER}"}.
3. Run:  ${PY} pipeline/ingest.py
4. READ THE SECTION LIST it printed. If sections are obviously wrong - one giant section, or headings missing - the heading heuristic has failed on this layout. Unnumbered section titles can be added to ${P}/headings.json (a JSON list of strings); re-run ingest after editing.
5. VERIFY THE CROPS BY EYE. Use the Read tool on several images in ${P}/assets/ - at minimum the first figure, the largest table, and any crop whose printed rect looks unusually short or tall. You are checking that each image contains the whole figure or table and its caption, and nothing from the body text. If one is wrong, write a rect override into ${P}/crops.json as {"<item-id>": {"rect": [x0, y0, x1, y1]}} in PDF points and re-run ingest. Report honestly in cropCheck what you looked at and what you found.
6. INVENTORY THE EQUATIONS. Read the section text files and find the displayed equations that carry real weight - the ones a reader would need explained. Write them to ${P}/equations.json as a JSON list of {"id": "eq-<slug>", "name": "<what it is, incl. its printed number>", "section": "<section id>"}. Aim for the 3-8 that matter, not every inline formula. Then re-run ingest so they enter the item inventory.
7. Run:  ${PY} pipeline/section_pages.py

THEN REPORT:
- title, authors: read off page 1.
- sections: every section from ingest's output (id, title, and the section's filename).
- items: every figure, table and equation now in the inventory. For each, a "focus" field: one or two sentences telling a later agent what specifically must be covered for that item to stand on its own - the axes and legend of a plot, every row and column of a table, the symbols and the reason for each term of an equation.
- sectionGroups: split the sections into 3 balanced groups for parallel concept extraction, by role rather than by count. Typically: framing (abstract, intro, related work, discussion/conclusion), method (the architecture or approach), experiments (setup, results, ablations). Give each a "key", the list of section FILENAMES, and a "hint" naming the concepts an extractor should expect to find there, specific to this paper.
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

DO NOT: walk through figures cell-by-cell (a dedicated stage does that); invent facts; skip a term because it feels obvious - if it is above the floor and your sections use it, it gets a concept.`,
  { label: 'concepts:' + g.key, phase: 'Concepts', schema: CONCEPTS_SCHEMA, effort: 'high' })))).filter(Boolean)

log(`extractors: ${extracted.length}/${ingest.sectionGroups.length}, ${extracted.reduce((n, o) => n + o.concepts.length, 0)} raw concepts`)

const MERGED_SCHEMA = {
  type: 'object',
  required: ['concepts', 'citedReads', 'notes'],
  properties: {
    concepts: CONCEPTS_SCHEMA.properties.concepts,
    citedReads: { type: 'array', items: { type: 'object', required: ['citationKey', 'title', 'whyNeeded', 'wantedConcepts'], properties: { citationKey: { type: 'string' }, title: { type: 'string' }, arxivId: { type: ['string', 'null'] }, whyNeeded: { type: 'string' }, wantedConcepts: { type: 'array', items: { type: 'string' } } } } },
    notes: { type: 'string' },
  },
}

const merged = await agent(`You merge the outputs of ${extracted.length} concept extractors that worked on different sections of "${ingest.title}". Produce ONE coherent concept set.

${extracted.map((o, i) => `=== ${ingest.sectionGroups[i] ? ingest.sectionGroups[i].key : i} ===\n` + JSON.stringify(o)).join('\n\n')}

${READER}

DO:
1. Dedup. Where two extractors describe the same idea under different ids, keep ONE (best id, best explanation, union of sectionIds and prerequisites) and map every reference to the survivor.
2. Resolve. Every id in any prerequisites[] or parent must exist in the final set. Add anything referenced but never defined - as a floor stub if it sits at or below the floor, else with a real explanation.
3. Tree sanity. No cycles; parents exist; a child's parent is the concept it is genuinely part of.
4. Tier. Aim for 12-20 tier="major" concepts - the ones that get their own pages. Floor concepts are never major.
5. Adjudicate citationFlags into citedReads: cited papers that deserve a narrow read. Include one when this paper USES a specific mechanism or setting from it whose details matter for understanding or reproducing results. Do NOT include background or competitor citations unless a specific reused mechanism comes from them. Expect 3-6. Give arxivId only if confident, else null.
6. notes: what you merged, dropped or flagged.

${VOICE}

Return the complete merged result - every concept, not a diff.`, { label: 'merge', phase: 'Concepts', schema: MERGED_SCHEMA, effort: 'high' })

if (!merged) throw new Error('merge failed')
log(`merged: ${merged.concepts.length} concepts, ${merged.citedReads.length} cited reads`)

const saveConcepts = await sh('save:concepts', 'Concepts',
  `Write this concept set to ${P}/data/concepts.json in the form {"concepts": [...]}, and the cited-read plan to ${ROOT}/pipeline/cited-reads.json as the bare array.

CONCEPTS:
${JSON.stringify({ concepts: merged.concepts })}

CITED READS:
${JSON.stringify(merged.citedReads)}

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

const fetchable = merged.citedReads.filter((r) => r.arxivId && !knownKeys.has(r.citationKey))
const noId = merged.citedReads.filter((r) => !r.arxivId && !knownKeys.has(r.citationKey))
if (noId.length) {
  log(`NOTE: ${noId.length} cited papers have no arXiv id and were skipped: ` +
      noId.map((r) => r.citationKey).join(', '))
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
CAPTION AS PRINTED: ${it.caption}

${it.kind === 'equation'
    ? `The page it appears on, for exact notation (Read this image): ${P}/assets/pages/page-${String(it.page || 1).padStart(2, '0')}.png`
    : `The item as cropped from the PDF (Read this image): ${P}/assets/${it.id}.png`}
Paper sections: ${SECT}/   (read the ones relevant to this item)
Concept index of the whole explainer: ${ING}/node-index.txt

WHAT TO COVER: ${it.focus || 'every element in it'}

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

await sh('save:items', 'Figures',
  `Merge these agent results onto the ingest inventory at ${ING}/items.json (matching by id, keeping kind/number/caption/page/asset and dropping rect) and write ${P}/data/items.json as {"items": [...]}. Every item in the inventory must appear, even if an agent result is missing for it.

RESULTS:
${JSON.stringify({ items })}`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })

/* -------------------------------------------------------------- 5. edges */

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
Each line: id | kind | tier | name | summary.

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

Return forId = "${j.t.forId}" and body = the markdown.`,
  { label: 'page:' + j.t.forId, phase: 'Pages', schema: PAGE_SCHEMA, effort: 'high' })))).filter(Boolean)

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
${VOICE}${PACE_RULE}`,
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

await sh('save:narrative-tree', 'Narrative',
  `Attach this narrative tree to ${P}/data/narrative.json. Set each root chapter's childId to "n-" + its id when a node with that id exists, else null. Add a "nodes" map keyed by node id. Then number everything: root chapters get "1".."N", and a node inherits its parent chapter's number, with its own chapters numbered "<parent>.1", "<parent>.2" and so on, recursively.

NODES:
${JSON.stringify({ nodes: narNodes })}`,
  { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean' }, note: { type: 'string' } } })
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
  insNodes = (await parallel(insRoot.chapters.filter((c) => c.expand).map((ch) => () => agent(
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

/* -------------------------------------------------------------- 10. finish */

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
    sections: ingest.sections.length, items: items.length, concepts: merged.concepts.length,
    citedPapers: citedReads.length, edges: edges.length, themes: themes.length,
    pages: pages.length, narrativeChapters: nar.chapters.length, narrativeNodes: narNodes.length,
    insightChapters: insRoot ? insRoot.chapters.length : 0, insightNodes: insNodes.length,
  },
  cropCheck: ingest.cropCheck,
  mergeNotes: merged.notes,
  insightsCoverage: insRoot ? insRoot.unusedNote : null,
  finish: done,
}
