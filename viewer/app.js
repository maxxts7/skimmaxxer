/* Skimmaxxer viewer. Static SPA over generated JSON bundles:
   window.SKIM_REGISTER (register.js) + window.SKIM_PAPERS[id] (per-paper bundle.js). */
"use strict";

const REG = (window.SKIM_REGISTER && SKIM_REGISTER.papers) || {};
/* The same object the bundles write into, not a copy of it - a paper fetched
   later adds itself here by loading. */
window.SKIM_PAPERS = window.SKIM_PAPERS || {};
const PAPERS = window.SKIM_PAPERS;
/* Which paper this shell is about. Each entry point sets window.SKIM_MAIN before
   loading this file; the fallback is only for a single-paper project, where
   picking the first full read is unambiguous. */
const MAIN_ID = (window.SKIM_MAIN && REG[window.SKIM_MAIN]) ? window.SKIM_MAIN
  : (Object.keys(REG).find((id) => REG[id].status === "full") || Object.keys(REG)[0]);
const QA = { missingLinks: [] };

/* ---------- index: id -> {kind, paperId, obj} ---------- */
/* A shell used to load all thirty bundles so that a link into another paper
   could open in place. That cost 3.4MB to read one paper of 286KB, and all of
   it before anything could be drawn. It now loads the paper it is about, and
   seeds every other paper's ids from links.js as stubs: the name to print, the
   kind, the paper that owns it, and the summary, which is what search matches
   and the hover card shows. Following such a link fetches that paper and the
   stub becomes the real thing. */
const LINKS = (window.SKIM_LINKS && SKIM_LINKS.ids) || {};
const LINK_COUNTS = (window.SKIM_LINKS && SKIM_LINKS.counts) || {};
const LINK_SHARED = (window.SKIM_LINKS && SKIM_LINKS.shared) || {};
const KINDS = ["concept", "item", "theme"];
const INDEX = {};

Object.keys(LINKS).forEach((id) => {
  const row = LINKS[id];
  /* title carries the name too, so itemLabel() reads a stub the way it reads a
     figure - it falls back on title when there is no printed number, and a
     stub has none. */
  INDEX[id] = { kind: KINDS[row[0]], paperId: row[1], stub: true,
                obj: { id: id, name: row[2], title: row[2], summary: row[3] } };
});

function indexPaper(pid) {
  const p = PAPERS[pid];
  if (!p) return;
  /* The paper this shell is about owns any id it uses, exactly as it did when
     it was indexed first. Any other paper fills in only what is still a stub
     of its own: two papers can carry the same id, and which of them gets it is
     settled by register order in links.js, not by what happens to load first. */
  const put = (kind, x) => {
    const held = INDEX[x.id];
    if (held && pid !== MAIN_ID && !(held.stub && held.paperId === pid)) return;
    INDEX[x.id] = { kind: kind, paperId: pid, obj: x };
  };
  (p.concepts || []).forEach((c) => put("concept", c));
  (p.items || []).forEach((it) => put("item", it));
  (p.themes || []).forEach((t) => put("theme", t));
}
Object.keys(PAPERS).forEach(indexPaper);
Object.keys(REG).forEach((pid) => { INDEX[pid] = { kind: "paper", paperId: pid, obj: REG[pid] }; });

/* ---------- fetching a paper a link points into ---------- */
const PENDING = {};
function loadPaper(pid) {
  if (!pid || !REG[pid] || PAPERS[pid]) return Promise.resolve();
  if (PENDING[pid]) return PENDING[pid];
  PENDING[pid] = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "../papers/" + encodeURIComponent(pid) + "/data/js/bundle.js";
    /* A paper that will not load is not worth blocking on: the stub still
       names it, so the page draws with what the index already knew. */
    s.onerror = () => { console.warn("could not load " + pid); resolve(); };
    s.onload = () => { indexPaper(pid); resolve(); };
    document.head.appendChild(s);
  });
  return PENDING[pid];
}

/* Which paper a route cannot be drawn without. Everything not named here reads
   the main paper alone. */
function paperForRoute(route) {
  let m = route.match(/^#\/(?:concept|figure|theme)\/(.+)$/);
  if (m) { const t = INDEX[decodeURIComponent(m[1])]; return t && t.stub ? t.paperId : null; }
  m = route.match(/^#\/paper\/(.+)$/);
  if (m) { const pid = decodeURIComponent(m[1]); return PAPERS[pid] ? null : pid; }
  return null;
}

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

/* ---------- images ---------- */
/* Every crop the app draws goes through here, for one reason: a request that
   fails once must not stay failed. Nothing is wrong with the paths - every
   asset named in every items.json resolves to a file - so a figure that does
   not arrive has lost a single fetch, and a reader was fixing it by hand by
   reloading the whole page. One delegated listener does that for them, once,
   and then gives up rather than hammering. */
const assetSrc = (pid, asset) => "../papers/" + encodeURI(pid + "/" + asset);

function figImg(pid, asset, alt, lazy) {
  return '<img src="' + esc(assetSrc(pid, asset)) + '"' + (lazy ? ' loading="lazy"' : "") +
    ' decoding="async" alt="' + esc(alt || "") + '">';
}

/* On its own page the plate is as wide as the page allows, and a tall figure
   has to give that width back rather than be squashed. A browser will not do
   that for a picture whose width is set, so the picture's own proportions are
   handed to the sheet as a number and the width becomes whichever of the two
   limits - the width of the page or the height of the window - binds first. */
function figRatio(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;
  const plate = img.closest && img.closest(".figure-closeup");
  if (plate) plate.style.setProperty("--fig-ar", (img.naturalWidth / img.naturalHeight).toFixed(4));
}

/* Load failures do not bubble, so this listens on the way down. */
document.addEventListener("load", (ev) => {
  if (ev.target && ev.target.tagName === "IMG") figRatio(ev.target);
}, true);

document.addEventListener("error", (ev) => {
  const img = ev.target;
  if (!img || img.tagName !== "IMG" || img.dataset.retried) return;
  img.dataset.retried = "1";
  const base = img.src.split("#")[0].split("?")[0];
  setTimeout(() => { img.src = base + "?r=1"; }, 400);
}, true);

/* Prose reduced to one plain line: markdown links carry ids a caption cannot
   render, and a caption is not the place to follow one anyway. */
function plainLine(text, cap) {
  let s = String(text || "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  cap = cap || 190;
  if (s.length > cap) s = s.slice(0, cap).replace(/\s+\S*$/, "") + "…";
  return s;
}

/* A paper named in a search hit, short enough to sit at the end of a row.
   Most titles in this field front-load the name and explain after a colon. */
function shortTitle(s) {
  let t = String(s || "");
  const colon = t.indexOf(":");
  if (colon > 2 && colon < 34) t = t.slice(0, colon);
  if (t.length > 34) t = t.slice(0, 34).replace(/\s+\S*$/, "") + "…";
  return t;
}

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

/* Where the paper itself comes from. Wherever the host that published it will
   serve it to a reader's browser, that is where the reader gets it, and this
   site holds no copy at all - the bytes go from arXiv to whoever is reading,
   and never through here. arXiv asks tools built on its full text to link back
   for downloads, so this is also what they ask for.
     What makes it possible is one header. pdf.js has to read the bytes, not
   just point at them, and that needs access-control-allow-origin from the
   host; arXiv and OpenAI's CDN both send it, so the reader works against their
   copy exactly as it did against ours. transformer-circuits.pub and metr.org
   do not, so those three stay on the copy here - listed by what they can do,
   not by who they are, because the day one of them sends the header this stops
   being a special case. */
const STREAMABLE = /^https?:\/\/(arxiv\.org|cdn\.openai\.com)\//;
function streamUrl(paperId) {
  const src = ((REG[paperId] || {}).source || "").trim();
  if (!STREAMABLE.test(src)) return null;
  /* An abstract page is where a paper is cited from; the file beside it is
     what the reader opens. A version suffix is dropped so a citation follows
     the paper rather than the revision it was read at. */
  const abs = /^https?:\/\/arxiv\.org\/abs\/(.+?)(?:v\d+)?$/.exec(src);
  if (abs) return "https://arxiv.org/pdf/" + abs[1];
  return /\.pdf$/i.test(src) ? src : null;
}

const paperFile = (paperId) =>
  streamUrl(paperId) ||
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

/* A summary cut to length by counting characters stops wherever the count runs
   out, which is usually the middle of a word. Back up to the last space and
   say out loud that there is more. */
function clip(s, n) {
  s = String(s || "").trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—-]+$/, "") + "…";
}

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

/* ---------- the story, one level of zoom at a time ---------- */
/* The node bodies are most of a paper's prose and almost none of what a reader
   opens, so they travel in their own file per level rather than in the bundle.
   What the bundle keeps is narrative.index: level, parent, title, number,
   chapter count and how many levels open below. That is enough to draw every
   page that only *mentions* a node - the crumb trail, the zoom card, the note
   about how far down it goes - so a level is fetched only when it is opened. */
window.SKIM_STORY = window.SKIM_STORY || {};
const STORY = window.SKIM_STORY;
const storyBodies = () => STORY[MAIN_ID] || {};
const storyIndex = () => (narData("main") || {}).index || {};

/* A node named by the index but not yet fetched: enough to link to and to
   describe, with no chapters in it because the chapters are the part that has
   not arrived. Anything that renders a node's prose goes through the router,
   which fetches the level first. */
function lightNode(id, e) {
  return { id: id, narKey: "main", light: true, depth: e.d, parentId: e.p,
           title: e.t, number: e.n, chapterCount: e.c, chapters: [] };
}

function narNode(id) {
  if (!id) return null;
  for (const spec of NARS) {
    if (id === spec.rootId) return rootNodeOf(spec.key);
    const nar = narData(spec.key);
    if (nar && nar.nodes && nar.nodes[id]) {
      return Object.assign({ narKey: spec.key }, nar.nodes[id]);
    }
  }
  const body = storyBodies()[id];
  if (body) return Object.assign({ narKey: "main" }, body);
  const e = storyIndex()[id];
  return e ? lightNode(id, e) : null;
}

/* Fetch the level a node sits on, if this shell has not got it yet. */
const STORY_PENDING = {};
function loadStoryLevel(depth) {
  if (!depth || STORY_PENDING[depth]) return STORY_PENDING[depth] || Promise.resolve();
  STORY_PENDING[depth] = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "../papers/" + encodeURIComponent(MAIN_ID) + "/data/js/story-" + depth + ".js";
    s.onerror = () => { console.warn("could not load story level " + depth); resolve(); };
    s.onload = resolve;
    document.head.appendChild(s);
  });
  return STORY_PENDING[depth];
}

