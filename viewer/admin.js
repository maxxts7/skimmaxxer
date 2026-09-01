/* The request book: everything readers have asked to be read, newest first.

   Guarded by one shared password, checked by the admin-requests function
   against ADMIN_PASSWORD. The password is held for the tab only, never stored
   on disk, and nothing here is visible to a reader. */
"use strict";

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const el = (id) => document.getElementById(id);
const KEY = "skim-admin";

const held = () => {
  try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; }
};
const hold = (v) => {
  try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch (e) { /* fine */ }
};

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/* ---------- views ---------- */

function askForPassword(note) {
  el("admin").innerHTML =
    '<section class="hero"><div class="hero-text">' +
    '<p class="eyebrow">Admin</p><h1>The request book.</h1>' +
    '<p class="lede">Everything readers have asked to be read, newest first.</p>' +
    '<form class="ask-form" id="gate" style="max-width:22rem">' +
    '<div class="field"><label for="pw">Password</label>' +
    '<input id="pw" type="password" autocomplete="current-password" autofocus></div>' +
    '<div class="ask-actions"><button class="door door-main" type="submit">Open</button>' +
    '<p class="form-msg' + (note ? " bad" : "") + '" id="gate-msg">' + esc(note || "") + "</p></div>" +
    "</form></div></section>";
  el("gate").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const pw = el("pw").value;
    if (!pw) return;
    hold(pw);
    load();
  });
}

function requestCard(r) {
  const asked = r.forPaperId
    ? '<p class="req-what"><span class="req-kind">Full read</span>' + esc(r.forPaperTitle || r.forPaperId) +
      '<span class="ask-id">' + esc(r.forPaperId) + "</span></p>"
    : '<p class="req-what"><span class="req-kind new">New paper</span>' + esc(r.paper) + "</p>";

  let who = [];
  if (r.name) who.push(esc(r.name));
  if (r.email) who.push('<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a>");

  return '<article class="req">' +
    '<p class="req-when">' + esc(when(r.createdAt)) + "</p>" +
    asked +
    (r.note ? '<p class="req-note">' + esc(r.note) + "</p>" : "") +
    (who.length ? '<p class="req-who">' + who.join('<span class="dot">·</span>') + "</p>" : "") +
    "</article>";
}

function render(requests) {
  const full = requests.filter((r) => r.forPaperId).length;
  let h = '<section class="hero"><div class="hero-text">';
  h += '<p class="eyebrow">Admin</p><h1>The request book.</h1>';
  h += '<p class="tally">' + requests.length + " in all · " + full +
    " for a paper on the shelf · " + (requests.length - full) + " proposed</p>";
  h += "</div></section>";

  h += '<section class="shelf"><h2 class="section-head"><span>Requests</span>' +
    '<span class="section-n">' + requests.length + "</span></h2>";
  h += requests.length
    ? '<div class="req-list">' + requests.map(requestCard).join("") + "</div>"
    : '<p class="section-note">Nothing yet. The form on the library page files them here.</p>';
  h += "</section>";

  h += '<footer class="site-foot"><p><button class="link-btn" id="forget">Forget the password</button>' +
    ' · <a href="papers.html">Back to the library</a></p></footer>';

  el("admin").innerHTML = h;
  el("forget").addEventListener("click", () => { hold(""); askForPassword(""); });
}

/* ---------- data ---------- */

async function load() {
  const pw = held();
  if (!pw) return askForPassword("");
  el("admin").innerHTML = '<section class="hero"><div class="hero-text">' +
    '<p class="eyebrow">Admin</p><h1>Reading the book…</h1></div></section>';
  try {
    const res = await fetch("/api/admin-requests", { headers: { authorization: "Bearer " + pw } });
    const out = await res.json().catch(() => ({}));
    if (res.status === 401) { hold(""); return askForPassword("Wrong password."); }
    if (!res.ok) throw new Error(out.error || "The requests could not be read.");
    render(out.requests || []);
  } catch (err) {
    hold("");
    askForPassword(err instanceof TypeError
      ? "No connection to the request box. This page only works on the deployed site."
      : (err.message || "Something went wrong."));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  SkimTheme.mount(el("theme-toggle"));
  load();
});
