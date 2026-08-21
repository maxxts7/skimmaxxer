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
      key: "themes", label: "Themes",
      intro: plural(c.concepts, "concept") + ", grouped into " + plural(themes.length, "theme") +
        " that follow the paper's own order.",
      rows: themes.map((t) => ({
        href: readHref(pid, "#/theme/" + encodeURIComponent(t.id)),
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
      rows: majors.map((x) => ({
        href: readHref(pid, "#/concept/" + encodeURIComponent(x.id)),
        name: x.name,
        line: firstLine(x.summary),
      })),
      more: { href: readHref(pid, "#/map"), text: "All " + c.concepts + " concepts" },
    });
  }
  if ((p.items || []).length) {
    tabs.push({
      key: "figures", label: "Figures", n: p.items.length,
      intro: "Every figure, table and equation, rewritten so it can be read on its own — each " +
        "term and number in it defined.",
      rows: p.items.map((it) => ({
        href: readHref(pid, "#/figure/" + encodeURIComponent(it.id)),
        name: itemName(it),
        line: firstLine(it.takeaway || it.caption),
      })),
    });
  }
  if (p.insights && (p.insights.chapters || []).length) {
    tabs.push({
      key: "insights", label: "Insights",
      intro: firstLine(p.insights.intro, 150) ||
        "What a second pass over the paper turns up, reading across it rather than through it.",
      rows: p.insights.chapters.map((ch) => ({
        href: readHref(pid, "#/insights#ch-" + encodeURIComponent(ch.id)),
        name: ch.title,
        line: firstLine(ch.body),
      })),
    });
  }
  if (!tabs.length) return "";

  const uid = pid.replace(/[^a-z0-9]/gi, "-");
  let h = '<div class="panels" data-panels="' + esc(uid) + '">';
  h += '<div class="tabs" role="tablist" aria-label="What is inside this paper">' +
    tabs.map((t, i) => '<button type="button" class="tab" role="tab" id="tab-' + uid + "-" + t.key +
      '" aria-controls="panel-' + uid + "-" + t.key + '" aria-selected="' + (i === 0) + '"' +
      (i === 0 ? "" : ' tabindex="-1"') + ">" + esc(t.label) +
      (t.n ? '<span class="tab-n">' + t.n + "</span>" : "") + "</button>").join("") + "</div>";

  h += tabs.map((t, i) =>
    '<div class="panel" role="tabpanel" id="panel-' + uid + "-" + t.key +
    '" aria-labelledby="tab-' + uid + "-" + t.key + '"' + (i === 0 ? "" : " hidden") + ">" +
    '<p class="panel-intro">' + esc(t.intro) + "</p>" +
    '<ul class="entries">' + t.rows.map((r) => {
      const body = '<span class="ent-name">' + esc(r.name) +
        (r.meta ? '<span class="ent-meta">' + esc(r.meta) + "</span>" : "") + "</span>" +
        (r.line ? '<span class="ent-line">' + esc(r.line) + "</span>" : "");
      return "<li>" + (r.href
        ? '<a class="entry" href="' + r.href + '">' + body + "</a>"
        : '<span class="entry">' + body + "</span>") + "</li>";
    }).join("") + "</ul>" +
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
  h += '<button type="button" class="ask" data-id="' + esc(pid) + '" data-title="' +
    esc(r.title || pid) + '">Ask for a full read</button>';
  return h + "</li>";
}

/* ---------- asking for a paper ---------- */

/* One form, two ways in: a paper already on the shelf, asked to be read in
   full, or one nobody has touched. Requests are private — nothing about them
   comes back to the page. */
