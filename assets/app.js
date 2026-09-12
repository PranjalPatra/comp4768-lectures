// Course codelabs — slide navigation, notes panel, present mode.
// No framework, no build step, just DOM. No timing/pacing logic on
// purpose -- that's the instructor's call, not this script's.
(function () {
  "use strict";

  // --- theme toggle: light (Solarized/MUN) <-> dark, persisted, and wired
  // up before the early return below so it works on every page (the course
  // index has no slides, but it still gets the toggle). The inline script
  // in <head> already set data-theme once, before first paint; this just
  // makes the button change it afterward. ---------------------------------
  var THEME_KEY = "codelabs:theme";
  var btnTheme = document.getElementById("btn-theme");

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }
  function markTheme() {
    // the CSS reads data-theme directly to slide the switch's thumb --
    // this just keeps the button's a11y state in sync.
    if (btnTheme) btnTheme.setAttribute("aria-pressed", currentTheme() === "dark" ? "true" : "false");
  }
  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    markTheme();
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* ignore */ }
  }
  markTheme();
  if (btnTheme) btnTheme.addEventListener("click", function () {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === "t" || e.key === "T" || e.key === "d" || e.key === "D") setTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  // --- content mode: Slides / Workbook / Workbook + Solutions -------------
  // Orthogonal to present mode below: this picks *what* shows (teaching
  // content only, + questions, or + questions and answers); present mode
  // just strips chrome and goes full screen for whichever mode is active.
  var MODE_KEY = "codelabs:mode";
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-mode-btn]"));

  function currentMode() {
    var m = document.documentElement.getAttribute("data-mode");
    return (m === "workbook" || m === "answers") ? m : "slides";
  }
  // The slide navigator subscribes here. Which slides exist depends on the
  // mode: a practice slide is all questions, and questions are not projected,
  // so in Slides mode it is not part of the deck at all.
  var modeListeners = [];
  function setMode(mode) {
    if (mode !== "workbook" && mode !== "answers") mode = "slides";
    document.documentElement.setAttribute("data-mode", mode);
    modeButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-mode-btn") === mode);
    });
    try { localStorage.setItem(MODE_KEY, mode); } catch (e) { /* ignore */ }
    modeListeners.forEach(function (fn) { fn(mode); });
  }
  modeButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setMode(btn.getAttribute("data-mode-btn"));
    });
  });
  setMode(currentMode());

  // --- reading font size: Small / Medium / Large, non-present view only --
  // Present mode always uses its own fixed, larger sizes (see style.css)
  // regardless of this setting -- it only affects the normal reading view.
  var FONT_KEY = "codelabs:fontsize";
  var fontButtons = Array.prototype.slice.call(document.querySelectorAll("[data-font-btn]"));

  function currentFontSize() {
    var f = document.documentElement.getAttribute("data-font-size");
    return (f === "small" || f === "large") ? f : "medium";
  }
  function setFontSize(size) {
    if (size !== "small" && size !== "large") size = "medium";
    document.documentElement.setAttribute("data-font-size", size);
    fontButtons.forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-font-btn") === size);
    });
    try { localStorage.setItem(FONT_KEY, size); } catch (e) { /* ignore */ }
  }
  fontButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setFontSize(btn.getAttribute("data-font-btn"));
    });
  });
  setFontSize(currentFontSize());

  var steps = Array.prototype.slice.call(document.querySelectorAll(".step"));
  var notes = Array.prototype.slice.call(document.querySelectorAll(".note"));
  var sidebarItems = Array.prototype.slice.call(document.querySelectorAll(".sidebar__item"));
  var btnNext = document.getElementById("btn-next");
  var btnBack = document.getElementById("btn-back");
  var btnNotes = document.getElementById("btn-notes");
  var btnNotesClose = document.getElementById("btn-notes-close");
  var btnPresent = document.getElementById("btn-present");
  var btnSidebarToggle = document.getElementById("btn-sidebar-toggle");
  var sidebarScrim = document.getElementById("sidebar-scrim");
  var counterEl = document.getElementById("counter");
  var arcEl = document.getElementById("arc");
  var arcNames = window.__ARC_NAMES__ || [];

  // --- mobile sidebar drawer ------------------------------------------------
  // Below the mobile breakpoint the sidebar is an off-canvas drawer (see
  // style.css) rather than a column pushing the slide down the page, opened
  // by the hamburger button in the topbar and closed by the scrim, Escape, or
  // picking a slide. Above that breakpoint the sidebar is always visible and
  // this state has no CSS to act on, so toggling it here stays harmless.
  function setSidebarOpen(open) {
    document.body.classList.toggle("sidebar-open", open);
    if (btnSidebarToggle) btnSidebarToggle.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (btnSidebarToggle) btnSidebarToggle.addEventListener("click", function () {
    setSidebarOpen(!document.body.classList.contains("sidebar-open"));
  });
  if (sidebarScrim) sidebarScrim.addEventListener("click", function () { setSidebarOpen(false); });

  if (steps.length === 0) return; // slide-nav below doesn't apply to e.g. the course index

  var storageKey = "codelabs:" + location.pathname;
  var current = 0;

  // A practice slide is nothing but exercises, and exercises are not
  // projected, so in Slides mode it would be a title over a blank page. It is
  // left out of the deck entirely -- the same slide build_pdf.py declines to
  // project -- and reappears the moment you switch to Workbook or Answers.
  function isHidden(i) {
    return currentMode() === "slides" && steps[i].hasAttribute("data-practice");
  }

  function visible() {
    var out = [];
    for (var i = 0; i < steps.length; i++) if (!isHidden(i)) out.push(i);
    return out;
  }

  function clamp(i) {
    var vis = visible();
    if (!vis.length) return 0;
    var best = vis[0];
    for (var k = 0; k < vis.length; k++) {
      if (Math.abs(vis[k] - i) < Math.abs(best - i)) best = vis[k];
    }
    return best;
  }

  // Movement is by one *visible* slide, not one index, so Next never lands on
  // a slide this mode doesn't have.
  function move(delta) {
    var vis = visible();
    var pos = vis.indexOf(current);
    if (pos === -1) { goTo(current); return; }
    current = vis[Math.max(0, Math.min(vis.length - 1, pos + delta))];
    render();
  }

  function render() {
    var vis = visible();
    var pos = vis.indexOf(current);
    steps.forEach(function (el, i) {
      el.classList.toggle("is-active", i === current);
    });
    notes.forEach(function (el, i) {
      el.classList.toggle("is-active", i === current);
    });
    sidebarItems.forEach(function (el, i) {
      el.classList.toggle("is-active", i === current);
      el.classList.toggle("is-done", i < current);
      el.classList.toggle("is-hidden", isHidden(i));
      // Numbered by what is on screen, so Slides mode counts 1..n with no
      // gaps where the practice slides were taken out.
      var bullet = el.querySelector(".sidebar__bullet");
      if (bullet) {
        var p = vis.indexOf(i);
        bullet.textContent = p === -1 ? "" : String(p + 1);
      }
    });
    if (btnBack) btnBack.disabled = pos <= 0;
    if (btnNext) {
      var atEnd = pos === vis.length - 1;
      btnNext.textContent = atEnd ? "Done" : "Next";
      btnNext.disabled = atEnd;
    }
    if (counterEl) {
      counterEl.textContent = (pos + 1) + " / " + vis.length;
    }
    if (arcEl) {
      arcEl.textContent = arcNames[current] || "";
    }
    var activeSidebarItem = sidebarItems[current];
    if (activeSidebarItem && activeSidebarItem.scrollIntoView) {
      activeSidebarItem.scrollIntoView({ block: "nearest" });
    }
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    try {
      localStorage.setItem(storageKey, String(current));
    } catch (e) {
      /* localStorage unavailable (e.g. file:// in some browsers) -- fine, just skip persistence */
    }
  }

  function goTo(index) {
    current = clamp(index);
    render();
  }

  sidebarItems.forEach(function (el, i) {
    el.addEventListener("click", function () {
      goTo(i);
      setSidebarOpen(false);
    });
  });

  if (btnNext) btnNext.addEventListener("click", function () { move(1); });
  if (btnBack) btnBack.addEventListener("click", function () { move(-1); });

  // Switching mode changes which slides exist. If the one you were reading is
  // not in the new mode, step to the nearest one that is.
  modeListeners.push(function () {
    if (isHidden(current)) current = clamp(current);
    render();
  });

  // --- notes panel: expanded, read-it-later material -----------------------
  // Docked rather than overlaid, and its open state is remembered, so once
  // it's opened it stays open -- across slides and across visits -- until
  // it's deliberately closed. A course can remove it entirely by setting
  // "ai_explanation": false in course.json, in which case the button and
  // the panel are never emitted and there is nothing here to toggle.
  var NOTES_OPEN_KEY = "codelabs:notes-open";
  var notesPanel = document.getElementById("notes-panel");

  function setNotesOpen(open, remember) {
    if (!notesPanel) return;
    document.body.classList.toggle("notes-open", open);
    if (remember === false) return;
    try { localStorage.setItem(NOTES_OPEN_KEY, open ? "1" : "0"); } catch (e) { /* ignore */ }
  }
  function notesOpen() {
    return document.body.classList.contains("notes-open");
  }
  if (btnNotes) btnNotes.addEventListener("click", function () { setNotesOpen(!notesOpen()); });
  if (btnNotesClose) btnNotesClose.addEventListener("click", function () { setNotesOpen(false); });

  if (notesPanel) {
    var savedNotesOpen = null;
    try { savedNotesOpen = localStorage.getItem(NOTES_OPEN_KEY); } catch (e) { /* ignore */ }
    if (savedNotesOpen === "1") setNotesOpen(true);
  }

  // --- drag-resizable sidebar and notes panel ------------------------------
  // Both widths are CSS custom properties, so a drag is just a number written
  // to the root element and the layout follows. Dragged narrow enough, the
  // sidebar snaps to a rail showing only slide numbers, which is a class
  // rather than a width so it can restore the width it had before.
  var WIDTH_KEY = "codelabs:widths";
  var SIDEBAR_MIN = 170;    // below this a two-line title stops being readable
  var SIDEBAR_MAX = 460;
  var SIDEBAR_SNAP = 130;   // drag past this and it collapses to the rail
  var NOTES_MIN = 280;
  var NOTES_MAX = 760;

  var root = document.documentElement;
  var widths = { sidebar: null, notes: null, collapsed: false };

  function saveWidths() {
    try { localStorage.setItem(WIDTH_KEY, JSON.stringify(widths)); } catch (e) { /* ignore */ }
  }
  function applyWidths() {
    if (widths.sidebar) root.style.setProperty("--sidebar-w", widths.sidebar + "px");
    if (widths.notes) root.style.setProperty("--notes-w", widths.notes + "px");
    document.body.classList.toggle("sidebar-collapsed", !!widths.collapsed);
  }
  try {
    var savedWidths = JSON.parse(localStorage.getItem(WIDTH_KEY) || "null");
    if (savedWidths && typeof savedWidths === "object") {
      widths.sidebar = Number(savedWidths.sidebar) || null;
      widths.notes = Number(savedWidths.notes) || null;
      widths.collapsed = !!savedWidths.collapsed;
    }
  } catch (e) { /* ignore */ }
  applyWidths();

  function clampWidth(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  // `measure` turns a pointer x into a candidate width: the sidebar grows
  // rightward from the viewport's left edge, the notes panel grows leftward
  // from its right edge.
  function makeResizer(handle, measure, commit) {
    if (!handle) return;
    handle.addEventListener("pointerdown", function (e) {
      if (document.body.classList.contains("present-mode")) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("is-dragging");
      document.body.classList.add("is-resizing");

      function onMove(ev) { commit(measure(ev.clientX)); }
      function onUp(ev) {
        handle.releasePointerCapture(ev.pointerId);
        handle.classList.remove("is-dragging");
        document.body.classList.remove("is-resizing");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        saveWidths();
      }
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });
  }

  var sidebarEl = document.getElementById("sidebar");
  var sidebarResizer = document.getElementById("sidebar-resizer");
  var notesResizer = document.getElementById("notes-resizer");

  makeResizer(
    sidebarResizer,
    function (x) { return x - (sidebarEl ? sidebarEl.getBoundingClientRect().left : 0); },
    function (raw) {
      if (raw < SIDEBAR_SNAP) {
        widths.collapsed = true;
      } else {
        widths.collapsed = false;
        widths.sidebar = clampWidth(raw, SIDEBAR_MIN, SIDEBAR_MAX);
      }
      applyWidths();
    }
  );

  makeResizer(
    notesResizer,
    function (x) { return window.innerWidth - x; },
    function (raw) {
      widths.notes = clampWidth(raw, NOTES_MIN, NOTES_MAX);
      applyWidths();
    }
  );

  // Double-click the handle to collapse or restore without aiming a drag.
  if (sidebarResizer) sidebarResizer.addEventListener("dblclick", function () {
    widths.collapsed = !widths.collapsed;
    applyWidths();
    saveWidths();
  });

  // Keyboard equivalent, so the handles aren't mouse-only.
  function resizerKeys(handle, get, set, step) {
    if (!handle) return;
    handle.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      e.stopPropagation();
      set(get() + (e.key === "ArrowRight" ? step : -step));
      saveWidths();
    });
  }
  resizerKeys(
    sidebarResizer,
    function () { return widths.collapsed ? SIDEBAR_SNAP - 1 : (widths.sidebar || 260); },
    function (v) {
      if (v < SIDEBAR_SNAP) { widths.collapsed = true; }
      else { widths.collapsed = false; widths.sidebar = clampWidth(v, SIDEBAR_MIN, SIDEBAR_MAX); }
      applyWidths();
    },
    20
  );
  resizerKeys(
    notesResizer,
    function () { return widths.notes || 420; },
    function (v) { widths.notes = clampWidth(v, NOTES_MIN, NOTES_MAX); applyWidths(); },
    -20
  );

  // --- present mode: hides chrome, requests full screen for projecting ----
  // Nothing adjustable survives in here: the explanation panel closes and
  // the drag handles go away. The panel's state before presenting is put
  // back on the way out, so presenting doesn't cost you your layout.
  var notesOpenBeforePresent = false;

  function setPresentMode(on) {
    var wasOn = document.body.classList.contains("present-mode");
    if (on && !wasOn) {
      notesOpenBeforePresent = notesOpen();
      setNotesOpen(false, false);
    } else if (!on && wasOn && notesOpenBeforePresent) {
      setNotesOpen(true, false);
    }
    document.body.classList.toggle("present-mode", on);
    if (btnPresent) btnPresent.textContent = on ? "Exit" : "Present";
    if (on && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () {
        /* fullscreen denied or unsupported -- the CSS class alone still helps */
      });
    } else if (!on && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
  }
  if (btnPresent) btnPresent.addEventListener("click", function () {
    setPresentMode(!document.body.classList.contains("present-mode"));
  });
  document.addEventListener("fullscreenchange", function () {
    if (!document.fullscreenElement && document.body.classList.contains("present-mode")) {
      document.body.classList.remove("present-mode");
      if (notesOpenBeforePresent) setNotesOpen(true, false);
      if (btnPresent) btnPresent.textContent = "Present";
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    // accept both the modern DOM key names and the legacy/IE-era ones some
    // remote-control clickers and automation tools still send
    if (e.key === "ArrowRight" || e.key === "Right" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      move(1);
    }
    if (e.key === "ArrowLeft" || e.key === "Left" || e.key === "PageUp") move(-1);
    if (e.key === "n" || e.key === "N") setNotesOpen(!notesOpen());
    if (e.key === "f" || e.key === "F") setPresentMode(!document.body.classList.contains("present-mode"));
    if (e.key === "s" || e.key === "S") setMode("slides");
    if (e.key === "w" || e.key === "W") setMode("workbook");
    if (e.key === "a" || e.key === "A") setMode("answers");
    // Escape leaves present mode and closes the mobile drawer if open. The
    // explanation panel is a docked part of the layout, not a modal, so it
    // stays until it's closed on purpose and Escape leaves it alone.
    if (e.key === "Escape") { setPresentMode(false); setSidebarOpen(false); }
  });

  // restore progress from a previous visit, if any
  var saved = null;
  try {
    saved = localStorage.getItem(storageKey);
  } catch (e) {
    /* ignore */
  }
  var initial = saved !== null ? parseInt(saved, 10) : 0;
  goTo(isNaN(initial) ? 0 : initial);
})();
