/* Skimmaxxer library. Every paper the project has touched, and the way the
   concepts inside each one are grouped. Reads the same generated bundles the
   reader does: window.SKIM_REGISTER (register.js) + window.SKIM_PAPERS[id]. */
"use strict";

const REG = (window.SKIM_REGISTER && SKIM_REGISTER.papers) || {};
const PAPERS = window.SKIM_PAPERS || {};

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const el = (id) => document.getElementById(id);
const data = (pid) => PAPERS[pid] || {};
const readHref = (pid, hash) => "read.html?p=" + encodeURIComponent(pid) + (hash || "");

/* ---------- shape of a read ---------- */

/* Chapters at each level of zoom, level 0 being the whole-paper telling. */
function chaptersByDepth(pid) {
  const nar = data(pid).narrative;
  if (!nar) return [];
  const out = [(nar.chapters || []).length];
  Object.keys(nar.nodes || {}).forEach((nid) => {
    const n = nar.nodes[nid];
    const d = n.depth || 0;
    out[d] = (out[d] || 0) + (n.chapters || []).length;
  });
  for (let i = 0; i < out.length; i++) out[i] = out[i] || 0;
  return out;
}

function conceptThemes(pid) {
  return (data(pid).themes || []).filter((t) => t.kind === "concept-theme");
}

function counts(pid) {
  const p = data(pid);
  return {
    concepts: (p.concepts || []).length,
    items: (p.items || []).length,
    edges: (p.edges || []).length,
    pages: (p.pages || []).length,
  };
}

const plural = (n, one, many) => n + " " + (n === 1 ? one : (many || one + "s"));

/* One sentence out of a written summary: enough to say what a thing is, short
   enough that a list of them still reads as a list. */