/* Which level a route needs before it can be drawn. */
function storyLevelForRoute(route) {
  const m = route.match(/^#\/n\/([^#]+)$/);
  if (!m) return 0;
  const id = decodeURIComponent(m[1]);
  if (storyBodies()[id]) return 0;
  const e = storyIndex()[id];
  return e ? e.d : 0;
}
const narKeyOf = (node) => node.narKey || "main";
/* A fetched node counts its own chapters; one still described by the index
   carries the count instead. */
const nChapters = (node) => (node.chapters && node.chapters.length) || node.chapterCount || 0;

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
  /* Counted when the story was split, because walking down to find out would
     mean fetching every level below - which is the reading this defers. The
     root is not in the index, and insights are not split at all, so both still
     walk; everything they walk is already here. */
  const e = storyIndex()[id];
  if (e) return e.b || 0;
  const n = narNode(id);
  if (!n || (seen || 0) > 6) return 0;
  let best = 0;
  (n.chapters || []).forEach((c) => { if (c.childId) best = Math.max(best, 1 + deepestUnder(c.childId, (seen || 0) + 1)); });
  return best;
}

function chapterSection(c, i, node) {
  const num = c.number || String(i + 1);
  /* data-at is what the switch reads: the place in the paper this chapter
     opens on, so pressing Paper from here lands where you were reading. */
  let h = '<section class="chapter" id="ch-' + esc(c.id) + '"' + atAttr(c.sources) + ">";
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
      /* chapterCount for a node whose level has not been fetched: the card says
         how much is behind it, and that is the whole point of the card. */
      '<span class="zoom-sub">' + nChapters(child) + " chapter" + (nChapters(child) === 1 ? "" : "s") +
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
  beats.forEach((b, i) => {
    h += '<section class="chapter beat" id="b-' + esc(b.id) + '"' + atAttr(b.sources) + ">";
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
    /* The narrow read of the cited paper carries this same concept id. Which
       papers share an id is recorded in links.js, so this no longer needs
       every bundle in memory to find out. */
    const rp = (LINK_SHARED[id] || []).find((pid) => pid !== MAIN_ID);
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
      '<details class="sub-concept"><summary>' + esc(k.name) + '<span class="hint">' + esc(clip(k.summary, 90)) + '</span></summary><div class="body">' +
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
    /* This section names the figures a concept shows up in and then made the
       reader go and look at each one. It leads with the picture now. */
    h += "<h2>Where you can see it</h2>" + evid.map((it) =>
      '<div class="card card-fig">' +
      (it.asset
        ? '<a class="card-fig-shot" href="#/figure/' + esc(it.id) + '">' +
          figImg(MAIN_ID, it.asset, it.caption || it.id, true) + "</a>"
        : it.latex
          /* An equation has no crop, but it has itself. Leaving the card blank
             here would be the same gap this section was fixing. */
          ? '<a class="card-fig-shot is-eq" href="#/figure/' + esc(it.id) + '">' +
            '<span class="math-pending math-block">$$' + esc(it.latex) + "$$</span></a>"
          : "") +
      '<div class="card-fig-text"><a class="title" href="#/figure/' + esc(it.id) + '">' + esc(it.title || it.id) + "</a> " +
      chip(null, it.kind + (it.number ? " " + it.number : ""), "floor") +
      '<p class="sub">' + esc(it.takeaway || it.caption || "") + "</p></div></div>").join("");
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
    /* The picture itself opens it up close. A crop off the PDF is around 1,100
       pixels wide and the column prints it at 700, so a tick label or a cell of
       a table is already smaller here than it was on the page it came from -
       and the reader who wants it bigger has nowhere to go but the PDF. It is a
       button rather than a div with a handler, so the keyboard gets there too,
       and it carries a corner mark because a picture that does something has to
       look like it does something. */
    h += '<button type="button" class="figure-wrap figure-closeup" data-closeup="' + esc(id) +
      '" aria-label="Open this picture up close"><span class="figure-closeup-mark" aria-hidden="true">⤢</span>' +
      figImg(t.paperId, it.asset, it.caption || it.id, false) + "</button>";
    h += '<p class="fig-note">' + (it.page
      ? 'Cropped as-is from <a href="' + esc(pdfHref(t.paperId, it.page)) + '"' + pdfAttrs(t.paperId) +
        ">page " + esc(it.page) + "</a> of the PDF."
      : it.assetCaptured
        ? 'A still captured from <a href="' + esc(pdfHref(t.paperId, it.anchor)) + '"' +
          pdfAttrs(t.paperId) + ">where it sits in the paper</a>: the article draws this figure in the browser, so there is no image file to take."
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

/* ---------- figures in the prose ---------- */
/* The prose already says which figure a paragraph is about - 136 times in the
   story of 1706.03762 alone, and 137 times across its concept pages - and then
   made the reader go and look it up. A link to a figure now brings the figure
   with it: the paragraph reads through exactly as written, and the crop follows
   underneath.

   Three rules keep it prose with pictures in it rather than a slide deck.

   Once per chapter. table-3 is linked 28 times in one story, and a reader does
   not need it 28 times; the scope is the <section class="chapter"> the link
   sits in, or the whole page where there are no chapters.

   Capped at 420px tall. A paper prints figures from a 200px table to a
   full-page architecture diagram, and an uncapped crop pushes the next
   paragraph off the screen. Anything taller is scaled down and says so; the
   click opens it at full size.

   The sentence is untouched. The link stays a link - hoverable, navigable -
   and the picture is a block after the paragraph, not a change to the prose. */

/* Places a link is a reference rather than a mention: term tables, chip rows,
   the reading column, cards, and inside a block already placed here. */
const INLINE_SKIP = ".fig-inline, .kv, .chips, .beside-c, .edge-row, .contents, .card, blockquote";

/* An equation is routinely printed by the prose itself - "With those shapes
   fixed, Equation (1) is:" and then the formula. Our own copy above the
   authored one shows the same maths twice in a row. placeFigures runs before
   mountMath, so the authored maths is still its raw $$ source and can simply
   be compared against. */
const tex = (s) => String(s || "").replace(/[\s{}]/g, "");
function mathAlreadyShown(scope, latex) {
  const want = tex(latex);
  if (!want) return false;
  return Array.from(scope.querySelectorAll(".math-pending")).some((n) => tex(n.textContent).includes(want));
}

function figBlock(t) {
  const it = t.obj;
  let media = "";
  if (it.asset) media = figImg(t.paperId, it.asset, it.caption || it.id, true);
  else if (it.kind === "equation" && it.latex) media = '<span class="math-pending math-block">$$' + esc(it.latex) + "$$</span>";
  else return "";
  const label = itemLabel(it);
  /* An item with no printed number is labelled by its title, so printing the
     title after it says the same thing twice. */
  const title = it.title && it.title !== label ? it.title : "";
  return '<figure class="fig-inline' + (it.asset ? "" : " is-eq") + '" data-fig="' + esc(it.id) +
    '" tabindex="0" role="button" aria-label="Open ' + esc(label) + '">' +
    '<div class="fig-inline-media">' + media + "</div><figcaption>" +
    '<span class="fig-inline-label">' + esc(label) + "</span>" +
    (title ? '<span class="fig-inline-title">' + esc(title) + "</span>" : "") +
    (it.takeaway ? '<span class="fig-inline-take">' + esc(plainLine(it.takeaway)) + "</span>" : "") +
    "</figcaption></figure>";
}

/* Two blocks of prose have to survive between one figure and the next. A
   figure-dense paper otherwise turns a chapter into a slide deck: the story of
   `monosemanticity`, which prints 72 figures, put six into a chapter of eight
   paragraphs before this rule, against a worst case of five in nineteen for
   `1706.03762`. The gap is what makes it prose with pictures rather than
   captions with prose between them, and a link that loses its picture to it is
   still a link. */
function gapOk(prevFig, block) {
  if (!prevFig) return true;
  /* A paragraph that names two figures would put the second one in front of
     the first, since both insert directly after the same block. That is the
     one case where the next candidate does not follow the last figure, and it
     is the case that produced two pictures back to back. */
  if (!(prevFig.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
  let n = 0;
  for (let node = prevFig.nextElementSibling; node && node !== block; node = node.nextElementSibling) n++;
  return n >= 2;
}

function placeFigures(root, skipId) {
  if (!root) return;
  const scopes = new Map();
  /* Captured before anything is inserted, so the walk cannot trip over its own
     output - and figBlock emits no term links, so there is none to trip on. */
  Array.from(root.querySelectorAll("a.term[data-id]")).forEach((a) => {
    const t = INDEX[a.dataset.id];
    if (!t || t.kind !== "item") return;
    if (a.closest(INLINE_SKIP)) return;
    const scope = a.closest("section.chapter") || root;
    let st = scopes.get(scope);
    if (!st) { st = { placed: new Set(skipId ? [skipId] : []), last: null }; scopes.set(scope, st); }
    if (st.placed.has(t.obj.id)) return;
    if (!t.obj.asset && t.obj.latex && mathAlreadyShown(scope, t.obj.latex)) return;
    const html = figBlock(t);
    if (!html) return;
    /* Under the whole block the link sits in, not inside it: a figure cannot
       go in the middle of a sentence, or inside the list item that named it. */
    let block = a;
    while (block.parentElement && block.parentElement !== scope) block = block.parentElement;
    if (block.parentElement !== scope) return;
    if (!gapOk(st.last, block)) return;
    st.placed.add(t.obj.id);
    block.insertAdjacentHTML("afterend", html);
    st.last = block.nextElementSibling;
  });
}

/* The story and the concept pages. Not the summary, which carries the argument
   without the evidence apparatus and links no figures anyway; not the themes,
   the map or the indexes, which are lists rather than prose. */
const INLINE_ROUTES = /^#\/?$|^#\/n\/|^#\/insights$|^#\/concept\//;

function vFigures() {
  const items = mainPaper().items || [];
  let h = '<p class="eyebrow">Self-sufficient figures</p><h1>Figures, tables & equations</h1><p class="lede">Each one is meant to be understandable on its own — every term and number in it defined.</p>';
  [["figure", "Figures"], ["table", "Tables"], ["equation", "Equations"]].forEach(([k, label]) => {
    const group = items.filter((i) => i.kind === k);
    if (!group.length) return;
    h += "<h2>" + label + "</h2><div class=\"card-grid\">" + group.map((it) =>
      '<div class="card">' + (it.asset ? '<a class="card-shot" href="#/figure/' + esc(it.id) + '">' + figImg(MAIN_ID, it.asset, "", true) + "</a>" : "") +
      '<a class="title" href="#/figure/' + esc(it.id) + '">' + esc(it.title || (it.caption || it.id).split(":")[0]) + '</a><p class="sub">' + esc(clip(it.takeaway || it.caption, 140)) + "</p></div>").join("") + "</div>";
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
    /* Counted at build time, so the register lists every paper's tally without
       this page having to hold every paper. */
    const n = LINK_COUNTS[pid] != null ? LINK_COUNTS[pid] : conceptsOf(pid).length;
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

/* ---------- a figure opened over the article ---------- */
/* The whole figure page, not a lightbox of the image: the caption, the
   takeaway, every term in it defined and every number explained. A reader who
   stops at a figure has a question, and the answer is the page rather than a
   bigger picture.

   It is vFigure() verbatim, the way the reading column already opens one, so
   there is no second version of a figure page to keep in step. The article
   stays behind it and the paragraph that raised the question is still there
   when it closes. */
function openFigPop(id) {
  const t = INDEX[id];
  if (!t || t.kind !== "item") return;
  const wrap = el("figpop"), box = el("figpop-body");
  /* A figure in another paper is a stub until that paper is fetched, and the
     fetch belongs to the router - so send it there rather than open a card
     over the article with nothing in it. */
  if (!wrap || !box || t.stub) { location.hash = "#/figure/" + id; return; }
  box.innerHTML = vFigure(id) +
    '<p class="col-out"><a class="col-out-link" href="#/figure/' + esc(id) + '">Open this on the full site →</a></p>';
  mountMath(box);
  wrap.hidden = false;
  document.body.classList.add("figpop-open");
  box.scrollTop = 0;
  const c = wrap.querySelector(".figpop-close");
  if (c) c.focus();
}

/* ---------- which read to open ---------- */
/* The rail's ? holds the four readings up together, which is the shape the
   question actually has: a reader is choosing between them, not asking about
   one. The card itself is in read.html - it is prose about the site and the
   same on every paper, so nothing here builds it. */
function openHelp() {
  const wrap = el("helppop");
  if (!wrap) return;
  wrap.hidden = false;
  document.body.classList.add("helppop-open");
  const body = wrap.querySelector(".helppop-body");
  if (body) body.scrollTop = 0;
  const c = wrap.querySelector(".figpop-close");
  if (c) c.focus();
}

/* Focus goes back to the button that opened it, or a keyboard is left standing
   at the top of the document with the card gone. */
function closeHelp() {
  const wrap = el("helppop");
  if (!wrap || wrap.hidden) return;
  wrap.hidden = true;
  document.body.classList.remove("helppop-open");
  const btn = el("help-btn");
  if (btn) btn.focus();
}

function setupHelp() {
  const btn = el("help-btn");
  if (!btn) return;
  btn.addEventListener("click", openHelp);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest && ev.target.closest("[data-help-close]")) closeHelp();
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeHelp(); });
}

function closeFigPop() {
  const wrap = el("figpop");
  if (!wrap || wrap.hidden) return;
  wrap.hidden = true;
  document.body.classList.remove("figpop-open");
  el("figpop-body").innerHTML = "";
}

function setupFigPop() {
  document.addEventListener("click", (ev) => {
    if (ev.target.closest && ev.target.closest("#figpop [data-close]")) { closeFigPop(); return; }
    const fig = ev.target.closest && ev.target.closest(".fig-inline");
    if (!fig) return;
    ev.preventDefault();
    /* Inside the reading column a figure belongs in the column's own stack -
       a modal over the reader would cover the paper the reader is reading. */
    if (fig.closest(".col-body")) pushColumn("item", fig.dataset.fig);
    else openFigPop(fig.dataset.fig);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeFigPop();
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("fig-inline")) {
      ev.preventDefault();
      ev.target.click();
    }
  });
}

/* ---------- a figure held up close ---------- */
/* The figure page explains the picture; this is for looking at it. It opens
   from the picture on that page - wherever that page is drawn, on the site, in
   the popup over the article, or in the column beside the paper - and holds
   nothing but the crop.

   Fit is 100%: what a reader means by "the whole thing" is the whole thing on
   their screen, not the pixel count of a crop they never see. From there it
   goes to 4x. The detail runs out well before that - these crops carry about
   half again what the column shows - and past that point the browser is
   smoothing rather than revealing, which is still the difference between a
   number you can read and one you cannot. The full-resolution original is the
   PDF, and the line under the picture already says which page it is on.

   Wheel, pinch, drag, double-click, +/-/0 and the arrow keys all do what they
   do everywhere else. The buttons are there because none of that announces
   itself, and they are the reader's zoom control from the rail, unchanged. */

const CU = { scale: 1, x: 0, y: 0, pts: new Map(), pinch: null, moved: 0, opener: null };
const CU_MIN = 1, CU_MAX = 4, CU_STEP = 1.4;

const cuOpen = () => { const w = el("closeup"); return !!w && !w.hidden; };

function openCloseup(id) {
  const t = INDEX[id];
  if (!t || t.kind !== "item" || !t.obj.asset) return;
  const wrap = el("closeup"), img = el("closeup-img");
  if (!wrap || !img) return;
  const src = assetSrc(t.paperId, t.obj.asset);
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
  img.alt = t.obj.caption || t.obj.id;
  wrap.hidden = false;
  document.body.classList.add("closeup-open");
  CU.scale = CU_MIN; CU.x = 0; CU.y = 0; CU.pts.clear(); CU.pinch = null;
  cuApply();
  const c = wrap.querySelector(".closeup-close");
  if (c) c.focus();
}

function closeCloseup() {
  const wrap = el("closeup");
  if (!wrap || wrap.hidden) return;
  wrap.hidden = true;
  document.body.classList.remove("closeup-open");
  CU.pts.clear(); CU.pinch = null;
  /* Back to the picture it was opened from, so a keyboard has not lost its
     place - unless the page under it has been rebuilt since. */
  if (CU.opener && document.contains(CU.opener)) CU.opener.focus();
  CU.opener = null;
}

/* The picture cannot be dragged off the edge of the window: at any scale it may
   move by however much of it hangs outside the stage, and no further. Below the
   point where it overflows at all, it stays centred. */
function cuApply() {
  const stage = el("closeup-stage"), img = el("closeup-img");
  if (!stage || !img) return;
  const w = img.offsetWidth * CU.scale, h = img.offsetHeight * CU.scale;
  const mx = Math.max(0, (w - stage.clientWidth) / 2), my = Math.max(0, (h - stage.clientHeight) / 2);
  CU.x = Math.min(mx, Math.max(-mx, CU.x));
  CU.y = Math.min(my, Math.max(-my, CU.y));
  img.style.transform = "translate(" + CU.x.toFixed(1) + "px," + CU.y.toFixed(1) + "px) scale(" + CU.scale.toFixed(3) + ")";
  stage.classList.toggle("is-movable", mx > 0.5 || my > 0.5);
  const pct = el("closeup-pct");
  if (pct) pct.textContent = Math.round(CU.scale * 100) + "%";
  const zin = el("closeup-in"), zout = el("closeup-out");
  if (zin) zin.disabled = CU.scale >= CU_MAX - 0.001;
  if (zout) zout.disabled = CU.scale <= CU_MIN + 0.001;
}

/* Zoom about a point, so whatever is under the pointer stays under it - the
   one thing that separates zooming into a picture from magnifying its middle
   and hunting for the part you wanted. Given no point, it works off the centre. */
function cuZoom(to, px, py) {
  const stage = el("closeup-stage");
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  const ux = (px == null ? r.left + r.width / 2 : px) - r.left - r.width / 2;
  const uy = (py == null ? r.top + r.height / 2 : py) - r.top - r.height / 2;
  const s = Math.min(CU_MAX, Math.max(CU_MIN, to));
  CU.x = ux - (ux - CU.x) * (s / CU.scale);
  CU.y = uy - (uy - CU.y) * (s / CU.scale);
  CU.scale = s;
  if (s <= CU_MIN + 0.001) { CU.x = 0; CU.y = 0; }
  cuApply();
}

/* Two fingers: how far apart they are and where their middle is. */
function cuPinch() {
  const p = [...CU.pts.values()];
  return { dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
           mx: (p[0].x + p[1].x) / 2, my: (p[0].y + p[1].y) / 2 };
}

function setupCloseup() {
  const wrap = el("closeup");
  if (!wrap) return;
  const stage = el("closeup-stage"), img = el("closeup-img");

  document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-closeup]");
    if (!b) return;
    ev.preventDefault();
    CU.opener = b;
    openCloseup(b.getAttribute("data-closeup"));
  });

  wrap.addEventListener("click", (ev) => {
    /* A drag that ends over the backdrop is not a click on the backdrop. */
    if (Date.now() - CU.moved < 250) return;
    if (ev.target === stage || ev.target.closest("[data-cu-close]")) { closeCloseup(); return; }
    if (ev.target.closest("#closeup-in")) cuZoom(CU.scale * CU_STEP);
    else if (ev.target.closest("#closeup-out")) cuZoom(CU.scale / CU_STEP);
    else if (ev.target.closest("#closeup-reset")) cuZoom(CU_MIN);
  });

  stage.addEventListener("dblclick", (ev) => {
    cuZoom(CU.scale > CU_MIN + 0.01 ? CU_MIN : 2, ev.clientX, ev.clientY);
  });

  /* A trackpad pinch arrives as a wheel with ctrl held, and a mouse wheel that
     reports in lines rather than pixels needs a line to be worth something. */
  stage.addEventListener("wheel", (ev) => {
    ev.preventDefault();
    const px = ev.deltaMode === 1 ? ev.deltaY * 16 : ev.deltaMode === 2 ? ev.deltaY * stage.clientHeight : ev.deltaY;
    cuZoom(CU.scale * Math.exp(-px * (ev.ctrlKey ? 0.01 : 0.0022)), ev.clientX, ev.clientY);
  }, { passive: false });

  stage.addEventListener("pointerdown", (ev) => {
    if (ev.button) return;
    try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* a pointer already gone */ }
    CU.pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (CU.pts.size === 2) CU.pinch = cuPinch();
  });

  stage.addEventListener("pointermove", (ev) => {
    const p = CU.pts.get(ev.pointerId);
    if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    p.x = ev.clientX; p.y = ev.clientY;
    if (CU.pts.size >= 2) {
      const now = cuPinch();
      if (CU.pinch && CU.pinch.dist > 0) {
        /* The middle of the two fingers carries the picture with it, and the
           distance between them scales it about that same middle. */
        CU.x += now.mx - CU.pinch.mx;
        CU.y += now.my - CU.pinch.my;
        cuZoom(CU.scale * (now.dist / CU.pinch.dist), now.mx, now.my);
      }
      CU.pinch = now;
      CU.moved = Date.now();
      return;
    }
    if (CU.scale <= CU_MIN + 0.001) return;
    CU.x += dx; CU.y += dy;
    if (Math.abs(dx) + Math.abs(dy) > 2) CU.moved = Date.now();
    cuApply();
  });

  const lift = (ev) => { CU.pts.delete(ev.pointerId); if (CU.pts.size < 2) CU.pinch = null; };
  stage.addEventListener("pointerup", lift);
  stage.addEventListener("pointercancel", lift);

  /* Caught on the way down and stopped there: Escape belongs to the thing on
     top, and underneath it are a figure popup and a reading column that would
     otherwise close at the same keystroke. Same for +/-, which the reader is
     using for the size of the paper. */
  document.addEventListener("keydown", (ev) => {
    if (!cuOpen()) return;
    const step = { "+": 1, "=": 1, "-": -1, _: -1 }[ev.key];
    if (ev.key === "Escape") { ev.stopPropagation(); closeCloseup(); }
    else if (step) { ev.stopPropagation(); cuZoom(CU.scale * (step > 0 ? CU_STEP : 1 / CU_STEP)); }
    else if (ev.key === "0") { ev.stopPropagation(); cuZoom(CU_MIN); }
    else if (/^Arrow/.test(ev.key)) {
      const d = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] }[ev.key];
      ev.stopPropagation(); ev.preventDefault();
      CU.x += d[0]; CU.y += d[1];
      cuApply();
    }
  }, true);

  /* The fit is measured off the window, so it is remeasured when the window
     changes - and off the picture, which on a first open is not there yet. */
  img.addEventListener("load", () => { if (cuOpen()) cuApply(); });
  window.addEventListener("resize", () => { if (cuOpen()) cuApply(); });
}

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
/* The three ways a reader takes over the scroll themselves. */
const GESTURES = ["wheel", "touchstart", "keydown"];
const RD = { onScroll: null, onResize: null, onMove: null, onGesture: null,
             live: null, pinned: null, moved: false,
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
/* Paragraph id -> ordered concept ids. Absent until stage 6g has run, and the
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
  /* These rows point at figures elsewhere in the section - the ones the reader
     cannot currently see - so each carries its crop. The row for the figure
     under the reader's eye does not: the paper is right there showing it at
     full size, and a thumbnail of that is noise. */
  const figRow = (it) =>
    '<div class="beside-c small beside-figrow" data-open="item:' + esc(it.id) + '">' +
    (it.asset ? '<span class="beside-thumb">' + figImg(MAIN_ID, it.asset, "", true) + "</span>" : "") +
    '<span class="beside-figtext"><span class="beside-fig">' + esc(itemLabel(it)) + "</span>" +
    '<span class="beside-name">' + esc(it.title || it.id) + "</span></span></div>";

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
  /* Before stage 6g there is no ranking, so show the section's concepts rather
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
  /* Pinning a block moves where the switch would send you back to, and pinning
     is the other way that block changes. */
  refreshSwitch();
  /* A page opened in the column is the site's page at the column's scale, so it
     gets its figures too - except the one it is about, which is already the
     thing at the top of it. */
  if (top && top.kind !== "theme") placeFigures(box, top.id);
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
  if (RD.onGesture) GESTURES.forEach((e) => window.removeEventListener(e, RD.onGesture));
  RD.onScroll = RD.onResize = RD.onMove = RD.onGesture = null;
  RD.live = RD.pinned = null;
  RD.moved = false;
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
  return '<div class="reader">' +
    '<div class="pdf-pane" id="pdf-pane"><p class="pdf-wait">Opening the paper…</p></div>' +
    '<aside class="beside" id="beside">' +
    '<button class="beside-bar" id="beside-bar" type="button">Concepts</button>' +
    '<div class="beside-body" id="beside-body"></div>' +
    '<button class="beside-unpin" id="beside-pin" type="button" hidden>Unpin</button>' +
    "</aside></div>";
}

