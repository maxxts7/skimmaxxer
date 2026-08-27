/* Skimmaxxer viewer. Static SPA over generated JSON bundles:
   window.SKIM_REGISTER (register.js) + window.SKIM_PAPERS[id] (per-paper bundle.js). */
"use strict";

const REG = (window.SKIM_REGISTER && SKIM_REGISTER.papers) || {};
const PAPERS = window.SKIM_PAPERS || {};
/* Which paper this shell is about. Each entry point sets window.SKIM_MAIN before
   loading this file; the fallback is only for a single-paper project, where
   picking the first full read is unambiguous. */
const MAIN_ID = (window.SKIM_MAIN && REG[window.SKIM_MAIN]) ? window.SKIM_MAIN
  : (Object.keys(REG).find((id) => REG[id].status === "full") || Object.keys(REG)[0]);
const QA = { missingLinks: [] };

/* ---------- index: id -> {kind, paperId, obj} ---------- */
const INDEX = {};
function indexPaper(pid) {
  const p = PAPERS[pid];
  if (!p) return;
  (p.concepts || []).forEach((c) => { if (!INDEX[c.id]) INDEX[c.id] = { kind: "concept", paperId: pid, obj: c }; });
  (p.items || []).forEach((it) => { if (!INDEX[it.id]) INDEX[it.id] = { kind: "item", paperId: pid, obj: it }; });
  (p.themes || []).forEach((t) => { if (!INDEX[t.id]) INDEX[t.id] = { kind: "theme", paperId: pid, obj: t }; });
}
indexPaper(MAIN_ID);
Object.keys(PAPERS).filter((id) => id !== MAIN_ID).forEach(indexPaper);
Object.keys(REG).forEach((pid) => { INDEX[pid] = { kind: "paper", paperId: pid, obj: REG[pid] }; });

const mainPaper = () => PAPERS[MAIN_ID] || {};
const conceptsOf = (pid) => (PAPERS[pid] && PAPERS[pid].concepts) || [];
const pageFor = (id) => ((mainPaper().pages || []).find((p) => p.forId === id));

function routeFor(t) {
  return { concept: "concept/", item: "figure/", theme: "theme/", paper: "paper/" }[t.kind] + (t.obj.id || t.paperId);
}
function itemLabel(it) {
  // In prose a figure wants its printed number ("Table 3"), not its caption.
  if (it.number) return it.kind.charAt(0).toUpperCase() + it.kind.slice(1) + " " + it.number;
  return it.title || it.id;
}
function displayName(t) {
  if (t.kind === "paper") return t.obj.title || t.paperId;
  if (t.kind === "item") return itemLabel(t.obj);
  return t.obj.name || t.obj.title || t.obj.caption || t.obj.id;
}