function firstLine(text, cap) {
  let s = String(text || "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const m = s.match(/^(.*?[.!?])(?:\s|$)/);
  if (m && m[1].length >= 45) s = m[1];
  cap = cap || 185;
  if (s.length > cap) s = s.slice(0, cap).replace(/\s+\S*$/, "") + "…";
  return s;
}

const itemName = (it) => (it.number
  ? it.kind.charAt(0).toUpperCase() + it.kind.slice(1) + " " + it.number + " — " + (it.title || "")
  : (it.title || it.id));

/* ---------- the depth scale: what the four colours mean ---------- */

const LEVELS = [
  { key: "L0", name: "The whole paper", note: "one telling, start to finish" },
  { key: "L1", name: "A chapter, retold", note: "each chapter reopens as its own story" },
  { key: "L2", name: "A section in full", note: "the argument at working resolution" },
  { key: "L3", name: "The mechanism itself", note: "down to the equation and the numbers" },
];

function renderScale(fullIds) {
  const totals = [];
  fullIds.forEach((pid) => {
    chaptersByDepth(pid).forEach((n, d) => { totals[d] = (totals[d] || 0) + n; });
  });
  return '<div class="scale" aria-label="What the four colours mean">' +
    '<p class="scale-head">Colour says how far in you are</p>' +
    '<ol class="scale-stops">' +
    LEVELS.map((lv, d) =>
      '<li data-depth="' + d + '">' +
      '<span class="stop-key">' + lv.key + "</span>" +
      '<span class="stop-name">' + esc(lv.name) + "</span>" +
      '<span class="stop-count">' + (totals[d] ? plural(totals[d], "chapter") : "") + "</span>" +
      '<span class="stop-note">' + esc(lv.note) + "</span>" +
      "</li>").join("") +
    "</ol></div>";
}

/* ---------- a paper read in full ---------- */

function fullPanel(pid) {
  const r = REG[pid] || {};
  const p = data(pid);
  const c = counts(pid);
  const themes = conceptThemes(pid);
  const depths = chaptersByDepth(pid);

  let h = '<article class="paper">';

  h += '<header class="paper-head">';
  h += '<p class="paper-id">' + esc(pid) +
    (r.source ? ' <a class="paper-src" href="' + esc(r.source) + '" target="_blank" rel="noopener">arXiv</a>' : "") +
    "</p>";
  h += '<h3 class="paper-title"><a href="' + readHref(pid) + '">' + esc(r.title || pid) + "</a></h3>";
  h += '<p class="paper-authors">' + esc(r.authors || "") + "</p>";
  h += "</header>";

  if (depths.length) {
    const deepest = Math.max.apply(null, depths.concat([1]));
    h += '<ol class="depth-row" aria-label="Chapters at each level of zoom">' +
      depths.map((n, d) => '<li data-depth="' + d + '" aria-label="' + plural(n, "chapter") +
        " at level " + d + '"><span class="dr-track"><i style="width:' +
        Math.max(4, Math.round((n / deepest) * 100)) + '%"></i></span>' +
        '<span class="dr-key">L' + d + '</span><span class="dr-n">' + n + "</span></li>").join("") +
      "</ol>";
  }

  h += panels(pid);

  h += '<nav class="paper-doors">';
  h += '<a class="door door-main" href="' + readHref(pid) + '">Start reading</a>';
  h += '<span class="door-note">' + plural(c.edges, "connection") + " · " +
    plural(c.pages, "written page") + "</span>";
  h += "</nav>";

  return h + "</article>";
}

/* What is inside this paper, four ways. The buttons swap the text in place -
   only Start reading leaves the page. */
function panels(pid) {
  const p = data(pid);
  const c = counts(pid);
  const majors = (p.concepts || []).filter((x) => x.tier === "major");
  const tabs = [];

  const themes = conceptThemes(pid);
  if (themes.length) {
    tabs.push({
      key: "parts", label: "Parts", n: themes.length,
      intro: plural(c.concepts, "concept") + ", grouped into " + plural(themes.length, "part") +
        " that follow the paper's own order.",
      rows: themes.map((t) => ({
        name: t.name,
        meta: plural((t.members || []).length, "concept"),
        line: firstLine(t.summary),
      })),
    });
  }
  if (majors.length) {
    tabs.push({
      key: "concepts", label: "Concepts", n: majors.length,
      intro: "The " + majors.length + " concepts the paper's argument rests on, of " +
        c.concepts + " in all.",
      rows: majors.map((x) => ({ name: x.name, line: firstLine(x.summary) })),
      more: { href: readHref(pid, "#/map"), text: "All " + c.concepts + " concepts" },
    });
  }
  if ((p.items || []).length) {
    tabs.push({
      key: "figures", label: "Figures", n: p.items.length,
      intro: "Every figure, table and equation, rewritten so it can be read on its own — each " +
        "term and number in it defined.",
      rows: p.items.map((it) => ({ name: itemName(it), line: firstLine(it.takeaway || it.caption) })),
    });
  }
  if (p.insights && (p.insights.chapters || []).length) {
    tabs.push({
      key: "insights", label: "Insights", n: p.insights.chapters.length,
      intro: firstLine(p.insights.intro, 150) ||
        "What a second pass over the paper turns up, reading across it rather than through it.",
      rows: p.insights.chapters.map((ch) => ({ name: ch.title, line: firstLine(ch.body) })),
    });
  }
  if (!tabs.length) return "";

  const uid = pid.replace(/[^a-z0-9]/gi, "-");
  let h = '<div class="panels" data-panels="' + esc(uid) + '">';
  h += '<div class="tabs" role="tablist" aria-label="What is inside this paper">' +
    tabs.map((t, i) => '<button type="button" class="tab" role="tab" id="tab-' + uid + "-" + t.key +
      '" aria-controls="panel-' + uid + "-" + t.key + '" aria-selected="' + (i === 0) + '"' +
      (i === 0 ? "" : ' tabindex="-1"') + ">" + esc(t.label) +
      '<span class="tab-n">' + t.n + "</span></button>").join("") + "</div>";

  h += tabs.map((t, i) =>
    '<div class="panel" role="tabpanel" id="panel-' + uid + "-" + t.key +
    '" aria-labelledby="tab-' + uid + "-" + t.key + '"' + (i === 0 ? "" : " hidden") + ">" +
    '<p class="panel-intro">' + esc(t.intro) + "</p>" +
    '<ul class="entries">' + t.rows.map((r) =>
      "<li>" + '<p class="ent-name">' + esc(r.name) +
      (r.meta ? '<span class="ent-meta">' + esc(r.meta) + "</span>" : "") + "</p>" +
      (r.line ? '<p class="ent-line">' + esc(r.line) + "</p>" : "") + "</li>").join("") + "</ul>" +
    (t.more ? '<a class="panel-more" href="' + t.more.href + '">' + esc(t.more.text) + " →</a>" : "") +
    "</div>").join("");

  return h + "</div>";
}

/* ---------- tabs ---------- */

function wireTabs(root) {
  root.querySelectorAll(".panels").forEach((group) => {
    const tabs = Array.from(group.querySelectorAll(".tab"));
    const show = (i) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(i));
      t.addEventListener("keydown", (ev) => {
        const step = ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        ev.preventDefault();
        const next = (i + step + tabs.length) % tabs.length;
        show(next);
        tabs[next].focus();
      });
    });
  });
}