/* The reader's few controls - find, where you are, zoom - sit in the site rail
   after the switch, so the paper gets the same head every other page has
   rather than a second bar under it. The way back is not among them: the
   switch is right beside them and does it. */
function readerTools() {
  return '<span class="find-wrap">' +
    '<input id="find" type="search" placeholder="Find in the paper…" autocomplete="off" spellcheck="false">' +
    '<div class="find-results" id="find-results" hidden></div></span>' +
    '<span class="reader-count" id="reader-count"></span>' +
    '<span class="zoom-ctl">' +
    '<button id="zoom-out" type="button" aria-label="Zoom out">&minus;</button>' +
    '<span id="zoom-label">100%</span>' +
    '<button id="zoom-in" type="button" aria-label="Zoom in">+</button></span>';
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
    refreshSwitch();
    if (!RD.stack.length) paintColumn();
  }
  RD.onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(follow); } };
  window.addEventListener("scroll", RD.onScroll, { capture: true, passive: true });
  RD.onResize = () => { applyZoom(); buildBlockIndex(); if (RD.onScroll) RD.onScroll(); };
  window.addEventListener("resize", RD.onResize);

  /* The moment you take the paper over. Until then the switch answers with
     whatever sent you here; after it, with wherever you have got to. On a web
     paper the article is inside a frame that never scrolls itself, so a wheel
     over it scrolls this window but fires in there - both documents have to be
     asked, and the frame is our own copy, so it can be. */
  RD.onGesture = () => { RD.moved = true; refreshSwitch(); };
  GESTURES.forEach((e) => {
    window.addEventListener(e, RD.onGesture, { passive: true });
    if (RD.fdoc) RD.fdoc.addEventListener(e, RD.onGesture, { passive: true });
  });

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
      refreshSwitch();
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

