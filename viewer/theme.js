/* Theme state, shared by the library and the reader shells.
   Three states: system (no attribute), light, dark. Applied at load time so a
   dark reader never sees a white flash. */
"use strict";

window.SkimTheme = (function () {
  var KEY = "skim-theme";
  var OLD_KEY = "sr-theme";        // the name before Skimmaxxer

  /* The control says which state is on, not which one is next, and says it in a
     mark rather than a word: a sun for light, a moon for dark, a disc half in
     each for the state that follows the system. The word is not lost - it stays
     as the button's name, so a hover and a screen reader still get "theme:
     dark". One stroke weight, one size, currentColor throughout, so the mark
     takes the rail's ink and its hover with it. */
  var MARKS = {
    light:
      '<circle cx="12" cy="12" r="4.1"/>' +
      '<path d="M12 2.7v2.1M12 19.2v2.1M4.4 4.4l1.5 1.5M18.1 18.1l1.5 1.5' +
      'M2.7 12h2.1M19.2 12h2.1M4.4 19.6l1.5-1.5M18.1 5.9l1.5-1.5"/>',
    dark:
      '<path d="M20.4 14.5A8.6 8.6 0 0 1 9.5 3.6a8.6 8.6 0 1 0 10.9 10.9Z"/>',
    system:
      '<circle cx="12" cy="12" r="8.5"/>' +
      '<path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none"/>'
  };

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

  function icon(v) {
    return '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" ' +
      'focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + MARKS[v] + "</svg>";
  }

  /* Draw the button in the state it is in. */
  function paint(btn) {
    if (!btn) return;
    btn.innerHTML = icon(current());
    btn.setAttribute("aria-label", label());
    btn.setAttribute("title", label());
  }

  /* Draw it and wire it, so the four shells that carry the toggle carry the
     same one rather than four copies of it. */
  function mount(btn) {
    if (!btn) return;
    paint(btn);
    btn.addEventListener("click", function () { cycle(); paint(btn); });
  }

  apply(current());
  return { current: current, apply: apply, cycle: cycle, label: label, paint: paint, mount: mount };
})();