/* ---------- a paper read only where it was needed ---------- */

/* Narrow reads have no shell of their own, so their concepts open inside the
   shell of a paper that cites them - which is how the reader handles a concept
   belonging to another paper. */
function hostFor(pid) {
  const r = REG[pid] || {};
  const citer = (r.citedBy || []).find((x) => REG[x] && REG[x].status === "full");
  return citer || Object.keys(REG).find((x) => REG[x].status === "full") || pid;
}

function narrowRow(pid) {
  const r = REG[pid] || {};
  const host = hostFor(pid);
  const cs = data(pid).concepts || [];
  const needed = (r.citedBy || []).map((x) => (REG[x] && REG[x].status === "full")
    ? '<a href="' + readHref(x) + '">' + esc(REG[x].title) + "</a>"
    : esc((REG[x] && REG[x].title) || x));

  let h = '<li class="narrow">';
  h += '<p class="narrow-id">' + esc(pid) + "</p>";
  h += '<h3 class="narrow-title"><a href="' + readHref(host, "#/paper/" + encodeURIComponent(pid)) + '">' +
    esc(r.title || pid) + "</a></h3>";
  h += '<p class="narrow-authors">' + esc(r.authors || "") + "</p>";
  if (cs.length) {
    h += '<ul class="narrow-concepts">' + cs.map((c) =>
      '<li><a href="' + readHref(host, "#/concept/" + encodeURIComponent(c.id)) + '">' +
      esc(c.name) + "</a></li>").join("") + "</ul>";
  }
  if (needed.length) {
    h += '<p class="narrow-for"><span class="for-label">read for</span> ' +
      needed.join('<span class="dot">·</span>') + "</p>";
  }
  return h + "</li>";
}

/* ---------- page ---------- */

function render() {
  const ids = Object.keys(REG);
  const full = ids.filter((id) => REG[id].status === "full");
  const narrow = ids.filter((id) => REG[id].status !== "full").sort();

  const total = ids.reduce((acc, id) => {
    const c = counts(id);
    acc.concepts += c.concepts; acc.items += c.items; acc.edges += c.edges;
    return acc;
  }, { concepts: 0, items: 0, edges: 0 });

  let h = "";

  h += '<section class="hero"><div class="hero-text">';
  h += '<p class="eyebrow">The library</p>';
  h += "<h1>Read a paper at the depth you want.</h1>";
  h += '<p class="lede">Every paper here has been taken apart into concepts, figures that stand on ' +
    'their own, and a story that reopens at higher resolution as far down as you care to go. ' +
    'Every claim carries the page of the PDF it came from.</p>';
  h += '<p class="tally">' + [
    plural(ids.length, "paper"),
    plural(full.length, "read in full", "read in full"),
    plural(total.concepts, "concept"),
    plural(total.items, "figure and table", "figures and tables"),
    plural(total.edges, "connection"),
  ].join('<span class="dot">·</span>') + "</p>";
  h += "</div>";
  h += renderScale(full);
  h += "</section>";

  if (full.length) {
    h += '<section class="shelf">';
    h += '<h2 class="section-head"><span>Read in full</span><span class="section-n">' + full.length + "</span></h2>";
    h += '<div class="paper-grid">' + full.map(fullPanel).join("") + "</div>";
    h += "</section>";
  }

  if (narrow.length) {
    h += '<section class="shelf">';
    h += '<h2 class="section-head"><span>Read only where they were needed</span><span class="section-n">' + narrow.length + "</span></h2>";
    h += '<p class="section-note">Opened for one mechanism each, then closed. These concepts belong ' +
      'to the papers below and are reused by anything that cites them, so they open inside whichever ' +
      'full read needed them.</p>';
    h += '<ol class="narrow-list">' + narrow.map(narrowRow).join("") + "</ol>";
    h += "</section>";
  }

  h += '<footer class="site-foot"><p>Generated from the PDFs in <code>papers/</code>. ' +
    'Nothing here is written by hand.</p></footer>';

  el("home").innerHTML = h;
  wireTabs(el("home"));
  mountMath(el("home"));
}

/* A handful of concept names carry inline math from the paper. */
function mountMath(root) {
  if (!window.renderMathInElement) return;
  try {
    renderMathInElement(root, {
      delimiters: [{ left: "$", right: "$", display: false }],
      throwOnError: false,
    });
  } catch (e) { /* names stay as written */ }
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  const btn = el("theme-toggle");
  btn.textContent = SkimTheme.label();
  btn.addEventListener("click", () => { SkimTheme.cycle(); btn.textContent = SkimTheme.label(); });
});