/* Everything up to the second "#": which page of the site, without the anchor
   naming a place inside it. */
function routeOf(hash) {
  const full = decodeURIComponent(hash || "#/");
  const cut = full.indexOf("#", 1);
  return cut > 0 ? full.slice(0, cut) : full;
}

/* ---------- the switch ---------- */
/* Two ways to read the same paper, and until now four doors between them: a
   link in the nav foot, a second one on the library card, the page citations,
   and a back link out of the reader. One control instead, in the rail on every
   page of a paper, so the retelling and the paper as printed are always one
   click apart and neither is something you have to know about to find.

   Both halves keep your place, and neither guesses to do it. A chapter already
   names the sections of the paper it draws on; every region of the paper
   already names the section it sits in. The switch reads those two facts in
   opposite directions. */

/* Where a section of the paper starts. A PDF answers with a page number, a
   paper published on the web with the id of the section's first block - which
   is what each of those readers opens at. Built once from the same regions the
   reader itself follows, so the two can never disagree. */
let SEC_AT = null;
/* And the same ids in the order the paper prints them. Section ids like "3"
   and "5" are integers as far as an object is concerned, and a plain object
   hands those back first and in its own order - so the reading order has to be
   kept beside the map rather than taken from it. */
const SEC_ORDER = [];
function sectionAt(sid) {
  if (!SEC_AT) {
    SEC_AT = {};
    const web = readerKind(MAIN_ID) === "web";
    regionsOf().forEach((g) => {
      if (!g.sectionId || SEC_AT[g.sectionId]) return;
      SEC_AT[g.sectionId] = web ? g.id : g.page;
      SEC_ORDER.push(g.sectionId);
    });
  }
  return SEC_AT[sid] || null;
}