function proposeSection() {
  let h = '<section class="shelf" id="propose">';
  h += '<h2 class="section-head"><span>Propose a paper</span></h2>';
  h += '<p class="section-note">Anything that is not on the shelf. Send the link and say what you ' +
    'want out of it — what a read would have to explain for the paper to land.</p>';

  h += '<form class="ask-form" id="ask-form" novalidate>';
  h += '<p class="ask-target" id="ask-target" hidden></p>';
  h += '<div class="field" id="field-paper">' +
    '<label for="f-paper">The paper</label>' +
    '<input id="f-paper" name="paper" type="text" autocomplete="off" ' +
    'placeholder="arxiv.org/abs/1810.04805 — a link, an id, or just the title"></div>';
  h += '<div class="field">' +
    '<label for="f-note">What you want explained</label>' +
    '<textarea id="f-note" name="note" rows="3" ' +
    'placeholder="The part you keep bouncing off, or why it is worth the depth."></textarea></div>';
  h += '<div class="field-row">' +
    '<div class="field"><label for="f-name">Your name <span class="opt">optional</span></label>' +
    '<input id="f-name" name="name" type="text" autocomplete="name"></div>' +
    '<div class="field"><label for="f-email">Email <span class="opt">optional</span></label>' +
    '<input id="f-email" name="email" type="email" autocomplete="email"></div></div>';
  h += '<p class="field-note">An address is only ever used to tell you the read is up.</p>';
  h += '<input class="hp" id="f-website" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">';
  h += '<div class="ask-actions"><button class="door door-main" type="submit" id="ask-send">Send it</button>' +
    '<p class="form-msg" id="form-msg" role="status"></p></div>';
  h += "</form></section>";
  return h;
}

function wireAsk(root) {
  const form = el("ask-form");
  if (!form) return;
  const target = el("ask-target");
  const paperField = el("field-paper");
  const msg = el("form-msg");
  const send = el("ask-send");
  let asking = null;

  const say = (text, kind) => {
    msg.textContent = text || "";
    msg.className = "form-msg" + (kind ? " " + kind : "");
  };
  const clearTarget = () => {
    asking = null;
    target.hidden = true;
    target.innerHTML = "";
    paperField.hidden = false;
  };

  root.querySelectorAll("button.ask").forEach((b) => {
    b.addEventListener("click", () => {
      asking = { id: b.dataset.id, title: b.dataset.title };
      target.hidden = false;
      target.innerHTML = '<span class="ask-label">Asking for a full read of</span>' +
        '<strong>' + esc(asking.title) + "</strong>" +
        '<span class="ask-id">' + esc(asking.id) + "</span>" +
        '<button type="button" class="ask-clear">propose a different paper</button>';
      paperField.hidden = true;
      el("f-paper").value = "";
      say("");
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      el("f-note").focus({ preventScroll: true });
    });
  });

  target.addEventListener("click", (ev) => {
    if (ev.target.closest(".ask-clear")) { clearTarget(); el("f-paper").focus(); }
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const paper = el("f-paper").value.trim();
    if (!paper && !asking) {
      say("Name a paper first — a link, an arXiv id, or the title.", "bad");
      el("f-paper").focus();
      return;
    }
    send.disabled = true;
    say("Sending…");
    try {
      const res = await fetch("/api/request-paper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          paper: paper,
          note: el("f-note").value,
          name: el("f-name").value,
          email: el("f-email").value,
          website: el("f-website").value,
          forPaperId: asking ? asking.id : "",
          forPaperTitle: asking ? asking.title : "",
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "That did not go through.");
      form.reset();
      clearTarget();
      say("Filed. Thank you — it goes in the queue by hand, not automatically.", "good");
    } catch (err) {
      say(err instanceof TypeError
        ? "No connection to the request box. It only runs on the deployed site."
        : (err.message || "That did not go through."), "bad");
    } finally {
      send.disabled = false;
    }
  });
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
    h += '<h2 class="section-head"><span>Up for a full read</span><span class="section-n">' + narrow.length + "</span></h2>";
    h += '<p class="section-note">Each of these was opened for one mechanism and closed again — ' +
      'the concepts below are all that was taken. Any of them could be read end to end next. ' +
      '<strong>Ask for the one you want, or propose a paper that is not here at all.</strong></p>';
    h += '<ol class="narrow-list">' + narrow.map(narrowRow).join("") + "</ol>";
    h += "</section>";
  }

  h += proposeSection();

  h += '<footer class="site-foot"><p>Generated from the PDFs in <code>papers/</code>. ' +
    'Nothing here is written by hand.</p></footer>';

  el("home").innerHTML = h;
  wireTabs(el("home"));
  wireAsk(el("home"));
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
