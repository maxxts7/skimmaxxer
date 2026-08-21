/* Theme state, shared by the library and the reader shells.
   Three states: system (no attribute), light, dark. Applied at load time so a
   dark reader never sees a white flash. */
"use strict";

window.SkimTheme = (function () {
  var KEY = "skim-theme";
  var OLD_KEY = "sr-theme";        // the name before Skimmaxxer

  function current() {
    try { return localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY) || "system"; }
    catch (e) { return "system"; }
  }
  function apply(v) {
    if (v === "light" || v === "dark") document.documentElement.setAttribute("data-theme", v);
    else document.documentElement.removeAttribute("data-theme");
  }
  function cycle() {
    var next = { system: "light", light: "dark", dark: "system" }[current()];
    try {
      if (next === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, next);
    } catch (e) { /* private mode: the choice just does not persist */ }
    apply(next);
    return next;
  }
  function label() { return "theme: " + current(); }

  apply(current());
  return { current: current, apply: apply, cycle: cycle, label: label };
})();