/* What a piece of the site is about, as a place in the paper.

   Not the first section it cites: a chapter's citations run in paper order and
   almost every chapter leans on the abstract and the introduction, so first
   would answer page 1 for eight chapters out of nine. What a chapter is about
   is written instead in how precisely it cites. A chapter that names §3.2.1 is
   telling you it is about §3.2.1; one that names §3 is telling you much less.
   So: the most specific citations it makes, and among those the page most of
   them land on - the run of the paper it actually dwells in. Ties go to the
   earlier page, because a chapter is better opened at its start.

   On the nine chapters of 1706.03762 that gives page 4 for the chapter about
   one operation, 5 for the one about three wirings of it, 7 for training and 8
   for results. It is bluntest on the chapters that cite nothing below a
   top-level section - the one that frames the problem, the one that closes it -
   where the most it can say is which part of the paper they live in.

   It is blunter still where a chapter's citations are exhaustive rather than
   chosen. global-workspace lists up to fifty-four sections under one chapter,
   four levels deep and reaching into the appendix, and the deepest of those is
   as likely to be a footnote as the subject; several of its chapters land on
   the same passage. Nothing here can fix that - a list that says everything a
   chapter touches cannot also say what it is about - and the round trip does
   not depend on it, because a switch pressed from a chapter remembers that
   chapter rather than working it out again on the way back. */