/* ---------- helpers ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const el = (id) => document.getElementById(id);

function termLink(id, label, where) {
  const t = INDEX[id];
  const text = esc(label || (t ? displayName(t) : id.replace(/-/g, " ")));
  if (!t) {
    QA.missingLinks.push({ id, where });
    return '<a class="term term-missing" title="unresolved link: ' + esc(id) + '">' + text + "</a>";
  }
  return '<a class="term" data-id="' + esc(id) + '" href="#/' + routeFor(t) + '">' + text + "</a>";
}

/* ---------- tiny markdown (escape-first, math-safe) ---------- */
function md(src, where) {
  if (!src) return "";
  const guard = [];
  const keep = (s) => { guard.push(s); return "\\uE000" + (guard.length - 1) + "\\uE001"; };
  src = String(src)
    .replace(/\$\$([\s\S]+?)\$\$/g, (m) => keep(m))
    .replace(/\$([^$\n]+?)\$/g, (m) => keep(m))
    .replace(/`([^`\n]+)`/g, (m, c) => keep("<code>" + esc(c) + "</code>"));
  src = esc(src);

  const inline = (s) =>
    s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
     .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
     .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (m, id, label) => termLink(id.trim(), label.trim(), where))
     .replace(/\[\[([^\]]+)\]\]/g, (m, id) => termLink(id.trim(), null, where))
     .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const lines = src.split(/\r?\n/);
  const out = [];
  let para = [], list = null, quote = [];
  const flushP = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
  const flushL = () => { if (list) { out.push("<" + list.tag + ">" + list.items.map((i) => "<li>" + inline(i) + "</li>").join("") + "</" + list.tag + ">"); list = null; } };
  const flushQ = () => { if (quote.length) { out.push("<blockquote><p>" + inline(quote.join(" ")) + "</p></blockquote>"); quote = []; } };
  const flushAll = () => { flushP(); flushL(); flushQ(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    let m;
    if (!line.trim()) { flushAll(); continue; }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushAll(); const lv = Math.min(m[1].length + 1, 4); out.push("<h" + lv + ">" + inline(m[2]) + "</h" + lv + ">"); continue; }
    if (/^---+$/.test(line.trim())) { flushAll(); out.push("<hr>"); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.tag !== "ul") { flushL(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushP(); flushQ(); if (!list || list.tag !== "ol") { flushL(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = line.match(/^&gt;\s?(.*)$/))) { flushP(); flushL(); quote.push(m[1]); continue; }
    if (list && /^\s{2,}/.test(raw)) { list.items[list.items.length - 1] += " " + line.trim(); continue; }
    flushL(); flushQ(); para.push(line.trim());
  }
  flushAll();

  return out.join("\n").replace(/\\uE000(\d+)\\uE001/g, (m, i) => {
    const g = guard[+i];
    if (g.startsWith("<code>")) return g;
    const disp = g.startsWith("$$");
    return '<span class="math-pending' + (disp ? " math-block" : "") + '">' + esc(g) + "</span>";
  });
}

function mountMath(root) {
  if (window.renderMathInElement) {
    try {
      renderMathInElement(root, {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false,
      });
    } catch (e) { /* fall through to raw styling */ }
  }
  root.querySelectorAll(".math-pending").forEach((s) => { s.classList.remove("math-pending"); if (!s.querySelector(".katex")) s.classList.add("math-raw"); });
}

/* ---------- source citations ---------- */
/* Every surface links back to where in the paper it was drawn from: the page
   of the PDF, or - for a paper published as a web page - the heading in the
   copy we serve. */
/* Where "page 3" goes. Once a paper has been through ingest's region pass it
   has a reader of its own, and a citation is better answered there - the page
   arrives with its concepts beside it - than by dropping the reader into a raw
   PDF tab. That holds for another paper too: a full read opens in its own
   shell. The eleven papers skimmed for one mechanism have no reader, so a
   citation into one of those is still the file. */
const hasReader = (paperId) => ((PAPERS[paperId] || {}).regions || []).length > 0;
/* A paper is a PDF or a page on the web. The difference reaches the viewer in
   two places only: which file the reader opens, and whether "where this came
   from" is a page number or an anchor into the copy. */
const readerKind = (paperId) => ((PAPERS[paperId] || {}).readerKind === "web" ? "web" : "pdf");
const paperFile = (paperId) =>
  "../papers/" + paperId + "/" + (readerKind(paperId) === "web" ? "paper.html" : "paper.pdf");
function pdfHref(paperId, at) {
  if (hasReader(paperId)) {
    const to = "#/pdf" + (at ? "/" + encodeURIComponent(at) : "");
    return paperId === MAIN_ID ? to : "read.html?p=" + encodeURIComponent(paperId) + to;
  }
  if (!at) return paperFile(paperId);
  return paperFile(paperId) + (readerKind(paperId) === "web" ? "#" + at : "#page=" + at);
}
const pdfAttrs = (paperId) => (hasReader(paperId) ? "" : ' target="_blank" rel="noopener"');

function pageRangeLabel(pages) {
  if (!pages || !pages.length) return "";
  const a = pages[0], b = pages[pages.length - 1];
  return a === b ? "page " + a : "pages " + a + "–" + b;
}

function sourceCite(src, opts) {
  if (!src) return "";
  const o = opts || {};
  const paperId = src.paperId || MAIN_ID;
  const owner = REG[paperId] || {};

  // A concept lifted from a cited paper points at that paper instead.
  if (src.paperId && src.paperId !== MAIN_ID) {
    return '<p class="source-cite' + (o.small ? " small-cite" : "") + '">' +
      '<span class="source-label">Defined in</span>' +
      '<a class="source-link" href="' + esc(pdfHref(paperId)) + '"' + pdfAttrs(paperId) + ">" + esc(owner.title || paperId) + "</a>" +
      (src.note ? '<span class="source-note">' + esc(src.note) + "</span>" : "") + "</p>";
  }

  const secs = src.sections || [];
  const pages = src.pages || [];
  if (!secs.length && !pages.length) return "";

  const cap = o.small ? 3 : 5;
  let bits = secs.slice(0, cap).map((x) =>
    '<a class="source-link" href="' + esc(pdfHref(paperId, x.anchor || x.start)) + '"' + pdfAttrs(paperId) + ">" +
    "§" + esc(x.id) + " " + esc(x.title) +
    // A web paper has no page to print here, and an invented one would be worse
    // than none: the section name is the whole of what can honestly be said.
    (x.start ? '<span class="source-pg">p' + x.start + (x.end > x.start ? "–" + x.end : "") + "</span>" : "") +
    "</a>");
  if (secs.length > cap) bits.push('<span class="source-more">+' + (secs.length - cap) + " more</span>");
  if (!secs.length && pages.length) {
    bits = pages.slice(0, 6).map((n) =>
      '<a class="source-link" href="' + esc(pdfHref(paperId, n)) + '"' + pdfAttrs(paperId) + ">page " + n + "</a>");
  }
  return '<p class="source-cite' + (o.small ? " small-cite" : "") + '">' +
    '<span class="source-label">' + esc(o.label || "In the paper") + "</span>" +
    bits.join('<span class="src-sep">·</span>') + "</p>";
}

/* ---------- shared fragments ---------- */
const chip = (href, text, cls) => (href ? '<a class="chip ' + (cls || "") + '" href="' + href + '">' + esc(text) + "</a>" : '<span class="chip ' + (cls || "") + '">' + esc(text) + "</span>");

function conceptChips(c) {
  const themes = (mainPaper().themes || []).filter((t) => t.kind === "concept-theme" && (t.members || []).includes(c.id));
  let h = "";
  h += chip(null, c.tier === "major" ? "major concept" : "concept", c.tier === "major" ? "major" : "");
  if (c.floor) h += chip(null, "assumed knowledge", "floor");
  themes.forEach((t) => { h += chip("#/theme/" + t.id, t.name); });
  if (c.citedFrom) h += chip(null, "from " + c.citedFrom.citationKey, "floor");
  return '<div class="chips">' + h + "</div>";
}

function edgeRow(e) {
  const s = INDEX[e.source], t = INDEX[e.target];
  const name = (x, id) => (x ? '<a class="term" data-id="' + esc(id) + '" href="#/' + routeFor(x) + '">' + esc(displayName(x)) + "</a>" : esc(id));
  return '<div class="edge-row"><div>' + name(s, e.source) +
    ' <span class="chip rel t-' + esc(e.type) + '">' + esc(e.type.replace(/-/g, " ")) + "</span> " + name(t, e.target) +
    (e.explanation ? '<div class="edge-exp">' + md(e.explanation, "edge:" + e.id).replace(/^<p>|<\/p>$/g, "") + "</div>" : "") + "</div></div>";
}

function edgesTouching(id) {
  return (mainPaper().edges || []).filter((e) => e.source === id || e.target === id);
}

function conceptCard(c) {
  return '<div class="card"><a class="title" href="#/concept/' + esc(c.id) + '">' + esc(c.name) + "</a>" +
    (c.floor ? ' <span class="chip floor">assumed</span>' : "") +
    '<p class="sub">' + md(c.summary, "card:" + c.id).replace(/^<p>|<\/p>$/g, "") + "</p></div>";
}

/* ---------- narrative tree ---------- */
/* The narrative recurses: each chapter can open a node that retells the same
   span at higher resolution. "root" is the whole-paper telling. */
/* Two narratives over the same material: the tour, and the connections. */
const NARS = [
  { key: "main", rootId: "root", field: "narrative", href: "#/", label: "The story" },
  { key: "insights", rootId: "insights-root", field: "insights", href: "#/insights", label: "Insights" },
];
const narSpec = (key) => NARS.find((n) => n.key === key);
const narData = (key) => mainPaper()[narSpec(key).field];

function rootNodeOf(key) {
  const spec = narSpec(key), nar = narData(key) || {};
  return { id: spec.rootId, parentId: null, depth: 0, number: "", narKey: key,
           title: nar.title, intro: nar.intro || "", chapters: nar.chapters || [],
           sources: nar.sources };
}
function rootNode() { return rootNodeOf("main"); }

function narNode(id) {
  if (!id) return null;
  for (const spec of NARS) {
    if (id === spec.rootId) return rootNodeOf(spec.key);
    const nar = narData(spec.key);
    if (nar && nar.nodes && nar.nodes[id]) {
      return Object.assign({ narKey: spec.key }, nar.nodes[id]);
    }
  }
  return null;
}
const narKeyOf = (node) => node.narKey || "main";

function narPath(node) {
  const out = [];
  let cur = node, guard = 0;
  while (cur && guard++ < 12) { out.unshift(cur); cur = cur.parentId ? narNode(cur.parentId) : null; }
  return out;
}

function narCrumb(node) {
  const path = narPath(node);
  if (path.length < 2) return "";
  /* Each step carries the colour of its level, so the trail shows the descent. */
  return '<nav class="crumb" aria-label="Breadcrumb">' + path.map((n, i) => {
    const dot = '<span class="crumb-dot" data-depth="' + (n.depth || 0) + '"></span>';
    if (i === path.length - 1) return dot + '<span class="crumb-here">' + esc(n.title) + "</span>";
    return dot + '<a href="' + (n.id === "root" ? "#/" : "#/n/" + esc(n.id)) + '">' + esc(n.title) + "</a>";
  }).join('<span class="crumb-sep">›</span>') + "</nav>";
}

function deepestUnder(id, seen) {
  // how many further levels of zoom exist below this node
  const n = narNode(id);
  if (!n || (seen || 0) > 6) return 0;
  let best = 0;
  (n.chapters || []).forEach((c) => { if (c.childId) best = Math.max(best, 1 + deepestUnder(c.childId, (seen || 0) + 1)); });
  return best;
}

function chapterSection(c, i, node) {
  const num = c.number || String(i + 1);
  let h = '<section class="chapter" id="ch-' + esc(c.id) + '">';
  h += '<h2><span class="chapter-num">' + esc(num) + "</span>" + esc(c.title) + "</h2>";
  h += md(c.body, "narrative:" + node.id + ":" + c.id);
  h += sourceCite(c.sources, { small: true, label: "Paper" });
  if (c.edgeIds && c.edgeIds.length) {
    const es = (mainPaper().edges || []).filter((e) => c.edgeIds.indexOf(e.id) !== -1);
    if (es.length) {
      h += '<details class="edge-drawer"><summary>' + es.length +
        " relationship" + (es.length === 1 ? "" : "s") + " behind this</summary><div class=\"body\">" +
        es.map(edgeRow).join("") + "</div></details>";
    }
  }
  h += relatedInsightBlock(node, c);
  const child = c.childId ? narNode(c.childId) : null;
  if (child) {
    const below = deepestUnder(c.childId);
    h += '<a class="zoom" data-depth="' + (child.depth || 1) + '" href="#/n/' + esc(c.childId) + '">' +
      '<span class="zoom-label">Zoom into this chapter</span>' +
      '<span class="zoom-title">' + esc(child.title) + "</span>" +
      '<span class="zoom-sub">' + child.chapters.length + " chapter" + (child.chapters.length === 1 ? "" : "s") +
      (below ? " · " + below + " level" + (below === 1 ? "" : "s") + " deeper still" : "") + "</span></a>";
  }
  h += "</section>";
  return h;
}

function bodyLinkIds(text) {
  const out = new Set();
  (String(text || "").match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g) || []).forEach((m) => {
    out.add(m.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim());
  });
  return out;
}

/* A chapter of the tour offers the Insights chapters that cover the same ground.
   Computed from shared links, so it stays right as the text changes. */
function relatedInsightBlock(node, chapter) {
  if (narKeyOf(node) !== "main") return "";
  const ins = narData("insights");
  if (!ins || !ins.chapters) return "";
  const mine = bodyLinkIds(chapter.body);
  if (mine.size < 3) return "";
  const scored = ins.chapters.map((c) => {
    let n = 0;
    bodyLinkIds(c.body).forEach((x) => { if (mine.has(x)) n++; });
    return { n, c };
  }).filter((x) => x.n >= 3).sort((a, b) => b.n - a.n).slice(0, 2);
  if (!scored.length) return "";
  return '<div class="related-insight"><span class="ri-label">Seen from the connections</span>' +
    scored.map((x) => '<a href="#/insights#ch-' + esc(x.c.id) + '">' + esc(x.c.title) + "</a>").join("") +
    "</div>";
}

function renderNarrativeNode(node) {
  const meta = REG[MAIN_ID] || {};
  let h = "";
  if (node.depth === 0) {
    const key = narKeyOf(node);
    h += '<p class="eyebrow">' + (key === "insights" ? "The second read" : "The first read") + "</p>";
    h += "<h1>" + esc(node.title || meta.title) + "</h1>";
    const other = NARS.find((n) => n.key !== key);
    h += '<p class="level-note">';
    const deep = deepestUnder(node.id);
    if (deep) h += "Every chapter opens into a smaller narrative of its own — " + deep + " level" + (deep === 1 ? "" : "s") + " of zoom below this one. ";
    if (other && narData(other.key)) {
      h += 'The other way through is <a href="' + other.href + '">' + esc((narData(other.key) || {}).title || other.label) + "</a>. ";
    }
    if (mainPaper().summary) {
      h += 'For the argument without the apparatus, <a href="#/summary">the summary</a> runs it end to end in one sitting.';
    }
    h += "</p>";
  } else {
    h += narCrumb(node);
    h += '<p class="level-badge" data-depth="' + node.depth + '">Level ' + node.depth +
      (node.number ? " · chapter " + esc(node.number) : "") + "</p>";
    h += "<h1>" + esc(node.title) + "</h1>";
  }
  h += sourceCite(node.sources);
  if (node.intro) h += '<p class="lede">' + md(node.intro, "narrative:" + node.id).replace(/^<p>|<\/p>$/g, "") + "</p>";
  const base = node.id === "root" ? "#/" : "#/n/" + node.id;
  h += '<ol class="contents">' + node.chapters.map((c, i) =>
    '<li><a href="' + base + "#ch-" + esc(c.id) + '">' +
    '<span class="c-n">' + esc(c.number || String(i + 1)) + "</span>" +
    '<span class="c-t">' + esc(c.title) + "</span></a></li>").join("") + "</ol>";
  node.chapters.forEach((c, i) => { h += chapterSection(c, i, node); });
  if (node.depth === 0 && narKeyOf(node) === "insights") {
    const note = (narData("insights") || {}).unusedNote;
    if (note) {
      h += '<div class="coverage-note"><p class="eyebrow">What this read left out</p>' +
        md(note, "insights:coverage") + "</div>";
    }
  }
  if (node.parentId !== null && node.parentId !== undefined) {
    const parent = narNode(node.parentId);
    if (parent) h += '<a class="up-link" href="' + (parent.id === "root" ? "#/" : "#/n/" + esc(parent.id)) +
      '">← Back out to “' + esc(parent.title) + "”</a>";
  }
  return h;
}

/* ---------- views ---------- */
function vNarrative() {
  const nar = mainPaper().narrative;
  const meta = REG[MAIN_ID] || {};
  if (!nar) {
    const counts = ["concepts", "items", "edges", "themes", "pages"].map((k) => k + ": " + ((mainPaper()[k] || []).length)).join(" · ");
    return '<p class="eyebrow">Skimmaxxer</p><h1>' + esc(meta.title || MAIN_ID) + '</h1><div class="placeholder">The narrative has not been generated yet. Pipeline data loaded so far — ' + esc(counts) + ". Use the sidebar to browse what exists.</div>";
  }
  return renderNarrativeNode(rootNode());
}

/* ---------- summary ---------- */
/* The whole argument end to end, in one sitting. Same floor as everything
   else - what makes it a summary is shape, not level: the line of reasoning
   only, no figures and no evidence apparatus. Flat on purpose, because a
   reader who wanted to open things would be reading the story instead. */
function vSummary() {
  const sm = mainPaper().summary;
  const meta = REG[MAIN_ID] || {};
  if (!sm) return notFound("summary");
  const beats = sm.beats || [];
  let h = '<p class="eyebrow">Start here</p>';
  h += "<h1>" + esc(sm.title || meta.title || MAIN_ID) + "</h1>";
  h += '<p class="level-note">The whole argument end to end, in one sitting — no figures, ' +
    "no run names, nothing to open. " +
    (mainPaper().narrative ? 'The fuller telling is <a href="#/">The story</a>.' : "") + "</p>";
  h += sourceCite(sm.sources);
  if (sm.lede) h += '<p class="lede">' + md(sm.lede, "summary:lede").replace(/^<p>|<\/p>$/g, "") + "</p>";
  if (beats.length > 1) {
    h += '<ol class="contents">' + beats.map((b, i) =>
      '<li><a href="#/summary#b-' + esc(b.id) + '">' +
      '<span class="c-n">' + (i + 1) + "</span>" +
      '<span class="c-t">' + esc(b.heading) + "</span></a></li>").join("") + "</ol>";
  }
  beats.forEach((b, i) => {
    h += '<section class="chapter beat" id="b-' + esc(b.id) + '">';
    h += '<h2><span class="chapter-num">' + (i + 1) + "</span>" + esc(b.heading) + "</h2>";
    h += md(b.body, "summary:" + b.id);
    h += sourceCite(b.sources, { small: true, label: "Paper" });
    h += "</section>";
  });
  if (mainPaper().narrative) {
    h += '<a class="zoom" data-depth="1" href="#/">' +
      '<span class="zoom-label">Read it properly</span>' +
      '<span class="zoom-title">' + esc((mainPaper().narrative || {}).title || "The story") + "</span>" +
      '<span class="zoom-sub">The same paper at full length, with the figures and the evidence</span></a>';
  }
  return h;
}

function vNarrativeNode(id) {
  const node = narNode(id);
  if (!node) return notFound(id);
  return renderNarrativeNode(node);
}

function vConcept(id) {
  const t = INDEX[id];
  if (!t || t.kind !== "concept") return notFound(id);
  const c = t.obj;
  const owner = REG[t.paperId] || {};
  let h = '<p class="eyebrow">Concept' + (t.paperId !== MAIN_ID ? " · from " + esc(owner.title || t.paperId) : "") + "</p>";
  /* A reader only reaches another paper's concept through the relations page,
     so that is where "back" goes. Without it the only way out is the browser
     button, and the reader has quietly left the paper they were reading. */
  if (t.paperId !== MAIN_ID) {
    const here = REG[MAIN_ID] || {};
    h += '<div class="callout"><p class="small">You have stepped out of ' +
      esc(here.title || MAIN_ID) + ' into a paper it draws on.' +
      /* Only offer the way back if there is one. A paper built before the
         relations page exists has no such page, and pointing at an empty one
         is worse than pointing nowhere. */
      (pageFor(MAIN_ID) ? ' <a href="#/relations">Back to how the two relate →</a>' : '') +
      "</p></div>";
  }
  h += "<h1>" + esc(c.name) + "</h1>" + conceptChips(c);
  h += sourceCite(c.sources);
  const pg = pageFor(id);
  h += '<p class="lede">' + md(c.summary, "concept:" + id).replace(/^<p>|<\/p>$/g, "") + "</p>";
  if (pg) h += md(pg.body, "page:" + id);
  else if (c.explanation) h += md(c.explanation, "concept:" + id);

  if (c.citedFrom) {
    const rp = Object.keys(REG).find((pid) => pid !== MAIN_ID && (conceptsOf(pid) || []).some((x) => x.id === id));
    h += '<div class="callout"><p class="eyebrow">From a cited paper</p><p>This concept comes from ' + esc(c.citedFrom.refText || c.citedFrom.citationKey) + ". " + esc(c.citedFrom.whyNeeded || "") +
      (rp ? ' See <a href="#/paper/' + esc(rp) + '">what was read from it</a>.' : "") + "</p></div>";
  }

  if (c.deepDive) {
    const dd = c.deepDive, rp = REG[dd.paperId] || {};
    h += '<div class="callout"><p class="eyebrow">Defined in ' + esc(dd.citationKey) + '</p><p>This paper reuses the mechanism rather than defining it. It is defined in <a href="#/paper/' + esc(dd.paperId) + '">' + esc(rp.title || dd.paperId) + "</a>, read narrowly for this explainer:</p><div class=\"chips\">" +
      dd.conceptIds.map((x) => (INDEX[x] ? chip("#/concept/" + x, displayName(INDEX[x])) : "")).join("") + "</div></div>";
  }
  if (c.sourceNote) h += '<p class="small muted">Where this lives in the paper: ' + esc(c.sourceNote) + "</p>";

  const kids = conceptsOf(t.paperId).filter((k) => k.parent === id);
  if (kids.length) {
    h += "<h2>Inside this concept</h2>" + kids.map((k) =>
      '<details class="sub-concept"><summary>' + esc(k.name) + '<span class="hint">' + esc((k.summary || "").slice(0, 90)) + '</span></summary><div class="body">' +
      md(k.explanation || k.summary, "concept:" + k.id) +
      (conceptsOf(t.paperId).some((g) => g.parent === k.id) ? '<p class="small"><a href="#/concept/' + esc(k.id) + '">Open ' + esc(k.name) + " →</a></p>" : "") +
      "</div></details>").join("");
  }
  if ((c.prerequisites || []).length) {
    h += "<h2>Before this</h2><div class=\"chips\">" + c.prerequisites.map((p) => {
      const pt = INDEX[p];
      return pt ? chip("#/" + routeFor(pt), displayName(pt)) : chip(null, p, "floor");
    }).join("") + "</div>";
  }
  const evid = (mainPaper().items || []).filter((it) => (it.terms || []).some((x) => x.conceptId === id));
  if (evid.length) {
    h += "<h2>Where you can see it</h2>" + evid.map((it) =>
      '<div class="card"><a class="title" href="#/figure/' + esc(it.id) + '">' + esc(it.title || it.id) + "</a> " +
      chip(null, it.kind + (it.number ? " " + it.number : ""), "floor") +
      '<p class="sub">' + esc(it.takeaway || it.caption || "") + "</p></div>").join("");
  }
  const ed = edgesTouching(id);
  if (ed.length) h += "<h2>Connections</h2>" + ed.map(edgeRow).join("");
  return h;
}

function vTheme(id) {
  const t = INDEX[id];
  if (!t || t.kind !== "theme") return notFound(id);
  const th = t.obj;
  const isEdge = th.kind === "edge-theme";
  let h = '<p class="eyebrow">' + (isEdge ? "Edge theme" : "Theme") + "</p><h1>" + esc(th.name) + "</h1>";
  h += sourceCite(th.sources);
  if (th.summary) h += '<p class="lede">' + md(th.summary, "theme:" + id).replace(/^<p>|<\/p>$/g, "") + "</p>";
  const pg = pageFor(id);
  if (pg) h += md(pg.body, "page:" + id);
  if (isEdge) {
    const all = mainPaper().edges || [];
    const mem = all.filter((e) => (th.members || []).includes(e.id));
    if (mem.length) h += "<h2>The connections</h2>" + mem.map(edgeRow).join("");
  } else {
    const mem = (th.members || []).map((m) => INDEX[m]).filter((x) => x && x.kind === "concept").map((x) => x.obj);
    if (mem.length) h += "<h2>Concepts in this theme</h2>" + mem.map(conceptCard).join("");
  }
  return h;
}

function vFigure(id) {
  const t = INDEX[id];
  if (!t || t.kind !== "item") return notFound(id);
  const it = t.obj;
  const kindName = { figure: "Figure", table: "Table", equation: "Equation" }[it.kind] || "Item";
  let h = '<p class="eyebrow">' + kindName + (it.number ? " " + it.number : "") + "</p>";
  h += "<h1>" + esc(it.title || (it.caption ? it.caption.split(/[:.]/)[0] : it.id)) + "</h1>";
  if (it.asset) {
    h += '<div class="figure-wrap"><img src="../papers/' + esc(t.paperId) + "/" + esc(it.asset) + '" alt="' + esc(it.caption || it.id) + '"></div>';
    h += '<p class="fig-note">' + (it.page
      ? 'Cropped as-is from <a href="' + esc(pdfHref(t.paperId, it.page)) + '"' + pdfAttrs(t.paperId) +
        ">page " + esc(it.page) + "</a> of the PDF."
      : 'The authors’ own image, taken whole from <a href="' + esc(pdfHref(t.paperId, it.anchor)) + '"' +
        pdfAttrs(t.paperId) + ">where it sits in the paper</a>.") + "</p>";
  }
  if (it.kind === "equation" && it.latex) h += '<div class="figure-wrap"><span class="math-pending math-block">$$' + esc(it.latex) + "$$</span></div>";
  if (!it.asset) h += sourceCite(it.sources);
  /* A caption the paper printed is quoted as the authors' words. A caption
     inferred from the sentence that leads into the figure is not their
     caption at all, so it is labelled as what it actually is - otherwise a
     sentence that describes the neighbourhood reads as a description of the
     picture, and the reader has no way to tell the difference. */
  if (it.caption) {
    h += it.captionInferred
      ? '<blockquote class="lead-in"><p class="lead-in-label">How the article leads into it</p><p>' +
        esc(it.caption) + "</p></blockquote>"
      : "<blockquote><p>" + esc(it.caption) + "</p></blockquote>";
  }
  if (it.takeaway) h += '<div class="callout"><p class="eyebrow">Takeaway</p>' + md(it.takeaway, "item:" + id) + "</div>";
  /* This page says what this plot shows. The chart page says why the shape was
     chosen and how to get information out of one - which is the part that
     carries from here to the next figure of the same kind. */
  if (it.chartId && INDEX[it.chartId]) {
    const ch = INDEX[it.chartId].obj || {};
    h += '<a class="chart-link" href="#/concept/' + esc(it.chartId) + '">' +
      '<span class="chart-link-label">How to read this kind of chart</span>' +
      '<span class="chart-link-name">' + esc(ch.name || it.chartId) + "</span></a>";
  }
  if (it.walkthrough) h += md(it.walkthrough, "item:" + id);
  if ((it.terms || []).length) {
    h += "<h2>Every term in it</h2><div class=\"table-scroll\"><table class=\"kv\"><tr><th>Term</th><th>Meaning here</th></tr>" +
      it.terms.map((x) => "<tr><td class=\"k\">" + (x.conceptId ? termLink(x.conceptId, x.term, "item:" + id) : esc(x.term)) + "</td><td>" + md(x.definition, "item:" + id).replace(/^<p>|<\/p>$/g, "") + "</td></tr>").join("") + "</table></div>";
  }
  if ((it.numbers || []).length) {
    h += "<h2>Every number in it</h2><div class=\"table-scroll\"><table class=\"kv\"><tr><th>Value</th><th>What it means</th></tr>" +
      it.numbers.map((x) => "<tr><td class=\"k\">" + esc(x.value) + "</td><td>" + md(x.meaning, "item:" + id).replace(/^<p>|<\/p>$/g, "") + "</td></tr>").join("") + "</table></div>";
  }
  return h;
}

function vFigures() {
  const items = mainPaper().items || [];
  let h = '<p class="eyebrow">Self-sufficient figures</p><h1>Figures, tables & equations</h1><p class="lede">Each one is meant to be understandable on its own — every term and number in it defined.</p>';
  [["figure", "Figures"], ["table", "Tables"], ["equation", "Equations"]].forEach(([k, label]) => {
    const group = items.filter((i) => i.kind === k);
    if (!group.length) return;
    h += "<h2>" + label + "</h2><div class=\"card-grid\">" + group.map((it) =>
      '<div class="card">' + (it.asset ? '<a href="#/figure/' + esc(it.id) + '"><img loading="lazy" style="max-width:100%;max-height:130px;object-fit:contain" src="../papers/' + esc(MAIN_ID) + "/" + esc(it.asset) + '" alt=""></a>' : "") +
      '<a class="title" href="#/figure/' + esc(it.id) + '">' + esc(it.title || (it.caption || it.id).split(":")[0]) + '</a><p class="sub">' + esc((it.takeaway || it.caption || "").slice(0, 140)) + "</p></div>").join("") + "</div>";
  });
  return h;
}

function vMap() {
  const p = mainPaper();
  const themes = (p.themes || []).filter((t) => t.kind === "concept-theme");
  const placed = new Set();
  let h = '<p class="eyebrow">The map</p><h1>All concepts</h1><p class="lede">Everything the paper leans on, grouped by theme. Greyed entries sit at the reader’s assumed-knowledge floor.</p>';
  themes.forEach((t) => {
    const mem = (t.members || []).map((m) => { placed.add(m); return INDEX[m]; }).filter((x) => x && x.kind === "concept").map((x) => x.obj);
    h += '<h2><a class="term" href="#/theme/' + esc(t.id) + '">' + esc(t.name) + "</a></h2>" + mem.map(conceptCard).join("");
  });
  const rest = (p.concepts || []).filter((c) => !placed.has(c.id));
  if (rest.length) h += "<h2>Not grouped</h2>" + rest.map(conceptCard).join("");
  return h;
}

function vEdges() {
  const p = mainPaper();
  const eth = (p.themes || []).filter((t) => t.kind === "edge-theme");
  let h = '<p class="eyebrow">How it hangs together</p><h1>Relationships</h1><p class="lede">The edges between concepts, figures and results — grouped into stories.</p>';
  eth.forEach((t) => {
    h += '<h2><a class="term" href="#/theme/' + esc(t.id) + '">' + esc(t.name) + "</a></h2>";
    if (t.summary) h += "<p>" + md(t.summary, "theme:" + t.id).replace(/^<p>|<\/p>$/g, "") + "</p>";
  });
  const types = ["depends-on", "supported-by", "instance-of", "contrasts-with"];
  types.forEach((ty) => {
    const group = (p.edges || []).filter((e) => e.type === ty);
    if (!group.length) return;
    h += '<h2><span class="chip t-' + ty + '">' + ty.replace(/-/g, " ") + "</span></h2>" + group.map(edgeRow).join("");
  });
  return h;
}

function vPapers() {
  let h = '<p class="eyebrow">The register</p><h1>Papers</h1><p class="lede">Every paper this project has touched. Cited papers are read narrowly — only the concepts this paper needed.</p>';
  Object.keys(REG).forEach((pid) => {
    const r = REG[pid];
    const n = conceptsOf(pid).length;
    h += '<div class="card"><a class="title" href="#/paper/' + esc(pid) + '">' + esc(r.title) + "</a> " +
      chip(null, r.status === "full" ? "full read" : "narrow read", r.status === "full" ? "major" : "floor") +
      '<p class="sub">' + esc(r.authors || "") + (n ? " · " + n + " concepts extracted" : "") + "</p></div>";
  });
  const refs = mainPaper().refs;
  if (refs && (refs.accessed || []).length) {
    h += "<h2>Accessed while building this explainer</h2>" + refs.accessed.map((a) =>
      '<div class="edge-row"><div>' + (REG[a.paperId] ? '<a class="term" href="#/paper/' + esc(a.paperId) + '">' + esc(REG[a.paperId].title) + "</a>" : esc(a.paperId)) +
      ' <span class="chip">' + esc(a.citationKey || "") + '</span><div class="edge-exp">' + esc(a.whyNeeded || "") + "</div></div></div>").join("");
  }
  return h;
}

function vPaper(pid) {
  const r = REG[pid];
  if (!r) return notFound(pid);
  const cs = conceptsOf(pid);
  const eyebrow = pid === MAIN_ID ? "Main paper"
    : r.status === "full" ? "Another paper in this project · read in full"
    : "Cited paper · read narrowly";
  let h = '<p class="eyebrow">' + eyebrow + "</p><h1>" + esc(r.title) + "</h1>";
  h += '<p class="lede">' + esc(r.authors || "") + "</p><div class=\"chips\">" + chip(r.source, "source", "") + "</div>";
  if (r.status !== "full") {
    /* Name the papers that actually needed it, not whichever shell you are in -
       a narrow read can be shared by several papers. */
    const by = (r.citedBy || []).map((p) => (REG[p] && REG[p].title) || p);
    h += "<p>Read in a narrow scope: only the concepts " +
      (by.length ? by.map((t) => "“" + esc(t) + "”").join(" and ") : "the citing paper") +
      " needed. Each paper stands independently, so these concepts belong to this paper and are reused by anything that cites it.</p>";
  }
  if (cs.length) h += "<h2>Concepts extracted</h2>" + cs.map(conceptCard).join("");
  else h += '<div class="placeholder">Nothing extracted from this paper yet.</div>';
  return h;
}

const notFound = (id) => '<h1>Not found</h1><p>Nothing is registered under <code>' + esc(id) + "</code>.</p>";

/* ---------- the reader ---------- */
/* The paper as printed, with the concepts of the block you are on beside it.
   Ingest keeps where every block sits, as fractions of its page, so the
   overlay is a multiplication by whatever size the page is drawn at and holds
   at any zoom. Everything else here is bookkeeping around that.

   Nothing is drawn on the paper while you read. The column says which block it
   is talking about by quoting its opening words, which is the same information
   without putting a UI selection over someone else's typography. The page
   marks only under the pointer and when pinned, where a mark is an affordance
   rather than a label. */

const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/";
const ZOOMS = [0.75, 1, 1.25, 1.5, 2];
const ZOOM_KEY = "skim-reader-zoom";
const RD = { onScroll: null, onResize: null, onMove: null, live: null, pinned: null,
             byId: {}, doc: null, wraps: [], stack: [], zoom: 1, pdfjs: null,
             kind: "pdf", frame: null, fdoc: null, index: null };

let pdfjsLoading = null;
function ensurePdfjs() {
  if (pdfjsLoading) return pdfjsLoading;
  pdfjsLoading = new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = PDFJS + "pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      ok(window.pdfjsLib);
    };
    s.onerror = () => no(new Error("pdf.js did not load"));
    document.head.appendChild(s);
  });
  return pdfjsLoading;
}

const regionsOf = () => mainPaper().regions || [];

/* ---------- blocks, whichever the paper is ---------- */
/* Everything the reader does - follow the scroll, pin, jump to a find hit -
   is about one block at a time. On a PDF a block is an overlay drawn from the
   fractions ingest recorded; on a web paper it is the author's own element,
   tagged in the copy we serve. These four say which, and nothing else has to
   ask. */

const cssq = (s) => String(s).replace(/"/g, '\\"');
const blockAttr = () => (RD.kind === "web" ? "data-skim" : "data-rgn");

function blockNodes() {
  if (RD.kind === "web") return RD.fdoc ? RD.fdoc.querySelectorAll("[data-skim]") : [];
  return document.querySelectorAll("#pdf-pane .rgn");
}
function blockNode(id) {
  if (RD.kind === "web") return RD.fdoc ? RD.fdoc.querySelector('[data-skim="' + cssq(id) + '"]') : null;
  return document.querySelector('#pdf-pane [data-rgn="' + cssq(id) + '"]');
}
/* Inside the frame a rect is measured from the frame's own top left. The frame
   is laid out at its full height and never scrolls itself, so one offset puts
   those numbers back into the coordinates everything else works in. */
function blockRect(node) {
  const r = node.getBoundingClientRect();
  if (RD.kind !== "web" || !RD.frame) return r;
  const f = RD.frame.getBoundingClientRect();
  return { top: r.top + f.top, bottom: r.bottom + f.top };
}
function clearPinned() {
  blockNodes().forEach((n) => n.classList.remove("pinned", "skim-pinned"));
}

/* Where every block sits, measured once.

   The frame is laid out at the full height of the article and never scrolls
   itself, so a block's offset inside the page does not change while you read.
   Asking the browser for all of them on every scroll frame does change
   something though: each getBoundingClientRect forces a layout flush, and on
   a document of forty-odd thousand elements that costs most of a frame. It
   was the whole reason the reader felt heavy - not the article's own widgets,
   which are only expensive because they make each flush dearer.

   So they are measured once into a sorted list and searched. Rebuilt whenever
   the article's height can have changed: its own scripts settling, a resize,
   a zoom. */
function buildBlockIndex() {
  RD.index = null;
  if (RD.kind !== "web" || !RD.fdoc || !RD.frame) return;
  const base = RD.frame.getBoundingClientRect().top + window.scrollY;
  const out = [];
  RD.fdoc.querySelectorAll("[data-skim]").forEach((n) => {
    const r = n.getBoundingClientRect();
    if (!r.height && !r.width) return;              // not laid out yet
    out.push({ id: n.getAttribute("data-skim"), top: r.top + base, mid: (r.top + r.bottom) / 2 + base });
  });
  out.sort((a, b) => a.top - b.top);
  RD.index = out;
}

/* The block the column is about: the one whose middle is nearest the middle of
   the screen. Binary search, then a handful of neighbours - blocks overlap and
   nest, so the nearest by midpoint is not always the one the search lands on. */
function liveBlockId() {
  if (RD.kind === "web") {
    if (!RD.index || !RD.index.length) return RD.live;
    const aim = window.scrollY + window.innerHeight / 2;
    let lo = 0, hi = RD.index.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (RD.index[m].mid < aim) lo = m + 1; else hi = m; }
    let best = null, bestD = Infinity;
    for (let k = Math.max(0, lo - 4); k < Math.min(RD.index.length, lo + 4); k++) {
      const d = Math.abs(RD.index[k].mid - aim);
      if (d < bestD) { bestD = d; best = RD.index[k]; }
    }
    return best ? best.id : null;
  }
  const aim = window.innerHeight / 2;
  let best = null, bestD = Infinity;
  blockNodes().forEach((s) => {
    const r = s.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const d = Math.abs((r.top + r.bottom) / 2 - aim);
    if (d < bestD) { bestD = d; best = s; }
  });
  return best ? best.getAttribute("data-rgn") : null;
}
/* Paragraph id -> ordered concept ids. Absent until stage 2c has run, and the
   column falls back to the section's own concepts, unordered, until it has. */
function readingMap() {
  const out = {};
  (mainPaper().reading || []).forEach((r) => { out[r.id] = r.concepts || []; });
  return out;
}
/* "3.2.1" -> "§3.2.1 Scaled Dot-Product Attention". A block is easier to place
   by its section's name than by its number. */
function sectionLabel(sid) {
  const s = (mainPaper().sections || []).find((x) => x.id === sid);
  return "§" + sid + (s && s.title ? " " + s.title : "");
}
const conceptsInSection = (sid) =>
  conceptsOf(MAIN_ID).filter((c) => !c.floor && (c.sectionIds || []).includes(sid));

/* Which section each piece of evidence belongs to.

   A web paper records it on the item, because ingest knew the figure's place
   in the document. A PDF paper does not - a crop knows its page and nothing
   more - so it is read off the order things sit in: a figure belongs to the
   section of the last prose that came before it. Built once. */
let ITEM_SECTION = null;
function itemSection() {
  if (ITEM_SECTION) return ITEM_SECTION;
  const map = {};
  (mainPaper().items || []).forEach((it) => { if (it.section) map[it.id] = it.section; });
  let last = null;
  regionsOf().forEach((g) => {
    if (g.kind === "item") { if (!map[g.id]) map[g.id] = g.sectionId || last; }
    else if (g.sectionId) last = g.sectionId;
  });
  ITEM_SECTION = map;
  return map;
}
const itemsInSection = (sid) => {
  const where = itemSection();
  return (mainPaper().items || []).filter((it) => sid && where[it.id] === sid);
};

/* Summaries were written for prose, so they carry math and wiki-links. The
   list wants the math rendered and the links flattened: a row is already a
   click target for its own concept, and a link inside it would fight that. */
function beside_md(src, where) {
  return md(String(src || "").replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (m, id) => id.replace(/-/g, " ")), where)
    .replace(/^<p>|<\/p>$/g, "");
}

/* The opening words of a block, which is how the column names it. */
function blockQuote(g) {
  const t = String(g.text || "").replace(/\s+/g, " ").trim();
  if (t.length <= 58) return t;
  return t.slice(0, 58).replace(/\s+\S*$/, "") + "…";
}

/* ---------- the column ---------- */

function columnList(g) {
  if (!g) return '<p class="beside-empty">Scroll the paper. The concepts of whatever you are reading appear here.</p>';

  /* Evidence sitting in the same stretch of the paper. The column already says
     what a paragraph is about; what it could not say is what the paper shows
     you there, which is usually the thing a reader is looking for when the
     prose says "as we see below". */
  const figRow = (it) =>
    '<div class="beside-c small" data-open="item:' + esc(it.id) + '">' +
    '<span class="beside-fig">' + esc(itemLabel(it)) + "</span>" +
    '<span class="beside-name">' + esc(it.title || it.id) + "</span></div>";

  function evidenceBlock(sid, exceptId) {
    const figs = itemsInSection(sid).filter((it) => it.id !== exceptId);
    if (!figs.length) return "";
    const show = figs.slice(0, 3), rest = figs.slice(3);
    return '<p class="beside-label beside-label-more">' +
      (exceptId ? "Also shown here" : "Shown in " + esc(sectionLabel(sid))) + "</p>" +
      show.map(figRow).join("") +
      (rest.length
        ? '<details class="beside-fold"><summary>' + rest.length + " more here</summary>" +
          rest.map(figRow).join("") + "</details>"
        : "");
  }

  if (g.kind === "item") {
    const it = (mainPaper().items || []).find((x) => x.id === g.id);
    if (!it) return "";
    return '<p class="beside-label">' + esc(itemLabel(it)) + "</p>" +
      '<div class="beside-c" data-open="item:' + esc(it.id) + '">' +
      '<span class="beside-name">' + esc(it.title || it.id) + "</span>" +
      (it.takeaway ? '<p class="beside-sum">' + beside_md(it.takeaway, "beside:" + it.id) + "</p>" : "") +
      "</div>" + evidenceBlock(itemSection()[it.id], it.id);
  }

  const sid = g.sectionId;
  const pool = conceptsInSection(sid);
  const ranked = RD.reading[g.id];
  const chosen = (ranked && ranked.length ? ranked : (g.kind === "heading" ? pool.map((c) => c.id) : []))
    .map((id) => pool.find((c) => c.id === id)).filter(Boolean);
  /* Before stage 2c there is no ranking, so show the section's concepts rather
     than an empty column - it is the honest fallback, and it is what the
     ranking will be drawn from anyway. */
  const list = chosen.length ? chosen : (ranked ? [] : pool);
  const rest = pool.filter((c) => !list.includes(c));

  const row = (c, small) =>
    '<div class="beside-c' + (small ? " small" : "") + '" data-open="concept:' + esc(c.id) + '">' +
    '<span class="beside-name">' + esc(c.name) + "</span>" +
    (small ? "" : '<p class="beside-sum">' + beside_md(c.summary, "beside:" + c.id) + "</p>") + "</div>";

  let h = g.kind === "heading"
    ? '<p class="beside-label">In ' + esc(sectionLabel(sid)) + "</p>"
    : '<p class="beside-label">In this paragraph</p><p class="beside-quote">' + esc(blockQuote(g)) + "</p>";
  if (!list.length) h += '<p class="beside-empty">Nothing above the floor here.</p>';
  h += list.map((c) => row(c)).join("");
  if (rest.length) {
    h += '<details class="beside-fold"><summary>' + rest.length + " more in " + esc(sectionLabel(sid)) + "</summary>" +
      rest.map((c) => row(c, true)).join("") + "</details>";
  }
  h += evidenceBlock(sid, null);
  return h;
}

/* A concept, item or theme opened inside the column. The same renderers the
   rest of the site uses, so an explainer page looks like itself here. */
function columnPage(entry) {
  const t = INDEX[entry.id];
  const body = entry.kind === "item" ? vFigure(entry.id)
    : entry.kind === "theme" ? vTheme(entry.id)
    : vConcept(entry.id);
  const route = entry.kind === "item" ? "figure/" : entry.kind === "theme" ? "theme/" : "concept/";
  return '<div class="col-head">' +
    '<button class="col-back" id="col-back" type="button">' +
    (RD.stack.length > 1 ? "← Back" : "← The paragraph") + "</button></div>" +
    '<div class="content col-body">' + body +
    '<p class="col-out"><a class="col-out-link" href="#/' + route + esc(entry.id) + '">' +
    "Open this on the full site →</a></p></div>";
}

function paintColumn() {
  const box = el("beside-body");
  if (!box) return;
  const top = RD.stack[RD.stack.length - 1];
  box.innerHTML = top ? columnPage(top) : columnList(RD.byId[RD.pinned || RD.live]);
  mountMath(box);
  const reader = document.querySelector(".reader");
  if (reader) {
    const was = reader.classList.contains("wide");
    reader.classList.toggle("wide", !!top);
    // The column takes its width from the paper, so the paper has to be drawn
    // again at what is left - and for an article that also changes how tall it
    // is, so the frame is re-fitted and the block offsets re-measured. A
    // snapped layout is already at its new width; an animated one is not.
    if (was !== !!top) {
      if (reader.classList.contains("framed")) applyZoom();
      else setTimeout(applyZoom, 260);
    }
  }
  const pin = el("beside-pin");
  if (pin) pin.hidden = !RD.pinned || !!top;
  const bar = el("beside-bar");
  if (bar) {
    const g = RD.byId[RD.pinned || RD.live];
    bar.textContent = top ? (displayName(INDEX[top.id]) || "Concept")
      : g && g.kind === "item" ? "This figure" : "Concepts here";
  }
  if (top) box.scrollTop = 0;
}

function pushColumn(kind, id) {
  if (!INDEX[id]) return;
  RD.stack.push({ kind, id });
  paintColumn();
}
function popColumn() {
  RD.stack.pop();
  /* Coming back wants the block you left from. If the reader scrolled while a
     page was open there may not be one, so take whatever is on screen now. */
  if (!RD.stack.length && !RD.byId[RD.pinned || RD.live]) {
    const seen = Array.from(blockNodes()).find((s2) => {
      const r = blockRect(s2);
      return r.bottom > 0 && r.top < window.innerHeight;
    });
    if (seen) RD.live = seen.getAttribute(blockAttr());
  }
  paintColumn();
}

/* ---------- find ---------- */
/* Selection is gone from the paper, so the browser's own find has nothing to
   catch. This replaces it with something better suited: the block text is
   already on hand, so a hit can land the reader on the block AND show what
   that block is about, which Ctrl+F never could. */

function findMatches(q) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const out = [];
  for (const g of regionsOf()) {
    if (g.kind === "item" || !g.text) continue;
    const hay = g.text.toLowerCase();
    const at = hay.indexOf(needle);
    if (at < 0) continue;
    out.push({ g, at });
    if (out.length >= 40) break;
  }
  return out;
}

function findSnippet(g, at, len) {
  const t = String(g.text).replace(/\s+/g, " ");
  // The match moved when the whitespace collapsed, so find it again in what
  // will actually be shown rather than trusting the raw offset.
  const i = Math.max(0, t.toLowerCase().indexOf(t.slice(at, at + len).toLowerCase()));
  const from = Math.max(0, i - 34);
  const to = Math.min(t.length, i + len + 46);
  return (from ? "…" : "") + esc(t.slice(from, i)) +
    "<mark>" + esc(t.slice(i, i + len)) + "</mark>" +
    esc(t.slice(i + len, to)) + (to < t.length ? "…" : "");
}

function paintFind() {
  const box = el("find-results");
  const input = el("find");
  if (!box || !input) return;
  const q = input.value;
  const hits = findMatches(q);
  if (q.trim().length < 2) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  if (!hits.length) {
    box.innerHTML = '<p class="find-none">Nothing in the paper matches that.</p>';
    return;
  }
  box.innerHTML = '<p class="find-count">' + hits.length + (hits.length === 40 ? "+" : "") +
    " in the paper</p>" + hits.map((h) =>
    '<button class="find-row" type="button" data-goto="' + esc(h.g.id) + '">' +
    '<span class="find-sec">' + esc(sectionLabel(h.g.sectionId)) +
    (h.g.page ? " · p" + h.g.page : "") + "</span>" +
    '<span class="find-snip">' + findSnippet(h.g, h.at, q.trim().length) + "</span></button>").join("");
}

function closeFind() {
  const box = el("find-results");
  if (box) { box.hidden = true; box.innerHTML = ""; }
}

/* A hit puts you on the block and pins it, so the column stays on what you
   were looking for instead of sliding off as the scroll settles. */
function gotoBlock(id) {
  const node = blockNode(id);
  if (!node) return;
  closeFind();
  const input = el("find");
  if (input) input.blur();
  RD.stack = [];
  RD.pinned = id;
  RD.live = id;
  clearPinned();
  node.classList.add(RD.kind === "web" ? "skim-pinned" : "pinned");
  node.scrollIntoView({ block: "center" });
  paintColumn();
}

/* Clicking a block pins the column to it, and clicking it again lets go. The
   same act whether the block is an overlay on a page or a paragraph of the
   authors' own markup. */
function selectBlock(id) {
  RD.pinned = RD.pinned === id ? null : id;
  RD.live = id;
  RD.stack = [];
  clearPinned();
  if (RD.pinned) {
    const n = blockNode(id);
    if (n) n.classList.add(RD.kind === "web" ? "skim-pinned" : "pinned");
  }
  paintColumn();
}

/* ---------- zoom ---------- */

function readZoom() {
  try {
    const v = parseFloat(localStorage.getItem(ZOOM_KEY));
    return ZOOMS.indexOf(v) >= 0 ? v : 1;
  } catch (e) { return 1; }
}
function writeZoom(v) { try { localStorage.setItem(ZOOM_KEY, String(v)); } catch (e) { /* private mode */ } }

/* Width the paper is drawn at. One times is the pane, capped at a comfortable
   measure; past that the pane scrolls sideways rather than the page shrinking
   anything to fit. */
function pageWidth() {
  const pane = el("pdf-pane");
  if (!pane) return 0;
  const cs = getComputedStyle(pane);
  const inner = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  return Math.max(240, Math.min(inner, 900) * RD.zoom);
}

function applyZoom(step) {
  if (step) {
    const i = ZOOMS.indexOf(RD.zoom);
    const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (i < 0 ? 1 : i) + step))];
    if (next === RD.zoom) return;
    RD.zoom = next;
    writeZoom(next);
  }
  const pane = el("pdf-pane");
  if (!pane) return;
  if (RD.kind === "web") {
    /* A web article is laid out to its own measure, so a wider pane changes
       nothing about it. What zoom means here is what it means in a browser:
       bigger text. The frame is re-fitted after, because that changes how
       tall the article is. */
    if (RD.fdoc && RD.fdoc.body) {
      RD.fdoc.body.style.zoom = RD.zoom;
      if (RD.remeasure) { RD.remeasure(); setTimeout(() => RD.remeasure(), 140); }
    }
  } else {
    pane.style.setProperty("--pdf-w", pageWidth() + "px");
  }
  const out = el("zoom-out"), inn = el("zoom-in"), lbl = el("zoom-label");
  if (lbl) lbl.textContent = Math.round(RD.zoom * 100) + "%";
  if (out) out.disabled = RD.zoom === ZOOMS[0];
  if (inn) inn.disabled = RD.zoom === ZOOMS[ZOOMS.length - 1];
  if (RD.kind !== "web") redrawPages();
}

/* A canvas is drawn for one width. Change the width and it has to be drawn
   again, so a zoom or a resize throws away every page already rendered. */
let redrawTimer = null;
function redrawPages() {
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(() => {
    RD.wraps.forEach((e) => {
      if (!e.drawn) return;
      e.drawn = false;
      e.w.querySelectorAll("canvas").forEach((x) => x.remove());
    });
    RD.wraps.forEach((e) => {
      const r = e.w.getBoundingClientRect();
      if (r.bottom > -900 && r.top < window.innerHeight + 900) drawPage(e);
    });
  }, 90);
}

async function drawPage(entry) {
  if (entry.drawn || !RD.pdfjs) return;
  entry.drawn = true;
  const width = entry.w.clientWidth;
  if (!width) { entry.drawn = false; return; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vp = entry.pg.getViewport({ scale: width / entry.vp.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(vp.width * dpr);
  canvas.height = Math.floor(vp.height * dpr);
  entry.w.insertBefore(canvas, entry.w.firstChild);
  try {
    await entry.pg.render({
      canvasContext: canvas.getContext("2d"),
      viewport: vp,
      transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
    }).promise;
  } catch (e) { /* a page that will not draw is left blank rather than fatal */ }
}

/* ---------- mount ---------- */

function readerTeardown() {
  if (RD.onScroll) window.removeEventListener("scroll", RD.onScroll, { capture: true });
  if (RD.onResize) window.removeEventListener("resize", RD.onResize);
  RD.onScroll = RD.onResize = RD.onMove = null;
  RD.live = RD.pinned = null;
  RD.byId = {};
  RD.wraps = [];
  RD.stack = [];
  RD.frame = RD.fdoc = RD.index = RD.remeasure = null;
  if (RD.doc) { try { RD.doc.destroy(); } catch (e) { /* already gone */ } RD.doc = null; }
}

function vReader(startAt) {
  if (!regionsOf().length) {
    const web = readerKind(MAIN_ID) === "web";
    return '<p class="eyebrow">The paper</p><h1>Not ready for this paper</h1>' +
      '<p>Ingest has not recorded where the text sits yet. ' +
      '<a href="' + esc(paperFile(MAIN_ID)) + '" target="_blank" rel="noopener">Open the ' +
      (web ? "page" : "PDF") + "</a> instead.</p>";
  }
  RD.kind = readerKind(MAIN_ID);
  RD.startAt = startAt ? decodeURIComponent(String(startAt)) : "";
  RD.zoom = readZoom();
  const meta = REG[MAIN_ID] || {};
  return '<div class="reader-top">' +
    '<a class="reader-back" href="#/">&larr; ' + esc(meta.title || MAIN_ID) + "</a>" +
    '<span class="find-wrap">' +
    '<input id="find" type="search" placeholder="Find in the paper…" autocomplete="off" spellcheck="false">' +
    '<div class="find-results" id="find-results" hidden></div></span>' +
    '<span class="reader-count" id="reader-count"></span>' +
    '<span class="zoom">' +
    '<button id="zoom-out" type="button" aria-label="Zoom out">&minus;</button>' +
    '<span id="zoom-label">100%</span>' +
    '<button id="zoom-in" type="button" aria-label="Zoom in">+</button></span></div>' +
    '<div class="reader">' +
    '<div class="pdf-pane" id="pdf-pane"><p class="pdf-wait">Opening the paper…</p></div>' +
    '<aside class="beside" id="beside">' +
    '<button class="beside-bar" id="beside-bar" type="button">Concepts</button>' +
    '<div class="beside-body" id="beside-body"></div>' +
    '<button class="beside-unpin" id="beside-pin" type="button" hidden>Unpin</button>' +
    "</aside></div>";
}

function readerFailed(host, why) {
  host.innerHTML = '<p class="pdf-wait">' + esc(why) + " " +
    '<a href="' + esc(paperFile(MAIN_ID)) + '" target="_blank" rel="noopener">Open it directly</a>.</p>';
  return false;
}

/* The paper as its authors published it, served from our own copy so that what
   is inside it can be read and pointed at. Nothing is drawn over it - the
   frame is their page, and it gets the same two marks the PDF gets: under the
   pointer, and when pinned. */
async function mountWebPaper(host) {
  const frame = document.createElement("iframe");
  frame.className = "paper-frame";
  frame.setAttribute("title", "The paper");
  frame.src = paperFile(MAIN_ID);
  host.innerHTML = "";
  host.appendChild(frame);
  RD.frame = frame;

  const loaded = await new Promise((ok) => {
    frame.addEventListener("load", () => ok(true), { once: true });
    setTimeout(() => ok(false), 25000);
  });
  if (!el("pdf-pane") || RD.frame !== frame) return false;   // navigated away
  let fdoc = null;
  try { fdoc = loaded ? frame.contentDocument : null; } catch (e) { fdoc = null; }
  if (!fdoc || !fdoc.body) {
    return readerFailed(host, "The copy of the paper could not be opened here — this page needs to be served over http rather than opened as a file.");
  }
  RD.fdoc = fdoc;
  const shell = document.querySelector(".reader");
  if (shell) shell.classList.add("framed");

  /* Decoding a full-resolution PNG on the main thread is a dropped frame, and
     this article has seventy-one of them. Asking for it off-thread costs
     nothing and takes the spikes out of scrolling past a figure. Set here as
     well as at ingest, so a copy frozen before this existed gets it too. */
  fdoc.querySelectorAll("img").forEach((img) => {
    img.decoding = "async";
    if (!img.getAttribute("loading")) img.setAttribute("loading", "lazy");
  });

  /* The two marks, and nothing else. A hairline in the gutter rather than
     anything over the words, drawn with a shadow so their layout does not
     move. One pixel, and faint: the pinned block is the one you meant, so it
     is the stronger of the two, and even that stays well under their text.
     Hover is barely there - an answer to "can I click this", not a label. */
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--accent-text").trim() || "#8a6a3b";
  const style = fdoc.createElement("style");
  style.textContent =
    "[data-skim]{cursor:pointer;scroll-margin-top:70px}" +
    "[data-skim]:hover{box-shadow:-16px 0 0 -15px " + accent + "2e}" +
    "[data-skim].skim-pinned{box-shadow:-16px 0 0 -15px " + accent + "59}" +
    /* The width and height on each image are there so a deferred one still
       holds its place. Without this they are also taken as the size to draw
       it at: the width scales to the column and the height does not, and
       every figure comes out squashed. Auto gives the browser the aspect
       ratio to reserve, and the article's own CSS the size to draw. */
    "figure img[width][height]{height:auto}";
  fdoc.head.appendChild(style);

  /* The frame is laid out at the full height of the article and never scrolls
     itself, so the only scrollbar is the page's own and every rect inside is
     one offset away from the coordinates everything else works in. */
  /* Re-measuring means asking for 583 rectangles, which forces the browser to
     lay out the whole article. That is worth doing when the article's height
     actually changed and pure waste when it did not - and it was running four
     times during the first second, in the window the reader is waiting on. */
  let fittedTo = -1;
  RD.fit = () => {
    if (RD.fdoc !== fdoc || !RD.frame) return;
    const h = Math.max(400, Math.ceil(Math.max(
      fdoc.body.getBoundingClientRect().height,
      fdoc.documentElement.scrollHeight * (RD.zoom || 1))) + 40);
    if (h === fittedTo && RD.index) return;
    fittedTo = h;
    frame.style.height = h + "px";
    buildBlockIndex();          // heights just moved; the offsets did too
  };
  /* Opening the column changes the frame's WIDTH. Everything re-flows and every
     block moves, even in the rare case where the total height lands the same -
     so that path asks for a re-measure rather than letting the height decide. */
  RD.remeasure = () => { fittedTo = -1; RD.fit(); };
  RD.fit();
  // Their own scripts are still drawing after load, so the height is retaken.
  [400, 1500, 4000].forEach((ms) => setTimeout(() => RD.fit(), ms));

  /* The article's own heavy widgets, held back by ingest, run when the figure
     they draw into is approached rather than before the paper can be opened.

     Order is preserved and is the whole trick: a widget's data script needs
     the library script that came before it, so approaching any figure runs
     everything up to and including its own script. The library scripts live in
     the head, before every figure, so they are always covered.

     A new element has to be made - a script already parsed by the browser will
     not run by having its type changed - and it is put where the original sat,
     in case anything reads its position. */
  const held = [...fdoc.querySelectorAll('script[type="text/skim-deferred"]')];
  if (held.length) {
    const done = held.map(() => false);
    const runUpTo = (limit) => {
      for (let i = 0; i <= limit; i++) {
        if (done[i]) continue;
        done[i] = true;
        const old = held[i];
        const run = fdoc.createElement("script");
        run.type = old.getAttribute("data-skim-type") || "text/javascript";
        run.text = old.textContent;
        old.parentNode.insertBefore(run, old.nextSibling);
      }
      if (RD.fdoc === fdoc && RD.remeasure) setTimeout(RD.remeasure, 60);
    };
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);
        runUpTo(+e.target.dataset.skimHeld);
      });
    }, { root: null, rootMargin: "1200px 0px" });
    let watched = 0;
    held.forEach((sc, i) => {
      const fig = sc.closest("figure");
      if (!fig) return;                 // a library script: runs with the first figure
      fig.dataset.skimHeld = String(i);
      io.observe(fig);
      watched++;
    });
    /* Nothing to hang them on - or the reader never reaches one - so they run
       once the browser is idle rather than being stranded unrun. */
    if (!watched) setTimeout(() => runUpTo(held.length - 1), 2000);
  }

  /* The article does not settle and then stay settled: an image deferred until
     it is scrolled towards changes the height of everything below it when it
     arrives, and the reader would go on following a map of where the blocks
     used to be.

     The trigger is the image's own load event, not the page's height. Watching
     the height is a loop - re-fitting the frame changes the very number being
     watched, and a ResizeObserver on it re-fires forever; it took frames from
     ten milliseconds to a full second. A load event is the exact moment the
     layout changed and cannot be caused by reacting to it. Captured, because
     load does not bubble. */
  let settling = null;
  fdoc.addEventListener("load", (ev) => {
    if (!ev.target || ev.target.tagName !== "IMG") return;
    clearTimeout(settling);
    settling = setTimeout(() => { if (RD.fdoc === fdoc) RD.fit(); }, 150);
  }, true);

  /* The paper's own links still have to work. Inside a frame that is as tall
     as its content there is nothing to scroll, so a jump to one of its own
     sections would do nothing at all; it is turned into a scroll of the page
     the reader is actually looking at. A link out of the paper opens in a tab,
     because loading it into the frame would replace the paper with it. */
  fdoc.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("a[href]");
    if (a) {
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#")) {
        ev.preventDefault();
        let t = null;
        try { t = fdoc.getElementById(decodeURIComponent(href.slice(1))); } catch (e) { t = null; }
        if (t) t.scrollIntoView({ block: "start" });
      } else if (/^https?:/i.test(href)) {
        a.target = "_blank";
        a.rel = "noopener";
      }
      return;
    }
    const b = ev.target.closest && ev.target.closest("[data-skim]");
    if (b) selectBlock(b.getAttribute("data-skim"));
  });
  return true;
}

async function mountPdfPaper(host) {
  let doc;
  try {
    RD.pdfjs = await ensurePdfjs();
    doc = await RD.pdfjs.getDocument(paperFile(MAIN_ID)).promise;
  } catch (e) {
    return readerFailed(host, "The PDF could not be opened here — this page needs to be served over http rather than opened as a file.");
  }
  if (!el("pdf-pane")) { doc.destroy(); return false; }   // navigated away while loading
  RD.doc = doc;

  const byPage = {};
  regionsOf().forEach((g) => { (byPage[g.page] = byPage[g.page] || []).push(g); });

  host.innerHTML = "";
  for (let n = 1; n <= doc.numPages; n++) {
    const pg = await doc.getPage(n);
    const vp = pg.getViewport({ scale: 1 });
    const w = document.createElement("div");
    w.className = "pdf-page";
    w.id = "pdf-p" + n;
    w.style.aspectRatio = vp.width + " / " + vp.height;
    w.innerHTML = (byPage[n] || []).map((g) =>
      '<span class="rgn r-' + esc(g.kind) + '" data-rgn="' + esc(g.id) + '" style="' +
      "left:" + (g.rect[0] * 100).toFixed(3) + "%;top:" + (g.rect[1] * 100).toFixed(3) + "%;" +
      "width:" + ((g.rect[2] - g.rect[0]) * 100).toFixed(3) + "%;height:" + ((g.rect[3] - g.rect[1]) * 100).toFixed(3) + '%"></span>').join("");
    host.appendChild(w);
    RD.wraps.push({ n, pg, vp, w, drawn: false });
  }
  applyZoom();

  /* Fifteen pages drawn at once is a visible freeze, so a page draws when it
     comes near the viewport. */
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) drawPage(RD.wraps[+e.target.id.slice(5) - 1]); });
  }, { rootMargin: "800px 0px" });
  RD.wraps.forEach((e) => io.observe(e.w));
  return true;
}

/* Where you are. A PDF says which page of how many; a web paper has no pages,
   so it says which section, which is the honest equivalent and the thing the
   reader actually wanted from a page number. */
function paintCount() {
  const count = el("reader-count");
  if (!count) return;
  if (RD.kind === "web") {
    const g = RD.byId[RD.pinned || RD.live];
    count.textContent = g && g.sectionId ? "§" + g.sectionId : "";
    return;
  }
  const mid = window.innerHeight / 2;
  const on = RD.wraps.find((e) => { const r = e.w.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
  count.textContent = (on ? on.n : 1) + " / " + RD.wraps.length;
}

async function mountReader() {
  const host = el("pdf-pane");
  if (!host) return;
  RD.reading = readingMap();
  RD.kind = readerKind(MAIN_ID);
  regionsOf().forEach((g) => { RD.byId[g.id] = g; });
  paintColumn();

  const ready = RD.kind === "web" ? await mountWebPaper(host) : await mountPdfPaper(host);
  if (!ready) return;
  applyZoom();

  /* Which block the column is about: the one whose middle is nearest the
     middle of the screen. Read straight off whatever is laid out. */
  let queued = false;
  function follow() {
    queued = false;
    if (RD.pinned) { paintCount(); return; }
    const id = liveBlockId();
    if (id === RD.live) { paintCount(); return; }
    RD.live = id;
    paintCount();
    if (!RD.stack.length) paintColumn();
  }
  RD.onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(follow); } };
  window.addEventListener("scroll", RD.onScroll, { capture: true, passive: true });
  RD.onResize = () => { applyZoom(); buildBlockIndex(); if (RD.onScroll) RD.onScroll(); };
  window.addEventListener("resize", RD.onResize);

  const input = el("find");
  if (input) {
    let t = null;
    input.addEventListener("input", () => { clearTimeout(t); t = setTimeout(paintFind, 110); });
    input.addEventListener("focus", paintFind);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { input.value = ""; closeFind(); input.blur(); }
      if (ev.key === "Enter") {
        const first = document.querySelector("#find-results [data-goto]");
        if (first) gotoBlock(first.getAttribute("data-goto"));
      }
    });
  }
  if (RD.startAt) {
    const jump = () => {
      const t = RD.kind === "web" ? blockNode(RD.startAt) : el("pdf-p" + (parseInt(RD.startAt, 10) || 1));
      if (t) t.scrollIntoView(RD.kind === "web" ? { block: "start" } : undefined);
    };
    jump();
    if (RD.kind === "web") {
      /* The paper's own scripts are still drawing, and every figure that
         finishes moves everything below it. So the jump is retaken until the
         article settles - and abandoned the moment the reader takes over,
         because yanking the page out from under someone is worse than
         landing a screen off. */
      let taken = false;
      const stop = () => { taken = true; };
      ["wheel", "touchstart", "keydown"].forEach((e) =>
        window.addEventListener(e, stop, { once: true, passive: true }));
      [700, 1800, 4200].forEach((ms) => setTimeout(() => { if (!taken) jump(); }, ms));
    }
  }
  follow();
}

/* ---------- reader events ---------- */

document.addEventListener("click", (ev) => {
  const t = ev.target;
  if (!t.closest) return;

  if (!t.closest(".find-wrap")) closeFind();
  const hit = t.closest("[data-goto]");
  if (hit) { gotoBlock(hit.getAttribute("data-goto")); return; }
  if (t.closest("#col-back")) { popColumn(); return; }
  if (t.id === "zoom-in") { applyZoom(1); return; }
  if (t.id === "zoom-out") { applyZoom(-1); return; }
  if (t.id === "beside-pin") {
    RD.pinned = null;
    clearPinned();
    paintColumn();
    return;
  }
  if (t.id === "beside-bar") { const b = el("beside"); if (b) b.classList.toggle("open"); return; }

  /* A link inside the column stays inside the column. The one marked as the
     way out is the only one that navigates. */
  const a = t.closest("#beside-body a[href^='#/']");
  if (a && !a.classList.contains("col-out-link")) {
    const m = a.getAttribute("href").match(/^#\/(concept|figure|theme)\/([^#]+)$/);
    if (m) { ev.preventDefault(); pushColumn(m[1] === "figure" ? "item" : m[1], decodeURIComponent(m[2])); return; }
  }
  const row = t.closest("#beside-body [data-open]");
  if (row) {
    const [kind, id] = row.getAttribute("data-open").split(":");
    pushColumn(kind, id);
    return;
  }

  const rgn = t.closest("[data-rgn]");
  if (rgn) selectBlock(rgn.getAttribute("data-rgn"));
});

document.addEventListener("keydown", (ev) => {
  if (!document.body.classList.contains("reader-mode")) return;
  if (ev.key === "Escape") {
    const box = el("find-results");
    if (box && !box.hidden) { closeFind(); return; }
    if (RD.stack.length) { popColumn(); return; }
  }
  if (ev.target.closest && ev.target.closest("input, textarea")) return;
  if (ev.key === "+" || ev.key === "=") applyZoom(1);
  else if (ev.key === "-") applyZoom(-1);
});

/* ---------- router ---------- */
const ROUTES = [
  [/^#?\/?$/, () => vNarrative()],
  [/^#\/insights$/, () => (narData("insights") ? renderNarrativeNode(rootNodeOf("insights")) : notFound("insights"))],
  [/^#\/summary(?:#.*)?$/, () => vSummary()],
  [/^#\/n\/([^#]+)(?:#.*)?$/, (m) => vNarrativeNode(m[1])],
  [/^#\/concept\/(.+)$/, (m) => vConcept(m[1])],
  [/^#\/theme\/(.+)$/, (m) => vTheme(m[1])],
  [/^#\/figure\/(.+)$/, (m) => vFigure(m[1])],
  [/^#\/figures$/, () => vFigures()],
  [/^#\/map$/, () => vMap()],
  [/^#\/edges$/, () => vEdges()],
  [/^#\/papers$/, () => vPapers()],
  // Where in the paper to open at: a page number, or - for a paper published
  // as a web page, which has none - the id of a block in the copy.
  [/^#\/pdf(?:\/([\w.%-]+))?$/, (m) => vReader(m[1])],
  [/^#\/relations$/, () => vRelations()],
  [/^#\/paper\/(.+)$/, (m) => vPaper(m[1])],
];

/* The one page whose links leave the paper. Everything else in an explainer is
   written as though its paper were the only one here, so this is where a
   reader finds out how it sits among its neighbours - and the only place a
   [[link]] may point into another paper's concepts. */
function vRelations() {
  const pg = pageFor(MAIN_ID);
  const meta = REG[MAIN_ID] || {};
  if (!pg) return '<p class="eyebrow">Relations</p><h1>How this relates to other papers</h1><div class="placeholder">Not written yet for ' + esc(meta.title || MAIN_ID) + ".</div>";
  let h = '<p class="eyebrow">Relations</p><h1>How this relates to other papers</h1>';
  h += '<p class="lede">Every other page here is written as if ' + esc(meta.title || MAIN_ID) +
    " were the only paper in the project. This is the one place that looks outward.</p>";
  h += md(pg.body, "relations");
  h += sourceCite(pg.sources);
  return h;
}

function render() {
  const full = decodeURIComponent(location.hash || "#/");
  const cut = full.indexOf("#", 1);                 // second "#" starts the anchor
  const route = cut > 0 ? full.slice(0, cut) : full;
  const anchor = cut > 0 ? full.slice(cut + 1) : null;
  const content = el("content");
  readerTeardown();
  const isReader = /^#\/pdf(\/|$)/.test(route);
  document.body.classList.toggle("reader-mode", isReader);
  let html = null;
  for (const [re, fn] of ROUTES) { const m = route.match(re); if (m) { html = fn(m); break; } }
  content.innerHTML = html == null ? notFound(route) : html;
  if (isReader && el("pdf-pane")) mountReader();
  mountMath(content);
  markActiveNav(full, route);
  paintNavContext(route);
  el("sidebar").classList.remove("open");
  const target = anchor ? document.getElementById(anchor) : null;
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

function markActiveNav(full, route) {
  document.querySelectorAll("#sidebar a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === full || href === route);
  });
}

/* Inside a narrative node, the sidebar grows a local table of contents. */
function paintNavContext(route) {
  const box = el("nav-context");
  if (!box) return;
  const m = route.match(/^#\/n\/(.+)$/);
  const node = m ? narNode(m[1]) : null;
  if (!node) { box.innerHTML = ""; return; }
  const path = narPath(node);
  box.innerHTML = '<p class="nav-label">In this chapter</p><ul class="nav-list">' +
    path.slice(1, -1).map((n) => navRow("#/n/" + n.id, "↑", n.title, "sub up")).join("") +
    node.chapters.map((c, i) => navRow("#/n/" + node.id + "#ch-" + c.id, c.number || String(i + 1), c.title)).join("") +
    "</ul>";
}

/* ---------- sidebar ---------- */
/* One line per chapter, numbered, clipped to the width of the rail. Anything
   that is not the chapter you are reading folds away. */
function navRow(href, num, title, cls) {
  return '<li><a class="' + (cls || "sub") + '" href="' + esc(href) + '">' +
    (num ? '<span class="n">' + esc(num) + "</span>" : "") +
    '<span class="t">' + esc(title) + "</span></a></li>";
}

function buildNav() {
  const p = mainPaper();
  const meta = REG[MAIN_ID] || {};
  let h = '<a class="site-link" href="index.html">All papers</a>';
  h += '<p class="brand"><a href="#/">' + esc(meta.title || MAIN_ID) + "</a></p>";
  h += '<input id="search" type="search" placeholder="Find a concept…" autocomplete="off"><ul id="search-results"></ul>';

  /* A destination, not a section. THE STORY / INSIGHTS / THEMES are headings
     over groups; this opens one page and has nothing under it, so it is a
     single target with the rail's own hover and active states rather than a
     label that happens to be clickable. */
  if (p.summary) {
    h += '<a class="nav-jump" href="#/summary">' +
      '<span class="nav-jump-name">Summary</span>' +
      '<span class="nav-jump-note">The whole argument, in one sitting</span></a>';
  }

  const main = p.narrative;
  if (main) {
    h += '<p class="nav-label"><a href="#/">The story</a></p><ul class="nav-list">';
    (main.chapters || []).forEach((c, i) => {
      h += navRow(c.childId ? "#/n/" + c.childId : "#/#ch-" + c.id, c.number || String(i + 1), c.title);
    });
    h += "</ul>";
  }
  h += '<div id="nav-context"></div>';

  const ins = p.insights;
  if (ins) {
    h += '<details class="nav-fold"><summary>Insights</summary><ul class="nav-list">';
    h += navRow("#/insights", "", "The second read, whole", "sub lead");
    (ins.chapters || []).forEach((c, i) => {
      h += navRow(c.childId ? "#/n/" + c.childId : "#/insights#ch-" + c.id, c.number || String(i + 1), c.title);
    });
    h += "</ul></details>";
  }

  const themes = (p.themes || []).filter((t) => t.kind === "concept-theme");
  if (themes.length) {
    h += '<details class="nav-fold"><summary>Themes</summary><ul class="nav-list">' +
      themes.map((t) => navRow("#/theme/" + t.id, "", t.name)).join("") + "</ul></details>";
  }

  h += '<nav class="nav-foot">';
  if ((p.regions || []).length) h += '<a href="#/pdf">The paper</a>';
  h += '<a href="#/figures">Figures</a><a href="#/map">Concepts</a><a href="#/edges">Connections</a>';
  if (pageFor(MAIN_ID)) h += '<a href="#/relations">Relations</a>';
  h += '<a href="#/papers">Papers</a></nav>';
  h += '<button id="theme-toggle" type="button"></button>';
  el("sidebar").innerHTML = h;

  el("search").addEventListener("input", onSearch);
  el("theme-toggle").addEventListener("click", cycleTheme);
  paintThemeLabel();
}

function onSearch(ev) {
  const q = ev.target.value.trim().toLowerCase();
  const out = el("search-results");
  if (!q) { out.innerHTML = ""; return; }
  const hits = [];
  for (const id in INDEX) {
    const t = INDEX[id];
    if (t.kind === "paper") continue;
    const name = displayName(t);
    const hay = (name + " " + (t.obj.summary || t.obj.caption || "")).toLowerCase();
    if (hay.includes(q)) hits.push({ id, t, name, rank: name.toLowerCase().startsWith(q) ? 0 : 1 });
    if (hits.length > 60) break;
  }
  hits.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length);
  out.innerHTML = hits.slice(0, 10).map((h) =>
    '<li><a href="#/' + routeFor(h.t) + '">' + esc(h.name) + '<span class="kind">' + h.t.kind + "</span></a></li>").join("");
}

/* ---------- theme toggle (system -> light -> dark), shared with the library ---------- */
function cycleTheme() { SkimTheme.cycle(); paintThemeLabel(); }
function paintThemeLabel() {
  const btn = el("theme-toggle");
  if (btn) btn.textContent = SkimTheme.label();
}

/* ---------- popover ---------- */
let popTimer = null;
function setupPopover() {
  const pop = el("popover");
  document.addEventListener("mouseover", (ev) => {
    const a = ev.target.closest && ev.target.closest("a.term[data-id]");
    if (!a) return;
    clearTimeout(popTimer);
    popTimer = setTimeout(() => {
      const t = INDEX[a.dataset.id];
      if (!t) return;
      const summary = t.obj.summary || t.obj.takeaway || t.obj.caption || "";
      pop.innerHTML = '<p class="pop-name">' + esc(displayName(t)) + '<span class="pop-kind">' + t.kind + "</span></p><p>" + esc(String(summary).slice(0, 220)) + "</p>";
      const r = a.getBoundingClientRect();
      pop.style.display = "block";
      const top = r.bottom + window.scrollY + 6;
      let left = r.left + window.scrollX;
      pop.style.top = top + "px";
      pop.style.left = "0px";
      const w = pop.offsetWidth;
      if (left + w > window.scrollX + document.documentElement.clientWidth - 12) left = window.scrollX + document.documentElement.clientWidth - w - 12;
      pop.style.left = Math.max(8, left) + "px";
    }, 130);
  });
  document.addEventListener("mouseout", (ev) => {
    if (ev.target.closest && ev.target.closest("a.term[data-id]")) { clearTimeout(popTimer); el("popover").style.display = "none"; }
  });
  document.addEventListener("click", () => { el("popover").style.display = "none"; });
}

/* ---------- QA hook (used by the pipeline's quality gate) ---------- */
window.SKIM_QA = function () {
  const p = mainPaper();
  const report = { missingLinks: [], majorsWithoutPage: [], itemsMissingWalkthrough: [], orphanConcepts: [], unresolvedPrereqs: [] };
  const scan = (txt, where) => {
    (String(txt || "").match(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g) || []).forEach((m) => {
      const id = m.replace(/^\[\[|\]\]$/g, "").split("|")[0].trim();
      if (!INDEX[id]) report.missingLinks.push({ id, where });
    });
  };
  (p.pages || []).forEach((pg) => scan(pg.body, "page:" + pg.id));
  ((p.narrative && p.narrative.chapters) || []).forEach((c) => scan(c.body, "narrative:" + c.id));
  Object.keys((p.narrative && p.narrative.nodes) || {}).forEach((nid) => {
    const n = p.narrative.nodes[nid];
    scan(n.intro, "narrative:" + nid);
    (n.chapters || []).forEach((c) => {
      scan(c.body, "narrative:" + nid + ":" + c.id);
      if (c.childId && !p.narrative.nodes[c.childId]) report.missingLinks.push({ id: c.childId, where: "child:" + nid });
    });
  });
  if (p.summary) {
    scan(p.summary.lede, "summary:lede");
    (p.summary.beats || []).forEach((b) => scan(b.body, "summary:" + b.id));
  }
  (p.concepts || []).forEach((c) => {
    scan(c.explanation, "concept:" + c.id);
    (c.prerequisites || []).forEach((pr) => { if (!INDEX[pr]) report.unresolvedPrereqs.push({ concept: c.id, prereq: pr }); });
    if (c.tier === "major" && !pageFor(c.id)) report.majorsWithoutPage.push(c.id);
    const inTheme = (p.themes || []).some((t) => (t.members || []).includes(c.id));
    if (!inTheme && !c.floor && !c.parent) report.orphanConcepts.push(c.id);
  });
  (p.items || []).forEach((it) => {
    scan(it.walkthrough, "item:" + it.id);
    if (!it.walkthrough) report.itemsMissingWalkthrough.push(it.id);
    (it.terms || []).forEach((x) => { if (x.conceptId && !INDEX[x.conceptId]) report.missingLinks.push({ id: x.conceptId, where: "item-term:" + it.id }); });
  });
  return report;
};

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  buildNav();
  setupPopover();
  el("menu-btn").addEventListener("click", () => el("sidebar").classList.toggle("open"));
  window.addEventListener("hashchange", render);
  render();
});
