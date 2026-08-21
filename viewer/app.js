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
/* Every surface links back to the page of the PDF it was drawn from. */
function pdfHref(paperId, page) {
  return "../papers/" + paperId + "/paper.pdf" + (page ? "#page=" + page : "");
}

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
      '<a class="source-link" href="' + esc(pdfHref(paperId)) + '" target="_blank" rel="noopener">' + esc(owner.title || paperId) + "</a>" +
      (src.note ? '<span class="source-note">' + esc(src.note) + "</span>" : "") + "</p>";
  }

  const secs = src.sections || [];
  const pages = src.pages || [];
  if (!secs.length && !pages.length) return "";

  const cap = o.small ? 3 : 5;
  let bits = secs.slice(0, cap).map((x) =>
    '<a class="source-link" href="' + esc(pdfHref(paperId, x.start)) + '" target="_blank" rel="noopener">' +
    "§" + esc(x.id) + " " + esc(x.title) +
    '<span class="source-pg">p' + x.start + (x.end > x.start ? "–" + x.end : "") + "</span></a>");
  if (secs.length > cap) bits.push('<span class="source-more">+' + (secs.length - cap) + " more</span>");
  if (!secs.length && pages.length) {
    bits = pages.slice(0, 6).map((n) =>
      '<a class="source-link" href="' + esc(pdfHref(paperId, n)) + '" target="_blank" rel="noopener">page ' + n + "</a>");
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
      h += 'The other way through is <a href="' + other.href + '">' + esc((narData(other.key) || {}).title || other.label) + "</a>.";
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
    h += '<p class="fig-note">Cropped as-is from <a href="' + esc(pdfHref(t.paperId, it.page)) +
      '" target="_blank" rel="noopener">page ' + esc(it.page) + "</a> of the PDF.</p>";
  }
  if (it.kind === "equation" && it.latex) h += '<div class="figure-wrap"><span class="math-pending math-block">$$' + esc(it.latex) + "$$</span></div>";
  if (!it.asset) h += sourceCite(it.sources);
  if (it.caption) h += "<blockquote><p>" + esc(it.caption) + "</p></blockquote>";
  if (it.takeaway) h += '<div class="callout"><p class="eyebrow">Takeaway</p>' + md(it.takeaway, "item:" + id) + "</div>";
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

/* ---------- router ---------- */
const ROUTES = [
  [/^#?\/?$/, () => vNarrative()],
  [/^#\/insights$/, () => (narData("insights") ? renderNarrativeNode(rootNodeOf("insights")) : notFound("insights"))],
  [/^#\/n\/([^#]+)(?:#.*)?$/, (m) => vNarrativeNode(m[1])],
  [/^#\/concept\/(.+)$/, (m) => vConcept(m[1])],
  [/^#\/theme\/(.+)$/, (m) => vTheme(m[1])],
  [/^#\/figure\/(.+)$/, (m) => vFigure(m[1])],
  [/^#\/figures$/, () => vFigures()],
  [/^#\/map$/, () => vMap()],
  [/^#\/edges$/, () => vEdges()],
  [/^#\/papers$/, () => vPapers()],
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
  let html = null;
  for (const [re, fn] of ROUTES) { const m = route.match(re); if (m) { html = fn(m); break; } }
  content.innerHTML = html == null ? notFound(route) : html;
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
    h += '<details class="nav-fold"><summary>Insights<span class="fold-n">' +
      (ins.chapters || []).length + "</span></summary><ul class=\"nav-list\">";
    h += navRow("#/insights", "", "The second read, whole", "sub lead");
    (ins.chapters || []).forEach((c, i) => {
      h += navRow(c.childId ? "#/n/" + c.childId : "#/insights#ch-" + c.id, c.number || String(i + 1), c.title);
    });
    h += "</ul></details>";
  }

  const themes = (p.themes || []).filter((t) => t.kind === "concept-theme");
  if (themes.length) {
    h += '<details class="nav-fold"><summary>Themes<span class="fold-n">' + themes.length +
      "</span></summary><ul class=\"nav-list\">" +
      themes.map((t) => navRow("#/theme/" + t.id, "", t.name)).join("") + "</ul></details>";
  }

  h += '<nav class="nav-foot">';
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