function atOfSources(src) {
  if (!src || (src.paperId && src.paperId !== MAIN_ID)) return null;
  const secs = (src.sections || []).filter((s) => s && s.id);
  if (secs.length) {
    const dots = (s) => String(s.id).split(".").length;
    const deepest = Math.max.apply(null, secs.map(dots));
    const pick = secs.filter((s) => dots(s) === deepest);
    const tally = {};
    let best = null;
    pick.forEach((s) => {
      const at = s.anchor || sectionAt(s.id) || s.start;
      if (at == null) return;
      tally[at] = (tally[at] || 0) + 1;
      if (!best || tally[at] > tally[best]) best = at;
    });
    if (best != null) return best;
  }
  return (src.pages || [])[0] || null;
}
function atAttr(src) {
  const at = atOfSources(src);
  return at ? ' data-at="' + esc(String(at)) + '"' : "";
}

/* Which piece you are looking at. A page holding many chapters is marked one
   per chapter and answers with the one under the top of the window; a page
   about a single thing carries no marks and answers with its own citation,
   whatever the scroll. */
function markNow() {
  const marks = document.querySelectorAll("#content [data-at]");
  if (!marks.length) return null;
  const rail = document.querySelector(".rail");
  const line = (rail ? rail.getBoundingClientRect().bottom : 0) + 24;
  let best = marks[0];
  marks.forEach((n) => { if (n.getBoundingClientRect().top <= line) best = n; });
  return best;
}

function atNow() {
  const mark = markNow();
  if (mark) return mark.getAttribute("data-at");
  /* Any link into this paper's own reader will do - a chapter's citation, the
     "cropped from page 3" under a figure. Anchored to the start of the href so
     a citation into another paper's reader, which carries its own shell in
     front of the route, is not mistaken for one into this one. */
  const cite = document.querySelector('#content a[href^="#/pdf/"]');
  const m = cite && /^#\/pdf\/([^#?]+)/.exec(cite.getAttribute("href"));
  if (m) return decodeURIComponent(m[1]);
  /* A concept prints no citation - it is used across a paper rather than
     stated in one place - but it does name the sections it is used in, and the
     first of those is where the reader would meet it. */
  const c = /^#\/concept\/([^#]+)$/.exec(decodeURIComponent(location.hash || ""));
  const obj = c && INDEX[c[1]] && INDEX[c[1]].obj;
  const sid = obj && (obj.sectionIds || [])[0];
  return sid ? sectionAt(sid) : null;
}

/* Coming back the other way: the chapter of the story that covers the passage
   you were on. One of the story's own numbered chapters, opened where it sits
   on the front page - someone who presses this wants the thread again, not to
   be dropped five levels down a branch they have never seen. Where several
   cover the same section the most focused one wins, which is the one that drew
   on the fewest; a subsection nobody named is answered by its parent. */
function chapterForSection(sid) {
  const chs = ((mainPaper().narrative || {}).chapters) || [];
  let key = String(sid || "");
  while (key) {
    let best = null, fewest = Infinity;
    chs.forEach((c) => {
      const secs = ((c.sources || {}).sections) || [];
      if (secs.some((s) => s.id === key) && secs.length < fewest) { fewest = secs.length; best = c; }
    });
    if (best) return best;
    const cut = key.lastIndexOf(".");
    if (cut < 0) return null;
    key = key.slice(0, cut);
  }
  return null;
}

/* Have you moved since the paper opened where something sent you?

   Asked of your hands rather than of the scroll position. A paper published as
   a web page is still drawing while you look at it - every figure that finishes
   moves everything below it - so a scroll position that has changed does not
   mean you went anywhere. A wheel, a touch or a key does. */
const justArrived = () => !RD.pinned && !RD.moved;

/* Which sections of the paper you might be standing in, best first.

   Standing still on the page you arrived at, that is whatever begins on it -
   the tail of the previous section running across the top is not what you were
   sent for. Once you have scrolled it is the block you are on: a paragraph
   says its section itself, and a figure crop, which knows only its page, takes
   the running section it was printed under, the same answer the rest of the
   reader gives for it.

   More than one, because a page can start two sections and not every section
   is one a chapter named. The caller takes the first that leads somewhere. */
function liveSections() {
  const out = [];
  if (justArrived() && RD.startAt) {
    const want = String(RD.startAt);
    sectionAt(null);
    SEC_ORDER.forEach((sid) => { if (String(SEC_AT[sid]) === want) out.push(sid); });
  }
  const g = RD.byId[RD.pinned || RD.live];
  const own = g && (g.kind === "item" ? itemSection()[g.id] || g.sectionId : g.sectionId);
  if (own) out.push(own);
  return out;
}

/* The chapter the switch was last pressed from, so pressing it back returns
   there exactly rather than working it out again. It is dropped the moment you
   scroll the paper, because then you are somewhere else and the honest answer
   is the chapter about wherever you have got to. */
let CAME_FROM = null;

function storyHref() {
  if (CAME_FROM && justArrived()) return CAME_FROM;
  const secs = liveSections();
  for (const sid of secs) {
    const c = chapterForSection(sid);
    if (c) return "#/#ch-" + c.id;
  }
  return "#/";
}

/* The half that is a link is the one you are not on, so there is only ever one
   href to keep current. It is rewritten on every scroll frame rather than only
   on click, so hovering it tells the truth and opening it in a new tab lands
   in the same place a click would. */
function refreshSwitch() {
  const a = document.querySelector("#rail-switch a.sw-half");
  if (!a) return;
  if (document.body.classList.contains("reader-mode")) { a.setAttribute("href", storyHref()); return; }
  const at = atNow();
  a.setAttribute("href", "#/pdf" + (at ? "/" + encodeURIComponent(at) : ""));
}

function paintSwitch(route) {
  const box = el("rail-switch");
  if (!box) return;
  /* A paper ingest has not walked has no second side to switch to. */
  if (!regionsOf().length) { box.innerHTML = ""; return; }
  const onPaper = /^#\/pdf(\/|$)/.test(route);
  /* Off the paper, there is nothing to come back to. */
  if (!onPaper) CAME_FROM = null;
  const half = (here, label) => (here
    ? '<span class="sw-half is-on" aria-current="page">' + label + "</span>"
    : '<a class="sw-half" href="#/">' + label + "</a>");
  box.innerHTML = '<div class="switcher" role="group" aria-label="How to read this paper">' +
    half(!onPaper, "Interactive Wiki") + half(onPaper, "Annotated Paper") + "</div>";
  refreshSwitch();
}

/* Draw the route, fetching the paper it points into first if this shell has
   not got it yet. Only a link out of this paper ever waits, and only the first
   time - by the second the bundle is in the browser's cache and in PAPERS. */
let RENDER_SEQ = 0;
function render() {
  const route = routeOf(decodeURIComponent(location.hash || "#/"));
  const paper = paperForRoute(route);
  const level = storyLevelForRoute(route);
  if (!paper && !level) return draw();
  const seq = ++RENDER_SEQ;
  document.body.classList.add("loading-paper");
  Promise.all([paper ? loadPaper(paper) : null, level ? loadStoryLevel(level) : null]).then(() => {
    document.body.classList.remove("loading-paper");
    /* Somebody who kept clicking while it arrived is somewhere else now. */
    if (seq === RENDER_SEQ) draw();
  });
}

function draw() {
  const full = decodeURIComponent(location.hash || "#/");
  const route = routeOf(full);
  const anchor = route.length < full.length ? full.slice(route.length + 1) : null;
  const content = el("content");
  readerTeardown();
  const isReader = /^#\/pdf(\/|$)/.test(route) && regionsOf().length > 0;
  document.body.classList.toggle("reader-mode", isReader);
  const tools = el("rail-tools");
  if (tools) tools.innerHTML = isReader ? readerTools() : "";
  let html = null;
  for (const [re, fn] of ROUTES) { const m = route.match(re); if (m) { html = fn(m); break; } }
  content.innerHTML = html == null ? notFound(route) : html;
  /* A picture already in cache fires no load event to catch. */
  content.querySelectorAll(".figure-closeup img").forEach(figRatio);
  if (isReader && el("pdf-pane")) mountReader();
  /* Before mountMath, so an inlined equation is rendered along with the rest. */
  if (INLINE_ROUTES.test(route)) placeFigures(content);
  mountMath(content);
  closeFigPop();
  closeCloseup();
  markActiveNav(full, route);
  paintNavContext(route);
  el("sidebar").classList.remove("open");
  const target = anchor ? document.getElementById(anchor) : null;
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  /* After the scroll, because where the switch would send you depends on where
     the page has just landed. */
  paintSwitch(route);
}

function markActiveNav(full, route) {
  document.querySelectorAll("#sidebar a").forEach((a) => {
    const href = a.getAttribute("href");
    a.classList.toggle("active", href === full || href === route);
  });
  /* a closed fold never hides where you are; it only ever opens itself */
  document.querySelectorAll("#sidebar details.nav-fold").forEach((d) => {
    if (d.querySelector("a.active")) d.open = true;
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

/* The heading of a fold carries two controls rather than one. The name is the
   door into that reading, so a click anywhere along the row follows it; the
   chevron at the end is the only thing that opens the drawer. A section with
   nowhere of its own to go - themes have no page - has no door, and there the
   whole row opens the fold. Wired in wireFolds, which has to call off the
   summary's own habit of toggling wherever it is clicked. */
function foldHead(name, href, count, tip) {
  /* The card hangs off the name and not off the whole row, so it is the name
     that has to be pointed at. What the tip says is what that reading is like,
     which is an answer to the name; over the count or the chevron it would be
     answering a question nobody asked. */
  const t = ' data-tip="' + esc(tip) + '"';
  return '<summary tabindex="-1">' +
    (href ? '<a class="fold-name"' + t + ' href="' + esc(href) + '">' + esc(name) + "</a>"
          : '<span class="fold-name"' + t + ">" + esc(name) + "</span>") +
    '<span class="count">' + count + "</span>" +
    '<button class="fold-toggle" type="button" aria-expanded="false" aria-label="Expand ' +
    esc(name) + '"></button></summary>';
}

function buildNav() {
  const p = mainPaper();
  const meta = REG[MAIN_ID] || {};
  let h = '<a class="site-link" href="papers.html">All papers</a>';
  h += '<p class="brand"><a href="#/">' + esc(meta.title || MAIN_ID) + "</a></p>";
  h += '<input id="search" type="search" placeholder="Find a concept…" autocomplete="off"><ul id="search-results"></ul>';

  /* Every section is the same fold, and every heading is the door into what it
     holds: the name navigates, the chevron beside it opens the list. The first
     two start open - they are the primary nav - and a fold that holds the page
     you are on pulls itself open again in markActiveNav. */
  if (p.summary) {
    const beats = p.summary.beats || [];
    h += '<details class="nav-fold" open>' +
      foldHead("Skimmaxx it!", "#/summary", beats.length,
        "The paper in a nutshell — a quick skim for an expert, slightly tough for a beginner") +
      '<ul class="nav-list">';
    beats.forEach((b, i) => {
      h += navRow("#/summary#b-" + b.id, String(i + 1), b.heading);
    });
    h += "</ul></details>";
  }

  const main = p.narrative;
  if (main) {
    h += '<details class="nav-fold" open>' +
      foldHead("The story", "#/", (main.chapters || []).length,
        "The longest read, with detailed explanations — ideal for a beginner") +
      '<ul class="nav-list">';
    (main.chapters || []).forEach((c, i) => {
      h += navRow(c.childId ? "#/n/" + c.childId : "#/#ch-" + c.id, c.number || String(i + 1), c.title);
    });
    h += "</ul></details>";
  }
  h += '<div id="nav-context"></div>';

  const ins = p.insights;
  if (ins) {
    /* The name is the whole read now, so the row that used to say so is gone -
       it would be the same destination twice, marked here twice. */
    h += '<details class="nav-fold">' +
      foldHead("Insights", "#/insights", (ins.chapters || []).length,
        "The main points, if you are familiar with the concepts") +
      '<ul class="nav-list">';
    (ins.chapters || []).forEach((c, i) => {
      h += navRow(c.childId ? "#/n/" + c.childId : "#/insights#ch-" + c.id, c.number || String(i + 1), c.title);
    });
    h += "</ul></details>";
  }

  const themes = (p.themes || []).filter((t) => t.kind === "concept-theme");
  if (themes.length) {
    /* No page of their own, so no door: here the name opens the fold too. */
    h += '<details class="nav-fold">' +
      foldHead("Themes", "", themes.length, "The main ideas used in the paper") +
      '<ul class="nav-list">' +
      themes.map((t) => navRow("#/theme/" + t.id, "", t.name)).join("") + "</ul></details>";
  }

  /* The paper itself is not listed here. It is one of the two things the rail's
     switch is for, and a foot link would be a second, quieter door to it. */
  h += '<nav class="nav-foot">';
  h += '<a href="#/figures">Figures</a><a href="#/map">Concepts</a><a href="#/edges">Connections</a>';
  if (pageFor(MAIN_ID)) h += '<a href="#/relations">Relations</a>';
  h += '<a href="#/papers">Papers</a></nav>';
  el("sidebar").innerHTML = h;

  el("search").addEventListener("input", onSearch);
  wireFolds();
}

/* A fold opens only from its chevron. The summary would otherwise toggle
   wherever it is clicked, which is the one thing that must not happen when the
   heading is also a link - a reader aiming at the name would watch the list
   collapse instead of arriving. So the summary's own toggle is called off
   across the whole row and put back on the chevron alone, and the rest of the
   row stands in for the name. A click that lands on the name itself is left
   alone: the browser already runs a link's activation instead of the
   summary's, so nothing there needs cancelling. */
function syncFold(d) {
  const btn = d.querySelector(".fold-toggle");
  if (!btn) return;
  const name = d.querySelector(".fold-name");
  btn.setAttribute("aria-expanded", d.open ? "true" : "false");
  btn.setAttribute("aria-label", (d.open ? "Collapse " : "Expand ") +
    (name ? name.textContent : ""));
}

function wireFolds() {
  document.querySelectorAll("#sidebar details.nav-fold").forEach((d) => {
    const sum = d.querySelector("summary");
    const door = d.querySelector("a.fold-name");
    sum.addEventListener("click", (ev) => {
      if (ev.target.closest("a")) return;
      ev.preventDefault();
      if (door && !ev.target.closest(".fold-toggle")) {
        location.hash = door.getAttribute("href");
        return;
      }
      d.open = !d.open;
    });
    /* markActiveNav opens a fold on its own, so the chevron follows the
       element rather than the click that may not have caused it. */
    d.addEventListener("toggle", () => syncFold(d));
    syncFold(d);
  });
}

function onSearch(ev) {
  const q = ev.target.value.trim().toLowerCase();
  const out = el("search-results");
  if (!q) { out.innerHTML = ""; return; }
  /* Every paper's bundle is loaded, so this index already spans the project.
     What made it feel local was stopping at sixty candidates while scanning in
     insertion order - and the paper you are standing in was indexed first, so
     on a paper with 276 concepts the scan could end before reaching another
     one. Score everything, then rank; the current paper gets no advantage. */
  const hits = [];
  for (const id in INDEX) {
    const t = INDEX[id];
    if (t.kind === "paper") continue;
    const name = displayName(t);
    const n = name.toLowerCase();
    if (!(n + " " + (t.obj.summary || t.obj.caption || "").toLowerCase()).includes(q)) continue;
    hits.push({ id, t, name, rank: n === q ? 0 : n.startsWith(q) ? 1 : 2 });
  }
  hits.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length);
  /* And say which paper each hit came from. Two papers can own a concept of the
     same name, and without this a reader cannot tell them apart - which is the
     other half of the search reading as though it only knew one paper. */
  out.innerHTML = hits.slice(0, 10).map((h) => {
    const owner = REG[h.t.paperId] || {};
    return '<li><a href="#/' + routeFor(h.t) + '">' + esc(h.name) +
      '<span class="kind">' + h.t.kind + "</span>" +
      '<span class="from">' + esc(shortTitle(owner.title || h.t.paperId)) + "</span></a></li>";
  }).join("");
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
  /* The node bodies live in one file per level now, and a shell holds only the
     levels it has opened. So the gate reads whichever are here and says so,
     rather than reporting the rest as missing - and a child is checked against
     the index, which names every node whether or not its level is loaded. */
  const bodies = storyBodies(), sIndex = storyIndex();
  report.storyLevelsLoaded = Object.keys(STORY_PENDING).map(Number).sort();
  report.storyNodesScanned = Object.keys(bodies).length + "/" + Object.keys(sIndex).length;
  Object.keys(bodies).forEach((nid) => {
    const n = bodies[nid];
    scan(n.intro, "narrative:" + nid);
    (n.chapters || []).forEach((c) => {
      scan(c.body, "narrative:" + nid + ":" + c.id);
      if (c.childId && !sIndex[c.childId]) report.missingLinks.push({ id: c.childId, where: "child:" + nid });
    });
  });
  ((p.narrative && p.narrative.chapters) || []).forEach((c) => {
    if (c.childId && !sIndex[c.childId]) report.missingLinks.push({ id: c.childId, where: "child:root" });
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
  SkimTheme.mount(el("theme-toggle"));
  setupPopover();
  setupFigPop();
  setupHelp();
  setupCloseup();
  setupSwitch();
  el("menu-btn").addEventListener("click", () => el("sidebar").classList.toggle("open"));
  window.addEventListener("hashchange", render);
  render();
});

/* Which chapter you are looking at changes as you read, so the switch is
   re-aimed on every scroll frame - one attribute written, off a measurement of
   however many chapters the page holds. The click recomputes first anyway, so
   nothing depends on that frame having landed. */
function setupSwitch() {
  let queued = false;
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; refreshSwitch(); });
  }, { passive: true });

  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest("#rail-switch a.sw-half");
    if (!a || ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    ev.preventDefault();
    refreshSwitch();
    const to = a.getAttribute("href");
    /* Leaving for the paper, remember the chapter being left, so coming back is
       exact. Only a chapter: from a concept page or the figures list there is
       no thread to resume and the way back is worked out from the paper. */
    const mark = /^#\/pdf/.test(to) ? markNow() : null;
    CAME_FROM = mark && /^ch-/.test(mark.id) ? routeOf(location.hash) + "#" + mark.id : null;
    if (to === location.hash) render();
    else location.hash = to;
  });
}
