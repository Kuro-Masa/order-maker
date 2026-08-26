(function () {
  "use strict";

  var STORAGE_KEY = "narabikae_state_v3";

  var PALETTE = [
    "#a9d6a5",
    "#a9c9e8",
    "#d3a9d6",
    "#f0da8a",
    "#e8a9a9",
    "#f0c08a",
    "#a9e0d6",
    "#cfd3da"
  ];

  var PART_SCHEMES = {
    "4": [
      { key: "Sop", color: "#f5c28a" },
      { key: "Alt", color: "#cbaee0" },
      { key: "Ten", color: "#9dc0e8" },
      { key: "Bas", color: "#a3d9a0" }
    ],
    "6": [
      { key: "Sop", color: "#f5c28a" },
      { key: "Mez", color: "#e8a8c0" },
      { key: "Alt", color: "#cbaee0" },
      { key: "Ten", color: "#9dc0e8" },
      { key: "Bar", color: "#8cc4b8" },
      { key: "Bas", color: "#a3d9a0" }
    ],
    "8": [
      { key: "Sop1", color: "#f2b0a3" },
      { key: "Sop2", color: "#f5e3a3" },
      { key: "Alt1", color: "#e3d2ef" },
      { key: "Alt2", color: "#9b6bb3" },
      { key: "Ten1", color: "#c9dff2" },
      { key: "Ten2", color: "#5f8fc4" },
      { key: "Bas1", color: "#c8ecc4" },
      { key: "Bas2", color: "#5fa85c" }
    ]
  };

  var CELL_TEXT_COLOR = "#1f2430";
  var DEFAULT_ROW_COUNT = 4;
  var DEFAULT_COL_COUNT = 6;
  var DEFAULT_GAP_CELLS = 0.25;
  var CELL_W = 44;
  var CELL_H = 52;
  var GAP_X = 2;
  var GAP_Y = 10;
  var GRID_PAD_LEFT = 4;
  var RISER_PAD = 8;
  var RISER_COLOR = "#d9c7a8";
  var RISER_BORDER = "#b3987a";
  var LINE_COLOR = "#d98c3c";
  var CENTER_LINE_COLOR = "#333333";

  var state = {
    patterns: [], // [{ id, name, rows: [{ segments: [n,...], gaps: [cellUnits,...], cells: [{name, color}, ...] }] }]
    activeId: null
  };

  var mode = "edit"; // "edit" | "swap" | "paint" | "line"
  var selected = null; // { r, c } flat cell index within row.cells
  var currentColor = PALETTE[0];
  var nextPatternNum = 1;

  // Fill these in from Firebase Console > Project settings > Your apps (Web app)
  // to enable share links. Until filled in, sharing features show a message instead.
  var firebaseConfig = {
    apiKey: "AIzaSyDlQrgeQXoDHlw9OlYM92Om5mnh9_qlwTY",
    authDomain: "order-maker-e0b6c.firebaseapp.com",
    projectId: "order-maker-e0b6c",
    storageBucket: "order-maker-e0b6c.firebasestorage.app",
    messagingSenderId: "347811601828",
    appId: "1:347811601828:web:3cb7b4abd5c81b8535b531"
  };
  var db = null;
  var shareUnsubscribe = null;
  var shareListenerPatternId = null;
  var shareWriteTimer = null;

  var el = {
    tabBar: document.getElementById("tabBar"),
    menuBtn: document.getElementById("menuBtn"),
    menuPanel: document.getElementById("menuPanel"),
    renamePatternBtn: document.getElementById("renamePatternBtn"),
    deletePatternBtn: document.getElementById("deletePatternBtn"),
    shareBtn: document.getElementById("shareBtn"),
    refreshShareBtn: document.getElementById("refreshShareBtn"),
    modeEditBtn: document.getElementById("modeEditBtn"),
    modeSwapBtn: document.getElementById("modeSwapBtn"),
    modePaintBtn: document.getElementById("modePaintBtn"),
    modeLineBtn: document.getElementById("modeLineBtn"),
    showCenterLineCheckbox: document.getElementById("showCenterLineCheckbox"),
    linesList: document.getElementById("linesList"),
    clearBtn: document.getElementById("clearBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    importCsvInput: document.getElementById("importCsvInput"),
    exportJsonBtn: document.getElementById("exportJsonBtn"),
    importJsonInput: document.getElementById("importJsonInput"),
    exportImageBtn: document.getElementById("exportImageBtn"),
    grid: document.getElementById("grid"),
    palette: document.getElementById("palette"),
    hint: document.getElementById("hint"),
    rowsList: document.getElementById("rowsList"),
    addRowBtn: document.getElementById("addRowBtn"),
    cellTotalSummary: document.getElementById("cellTotalSummary"),
    showConductorCheckbox: document.getElementById("showConductorCheckbox"),
    partSchemeSelect: document.getElementById("partSchemeSelect"),
    partCountsList: document.getElementById("partCountsList"),
    partNoneNote: document.getElementById("partNoneNote"),
    partTotalSummary: document.getElementById("partTotalSummary"),
    autoColorBtn: document.getElementById("autoColorBtn")
  };

  // ---- id / pattern helpers ----

  function makeId() {
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function getActivePattern() {
    var found = state.patterns.find(function (p) {
      return p.id === state.activeId;
    });
    return found || state.patterns[0];
  }

  function createRow(segments, gaps) {
    var total = segmentsTotal(segments);
    var cells = [];
    for (var i = 0; i < total; i++) {
      cells.push({ name: "", color: null });
    }
    var normalizedGaps = gaps ? gaps.slice() : segments.slice(1).map(function () {
      return DEFAULT_GAP_CELLS;
    });
    return { segments: segments.slice(), gaps: normalizedGaps, cells: cells, onRiser: false };
  }

  function rowOnRiser(row) {
    return !!row.onRiser;
  }

  function getGapCells(row, i) {
    return row.gaps && row.gaps[i] !== undefined ? row.gaps[i] : DEFAULT_GAP_CELLS;
  }

  function gapCellsToPx(n) {
    return n * CELL_W + Math.max(0, n - 1) * GAP_X;
  }

  function getGapPx(row, i) {
    return gapCellsToPx(getGapCells(row, i));
  }

  function rowContentWidthPx(row) {
    var w = 0;
    row.segments.forEach(function (segLen, i) {
      if (i > 0) w += getGapPx(row, i - 1);
      w += segLen * CELL_W + (segLen - 1) * GAP_X;
    });
    return w;
  }

  function maxRowWidthPx(pattern) {
    return pattern.rows.reduce(function (max, row) {
      return Math.max(max, rowContentWidthPx(row));
    }, 0);
  }

  function createPattern(name, rowCount, colCount) {
    var rows = [];
    for (var i = 0; i < rowCount; i++) {
      rows.push(createRow([colCount]));
    }
    return {
      id: makeId(),
      name: name,
      rows: rows,
      partSettings: { scheme: "4", counts: {} },
      showConductor: true,
      showCenterLine: false,
      lines: [],
      shareId: null
    };
  }

  function showsConductor(pattern) {
    return pattern.showConductor !== false;
  }

  function showsCenterLine(pattern) {
    return !!pattern.showCenterLine;
  }

  function ensureLines(pattern) {
    if (!Array.isArray(pattern.lines)) pattern.lines = [];
    return pattern.lines;
  }

  function makeLineId() {
    return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  function ensurePartSettings(pattern) {
    if (!pattern.partSettings) {
      pattern.partSettings = { scheme: "4", counts: {} };
    }
    return pattern.partSettings;
  }

  function getActivePalette(pattern) {
    var settings = ensurePartSettings(pattern);
    if (settings.scheme === "none" || !PART_SCHEMES[settings.scheme]) {
      return PALETTE.map(function (color) {
        return { key: null, color: color };
      });
    }
    return PART_SCHEMES[settings.scheme];
  }

  function addPattern() {
    nextPatternNum = state.patterns.length + 1;
    var pattern = createPattern("パターン" + nextPatternNum, DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT);
    state.patterns.push(pattern);
    state.activeId = pattern.id;
    selected = null;
    saveState();
    render();
  }

  function deleteActivePattern() {
    if (state.patterns.length <= 1) {
      alert("最後の1つは削除できません");
      return;
    }
    if (!confirm("「" + getActivePattern().name + "」を削除しますか?")) return;
    var idx = state.patterns.findIndex(function (p) {
      return p.id === state.activeId;
    });
    var removedId = state.patterns[idx].id;
    state.patterns.splice(idx, 1);
    var next = state.patterns[Math.max(0, idx - 1)];
    state.activeId = next.id;
    selected = null;
    if (shareListenerPatternId === removedId && shareUnsubscribe) {
      shareUnsubscribe();
      shareUnsubscribe = null;
      shareListenerPatternId = null;
    }
    saveState();
    render();
  }

  function switchPattern(id) {
    if (id === state.activeId) return;
    state.activeId = id;
    selected = null;
    saveState();
    render();
    var pattern = getActivePattern();
    if (pattern.shareId) {
      ensureShareListener(pattern);
    } else if (shareUnsubscribe) {
      shareUnsubscribe();
      shareUnsubscribe = null;
      shareListenerPatternId = null;
    }
  }

  function renameActivePattern() {
    var pattern = getActivePattern();
    var name = prompt("パターン名を入力してください", pattern.name);
    if (name === null) return;
    pattern.name = name.trim() || pattern.name;
    saveState();
    renderTabs();
  }

  // ---- row helpers (operate on active pattern) ----

  function parseRowSpec(text) {
    var tokens = String(text || "")
      .split(/[,+\s]+/)
      .filter(function (s) {
        return s.length > 0;
      });
    var segments = [];
    var gaps = [];
    var currentSum = 0;
    var hasCurrent = false;

    function flushSegment() {
      if (hasCurrent) {
        segments.push(currentSum);
        currentSum = 0;
        hasCurrent = false;
      }
    }

    tokens.forEach(function (tok) {
      var gapMatch = /^E(\d*\.?\d+)$/i.exec(tok);
      if (gapMatch) {
        flushSegment();
        gaps.push(Math.max(0, parseFloat(gapMatch[1])));
        return;
      }
      var n = parseInt(tok, 10);
      if (!Number.isFinite(n) || n <= 0) return;
      currentSum += n;
      hasCurrent = true;
    });
    flushSegment();

    if (segments.length === 0) segments = [1];
    while (gaps.length > segments.length - 1) gaps.pop();
    while (gaps.length < segments.length - 1) gaps.push(DEFAULT_GAP_CELLS);

    return { segments: segments, gaps: gaps };
  }

  function formatGapCells(n) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  function serializeRowSpec(row) {
    var parts = [];
    row.segments.forEach(function (segLen, i) {
      if (i > 0) parts.push("E" + formatGapCells(getGapCells(row, i - 1)));
      parts.push(String(segLen));
    });
    return parts.join(",");
  }

  function segmentsTotal(segments) {
    return segments.reduce(function (a, b) {
      return a + b;
    }, 0);
  }

  function regenerateRowCells(row, newSegments, newGaps) {
    var total = segmentsTotal(newSegments);
    var newCells = [];
    for (var i = 0; i < total; i++) {
      newCells.push(row.cells[i] || { name: "", color: null });
    }
    row.segments = newSegments;
    row.gaps = newGaps;
    row.cells = newCells;
  }

  // ---- persistence ----

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.patterns) || parsed.patterns.length === 0) return false;
      state.patterns = parsed.patterns;
      state.activeId = parsed.activeId || parsed.patterns[0].id;
      if (!state.patterns.some(function (p) { return p.id === state.activeId; })) {
        state.activeId = parsed.patterns[0].id;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveState(skipSharePush) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!skipSharePush) {
      var pattern = getActivePattern();
      if (pattern && pattern.shareId) {
        schedulePushShareUpdate(pattern);
      }
    }
  }

  // ---- rendering ----

  function render() {
    renderTabs();
    renderGrid();
    renderPalette();
    renderRowsList();
    renderLinesList();
    renderPartSettings();
    el.showConductorCheckbox.checked = showsConductor(getActivePattern());
    el.showCenterLineCheckbox.checked = showsCenterLine(getActivePattern());
    updateHint();
    updateModeButtons();
  }

  function renderTabs() {
    el.tabBar.innerHTML = "";
    state.patterns.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tabBtn" + (p.id === state.activeId ? " active" : "");
      btn.textContent = p.name || "無題";
      btn.addEventListener("click", function () {
        switchPattern(p.id);
      });
      el.tabBar.appendChild(btn);
    });

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tabBtn tabAddBtn";
    addBtn.textContent = "＋";
    addBtn.title = "新しいパターン";
    addBtn.addEventListener("click", addPattern);
    el.tabBar.appendChild(addBtn);
  }

  function renderGrid() {
    var pattern = getActivePattern();
    el.grid.innerHTML = "";
    var cellsWraps = [];

    pattern.rows.forEach(function (row, r) {
      var rowDiv = document.createElement("div");
      rowDiv.className = "row" + (r % 2 === 1 ? " offset" : "");

      var cellsWrap = document.createElement("div");
      cellsWrap.className = "cellsWrap";

      var cellIdx = 0;
      row.segments.forEach(function (segLen, segIdx) {
        if (segIdx > 0) {
          var gapPx = getGapPx(row, segIdx - 1);
          var spacer = document.createElement("div");
          spacer.className = "segmentGap";
          spacer.style.width = gapPx + "px";
          spacer.style.flex = "0 0 " + gapPx + "px";
          cellsWrap.appendChild(spacer);
        }
        for (var i = 0; i < segLen; i++) {
          cellsWrap.appendChild(createCellEl(row, r, cellIdx));
          cellIdx++;
        }
      });

      rowDiv.appendChild(cellsWrap);
      el.grid.appendChild(rowDiv);
      cellsWraps.push(cellsWrap);
    });

    if (showsConductor(pattern)) {
      var lastRowIsOffset = (pattern.rows.length - 1) % 2 === 1;
      var mark = document.createElement("div");
      mark.className = "conductorMark" + (lastRowIsOffset ? " offset" : "");
      mark.textContent = "指揮";
      mark.title = "指揮者(この位置が前)";
      el.grid.appendChild(mark);
    }

    renderRiserBackgrounds(pattern, cellsWraps);
    renderLines(pattern, cellsWraps);
  }

  function renderRiserBackgrounds(pattern, cellsWraps) {
    if (cellsWraps.length === 0) return;
    var gridRect = el.grid.getBoundingClientRect();

    // Every riser shares one common span wide enough to contain every row
    // (including staggered ones), so all platforms line up and match width.
    var minLeft = Infinity;
    var maxRight = -Infinity;
    cellsWraps.forEach(function (w) {
      var r = w.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left - gridRect.left);
      maxRight = Math.max(maxRight, r.right - gridRect.left);
    });
    var left = minLeft - RISER_PAD;
    var width = maxRight - minLeft + RISER_PAD * 2;

    var i = 0;
    while (i < pattern.rows.length) {
      if (!rowOnRiser(pattern.rows[i])) {
        i++;
        continue;
      }
      var start = i;
      while (i < pattern.rows.length && rowOnRiser(pattern.rows[i])) i++;
      var end = i - 1;

      var startRect = cellsWraps[start].getBoundingClientRect();
      var endRect = cellsWraps[end].getBoundingClientRect();
      var top = startRect.top - gridRect.top - RISER_PAD;
      var bottom = endRect.bottom - gridRect.top + RISER_PAD;

      var bg = document.createElement("div");
      bg.className = "riserBg";
      bg.style.left = left + "px";
      bg.style.width = width + "px";
      bg.style.top = top + "px";
      bg.style.height = bottom - top + "px";
      el.grid.appendChild(bg);
    }
  }

  function renderLines(pattern, cellsWraps) {
    if (cellsWraps.length === 0) return;
    var gridRect = el.grid.getBoundingClientRect();

    // Align to the same center the conductor mark uses (row 0's unshifted
    // center, shifted to match the last row's parity), not the riser
    // background's full-extent span, so the two visually coincide.
    var row0Rect = cellsWraps[0].getBoundingClientRect();
    var row0Center = (row0Rect.left + row0Rect.right) / 2 - gridRect.left;
    var lastRowIsOffset = (pattern.rows.length - 1) % 2 === 1;
    var center = row0Center + (lastRowIsOffset ? CELL_W / 2 : 0);

    var firstRect = cellsWraps[0].getBoundingClientRect();
    var lastRect = cellsWraps[cellsWraps.length - 1].getBoundingClientRect();
    var top = firstRect.top - gridRect.top;
    var bottom = lastRect.bottom - gridRect.top;

    if (showsCenterLine(pattern)) {
      var centerLine = document.createElement("div");
      centerLine.className = "guideLine guideLineV centerLine";
      centerLine.style.left = center + "px";
      centerLine.style.top = top + "px";
      centerLine.style.height = bottom - top + "px";
      centerLine.appendChild(document.createElement("div")).className = "lineStrip";
      el.grid.appendChild(centerLine);
    }

    ensureLines(pattern).forEach(function (line) {
      var lineEl = document.createElement("div");
      lineEl.className = "guideLine guideLineV" + (mode === "line" ? " draggable" : "");
      lineEl.style.left = center + line.pos + "px";
      lineEl.style.top = top + "px";
      lineEl.style.height = bottom - top + "px";
      lineEl.appendChild(document.createElement("div")).className = "lineStrip";

      if (mode === "line") {
        makeLineDraggable(lineEl, line, center);
      }

      el.grid.appendChild(lineEl);
    });
  }

  function makeLineDraggable(lineEl, line, center) {
    var dragging = false;
    var startClientX = 0;
    var startPos = 0;

    lineEl.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    lineEl.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      startClientX = e.clientX;
      startPos = line.pos;
      lineEl.setPointerCapture(e.pointerId);
    });

    lineEl.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      line.pos = startPos + (e.clientX - startClientX);
      lineEl.style.left = center + line.pos + "px";
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      line.pos = Math.round(line.pos);
      saveState();
      renderLinesList();
    }
    lineEl.addEventListener("pointerup", endDrag);
    lineEl.addEventListener("pointercancel", endDrag);
  }

  var CELL_MAX_LENGTH = 10;
  var TRASH_ICON_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function createCellEl(row, r, c) {
    var cellData = row.cells[c];
    var input = document.createElement("div");
    input.className = "cell";
    input.textContent = cellData.name;
    input.spellcheck = false;
    if (cellData.color) {
      input.style.background = cellData.color;
      input.style.color = CELL_TEXT_COLOR;
    }

    if (mode === "edit") {
      input.contentEditable = "true";
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") e.preventDefault();
      });
      input.addEventListener("paste", function (e) {
        e.preventDefault();
        var text = (e.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
      input.addEventListener("input", function () {
        var text = input.textContent;
        if (text.length > CELL_MAX_LENGTH) {
          text = text.slice(0, CELL_MAX_LENGTH);
          input.textContent = text;
          var range = document.createRange();
          range.selectNodeContents(input);
          range.collapse(false);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        cellData.name = text;
        saveState();
      });
    } else if (mode === "swap") {
      input.contentEditable = "false";
      input.classList.add("readonly-mode");
      if (selected && selected.r === r && selected.c === c) {
        input.classList.add("selected");
      }
      input.addEventListener("click", function () {
        onCellSwapClick(r, c);
      });
    } else if (mode === "paint") {
      input.contentEditable = "false";
      input.classList.add("readonly-mode");
      input.addEventListener("click", function () {
        cellData.color = currentColor;
        saveState();
        renderGrid();
      });
    } else if (mode === "line") {
      input.contentEditable = "false";
      input.classList.add("readonly-mode");
    }

    return input;
  }

  function onCellSwapClick(r, c) {
    var pattern = getActivePattern();
    if (!selected) {
      selected = { r: r, c: c };
      renderGrid();
      return;
    }
    if (selected.r === r && selected.c === c) {
      selected = null;
      renderGrid();
      return;
    }
    var a = pattern.rows[selected.r].cells[selected.c];
    var b = pattern.rows[r].cells[c];
    pattern.rows[selected.r].cells[selected.c] = b;
    pattern.rows[r].cells[c] = a;
    selected = null;
    saveState();
    renderGrid();
  }

  // ---- rendering: palette ----

  function renderPalette() {
    if (mode !== "paint") {
      el.palette.hidden = true;
      el.palette.innerHTML = "";
      return;
    }

    var activePalette = getActivePalette(getActivePattern());
    var validColors = activePalette.map(function (p) {
      return p.color;
    });
    if (currentColor !== null && validColors.indexOf(currentColor) === -1) {
      currentColor = null;
    }

    el.palette.hidden = false;
    el.palette.innerHTML = "";

    activePalette.forEach(function (part) {
      var wrap = document.createElement("div");
      wrap.className = "swatchWrap";

      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "swatch" + (currentColor === part.color ? " active" : "");
      sw.style.background = part.color;
      if (part.key) sw.title = part.key;
      sw.addEventListener("click", function () {
        currentColor = part.color;
        renderPalette();
      });
      wrap.appendChild(sw);

      if (part.key) {
        var label = document.createElement("span");
        label.className = "swatchLabel";
        label.textContent = part.key;
        wrap.appendChild(label);
      }

      el.palette.appendChild(wrap);
    });

    var clearSw = document.createElement("button");
    clearSw.type = "button";
    clearSw.className = "swatch clear" + (currentColor === null ? " active" : "");
    clearSw.title = "色をクリア";
    clearSw.addEventListener("click", function () {
      currentColor = null;
      renderPalette();
    });
    el.palette.appendChild(clearSw);
  }

  // ---- rendering: rows editor ----

  function renderRowsList() {
    var pattern = getActivePattern();
    el.rowsList.innerHTML = "";

    pattern.rows.forEach(function (row, r) {
      var item = document.createElement("div");
      item.className = "rowItem";

      var topRow = document.createElement("div");
      topRow.className = "rowItemTop";

      var input = document.createElement("input");
      input.type = "text";
      input.className = "rowSpecInput";
      input.value = serializeRowSpec(row);
      input.inputMode = "text";
      input.addEventListener("change", function () {
        var spec = parseRowSpec(input.value);
        regenerateRowCells(row, spec.segments, spec.gaps);
        selected = null;
        saveState();
        render();
      });

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn remove";
      removeBtn.setAttribute("aria-label", "この行を削除");
      removeBtn.title = "この行を削除";
      removeBtn.innerHTML = TRASH_ICON_SVG;
      removeBtn.addEventListener("click", function () {
        pattern.rows.splice(r, 1);
        selected = null;
        saveState();
        render();
      });

      var riserToggle = document.createElement("label");
      riserToggle.className = "riserToggle";
      var riserCheckbox = document.createElement("input");
      riserCheckbox.type = "checkbox";
      riserCheckbox.checked = rowOnRiser(row);
      riserCheckbox.addEventListener("change", function () {
        row.onRiser = riserCheckbox.checked;
        saveState();
        renderGrid();
      });
      riserToggle.appendChild(riserCheckbox);
      riserToggle.appendChild(document.createTextNode("段に乗る(プレビューに背景を表示)"));

      topRow.appendChild(input);
      topRow.appendChild(removeBtn);
      item.appendChild(topRow);
      item.appendChild(riserToggle);
      el.rowsList.appendChild(item);
    });
  }

  function renderLinesList() {
    var pattern = getActivePattern();
    var lines = ensureLines(pattern);
    el.linesList.innerHTML = "";

    lines.forEach(function (line, i) {
      var item = document.createElement("div");
      item.className = "lineItem";

      var label = document.createElement("span");
      label.className = "lineTypeLabel";
      label.textContent = "縦線";

      var posInput = document.createElement("input");
      posInput.type = "number";
      posInput.value = Math.round(line.pos);
      posInput.addEventListener("input", function () {
        line.pos = parseFloat(posInput.value) || 0;
        saveState();
        renderGrid();
      });

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn remove";
      removeBtn.setAttribute("aria-label", "この線を削除");
      removeBtn.title = "この線を削除";
      removeBtn.innerHTML = TRASH_ICON_SVG;
      removeBtn.addEventListener("click", function () {
        lines.splice(i, 1);
        saveState();
        render();
      });

      item.appendChild(label);
      item.appendChild(posInput);
      item.appendChild(removeBtn);
      el.linesList.appendChild(item);
    });
  }

  // ---- rendering: part settings ----

  function renderPartSettings() {
    var pattern = getActivePattern();
    var settings = ensurePartSettings(pattern);
    el.partSchemeSelect.value = settings.scheme;

    var isNone = settings.scheme === "none";
    el.partNoneNote.hidden = !isNone;
    el.partCountsList.hidden = isNone;
    el.autoColorBtn.hidden = isNone;
    el.partTotalSummary.hidden = isNone;
    el.partCountsList.innerHTML = "";

    if (!isNone) {
      var parts = PART_SCHEMES[settings.scheme];

      parts.forEach(function (part) {
        var item = document.createElement("div");
        item.className = "partCountItem";

        var swatch = document.createElement("span");
        swatch.className = "partSwatch";
        swatch.style.background = part.color;

        var label = document.createElement("span");
        label.className = "partLabel";
        label.textContent = part.key;

        var input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.inputMode = "numeric";
        input.value = settings.counts[part.key] || 0;
        input.addEventListener("input", function () {
          settings.counts[part.key] = Math.max(0, parseInt(input.value, 10) || 0);
          saveState();
          updateTotals();
        });

        item.appendChild(swatch);
        item.appendChild(label);
        item.appendChild(input);
        el.partCountsList.appendChild(item);
      });
    }

    updateTotals();
  }

  function totalCellCount(pattern) {
    return pattern.rows.reduce(function (sum, row) {
      return sum + row.cells.length;
    }, 0);
  }

  function updateTotals() {
    var pattern = getActivePattern();
    var settings = ensurePartSettings(pattern);
    var cellsTotal = totalCellCount(pattern);
    el.cellTotalSummary.textContent = "マスの数: " + cellsTotal + "個";

    if (settings.scheme === "none") {
      el.cellTotalSummary.classList.remove("mismatch");
      return;
    }

    var parts = PART_SCHEMES[settings.scheme] || [];
    var partsTotal = parts.reduce(function (sum, part) {
      return sum + (settings.counts[part.key] || 0);
    }, 0);
    var mismatch = partsTotal !== cellsTotal;

    el.partTotalSummary.textContent = "人数合計: " + partsTotal + "人";
    el.partTotalSummary.classList.toggle("mismatch", mismatch);
    el.cellTotalSummary.classList.toggle("mismatch", mismatch);
  }

  function getCellsColumnMajor(pattern) {
    var maxLen = pattern.rows.reduce(function (max, row) {
      return Math.max(max, row.cells.length);
    }, 0);
    var flatCells = [];
    for (var c = 0; c < maxLen; c++) {
      pattern.rows.forEach(function (row) {
        if (row.cells[c]) flatCells.push(row.cells[c]);
      });
    }
    return flatCells;
  }

  function autoColorizeByParts() {
    var pattern = getActivePattern();
    var settings = ensurePartSettings(pattern);
    var parts = PART_SCHEMES[settings.scheme];
    if (!parts) return;

    var flatCells = getCellsColumnMajor(pattern);

    var partsTotal = parts.reduce(function (sum, part) {
      return sum + (settings.counts[part.key] || 0);
    }, 0);

    if (partsTotal === 0) {
      alert("各パートの人数を入力してください");
      return;
    }
    if (!confirm("マスの色を人数に応じて自動で塗り直します。既存の色は上書きされます。よろしいですか?")) return;

    flatCells.forEach(function (c) {
      c.color = null;
    });

    var idx = 0;
    parts.forEach(function (part) {
      var count = settings.counts[part.key] || 0;
      for (var i = 0; i < count && idx < flatCells.length; i++) {
        flatCells[idx].color = part.color;
        idx++;
      }
    });

    saveState();
    renderGrid();

    if (partsTotal > flatCells.length) {
      alert(
        "人数の合計(" + partsTotal + "人)がマスの数(" + flatCells.length + "個)を超えています。" +
        flatCells.length + "個目までしか色を割り当てられませんでした。"
      );
    }
  }

  // ---- hint / mode buttons ----

  function updateHint() {
    if (mode === "swap") {
      el.hint.textContent = "入れ替えたい2つのマスを順にタップしてください";
    } else if (mode === "paint") {
      el.hint.textContent = "色を選んでからマスをタップすると塗れます";
    } else if (mode === "line") {
      el.hint.textContent = "空いている場所をタップすると縦線を追加、既存の線はドラッグで移動できます(削除は下の一覧で)";
    } else {
      el.hint.textContent = "マスをタップして名前を入力してください";
    }
  }

  function updateModeButtons() {
    el.modeEditBtn.classList.toggle("active", mode === "edit");
    el.modeSwapBtn.classList.toggle("active", mode === "swap");
    el.modePaintBtn.classList.toggle("active", mode === "paint");
    el.modeLineBtn.classList.toggle("active", mode === "line");
  }

  function setMode(newMode) {
    mode = newMode;
    selected = null;
    render();
  }

  function clearAllNames() {
    if (!confirm("すべての名前を消去しますか?(色は残ります)")) return;
    var pattern = getActivePattern();
    pattern.rows.forEach(function (row) {
      row.cells.forEach(function (c) {
        c.name = "";
      });
    });
    saveState();
    renderGrid();
  }

  // ---- CSV export/import ----

  function csvEscape(value) {
    if (/[",\n]/.test(value)) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  function exportCsv() {
    var pattern = getActivePattern();
    var lines = pattern.rows.map(function (row) {
      return row.cells
        .map(function (c) {
          return csvEscape(c.name || "");
        })
        .join(",");
    });
    var csvContent = lines.join("\r\n");
    var blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, fileBaseName(pattern.name) + ".csv");
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(field);
          field = "";
        } else if (ch === "\n" || ch === "\r") {
          if (ch === "\r" && text[i + 1] === "\n") i++;
          row.push(field);
          field = "";
          rows.push(row);
          row = [];
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.length > 1 || (r.length === 1 && r[0] !== "");
    });
  }

  function importCsvFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result).replace(/^﻿/, "");
      var parsedRows = parseCsv(text);
      if (parsedRows.length === 0) {
        alert("CSVの内容を読み取れませんでした");
        return;
      }
      var pattern = getActivePattern();
      pattern.rows = parsedRows.map(function (r) {
        var row = createRow([r.length]);
        row.cells.forEach(function (cell, i) {
          cell.name = (r[i] || "").trim();
        });
        return row;
      });
      selected = null;
      saveState();
      render();
    };
    reader.readAsText(file);
  }

  function buildPatternData(pattern) {
    return {
      name: pattern.name,
      showConductor: showsConductor(pattern),
      showCenterLine: showsCenterLine(pattern),
      lines: ensureLines(pattern),
      partSettings: ensurePartSettings(pattern),
      rows: pattern.rows.map(function (row) {
        return {
          segments: row.segments,
          gaps: row.gaps,
          onRiser: !!row.onRiser,
          cells: row.cells
        };
      })
    };
  }

  function exportJson() {
    var pattern = getActivePattern();
    var data = buildPatternData(pattern);
    data.type = "order-maker-pattern";
    data.version = 1;
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    downloadBlob(blob, fileBaseName(pattern.name) + ".json");
  }

  function normalizePatternFromJson(data) {
    var rows = Array.isArray(data.rows) && data.rows.length > 0
      ? data.rows.map(function (r) {
          var segments = Array.isArray(r.segments)
            ? r.segments.map(Number).filter(function (n) {
                return Number.isFinite(n) && n > 0;
              })
            : [];
          if (segments.length === 0) segments = [1];

          var gaps = Array.isArray(r.gaps)
            ? r.gaps.slice(0, segments.length - 1).map(function (n) {
                var num = Number(n);
                return Number.isFinite(num) && num >= 0 ? num : DEFAULT_GAP_CELLS;
              })
            : [];
          while (gaps.length < segments.length - 1) gaps.push(DEFAULT_GAP_CELLS);

          var total = segmentsTotal(segments);
          var cells = [];
          for (var i = 0; i < total; i++) {
            var c = (Array.isArray(r.cells) && r.cells[i]) || {};
            cells.push({
              name: typeof c.name === "string" ? c.name : "",
              color: typeof c.color === "string" ? c.color : null
            });
          }

          return {
            segments: segments,
            gaps: gaps,
            cells: cells,
            onRiser: !!r.onRiser
          };
        })
      : [createRow([DEFAULT_COL_COUNT])];

    var scheme =
      data.partSettings && (PART_SCHEMES[data.partSettings.scheme] || data.partSettings.scheme === "none")
        ? data.partSettings.scheme
        : "4";
    var counts =
      data.partSettings && data.partSettings.counts && typeof data.partSettings.counts === "object"
        ? data.partSettings.counts
        : {};

    var lines = Array.isArray(data.lines)
      ? data.lines
          .map(function (l) {
            var pos = Number(l && l.pos);
            if (!Number.isFinite(pos)) return null;
            return { id: makeLineId(), pos: pos };
          })
          .filter(Boolean)
      : [];

    return {
      name: typeof data.name === "string" ? data.name : "",
      rows: rows,
      partSettings: { scheme: scheme, counts: counts },
      showConductor: data.showConductor !== false,
      showCenterLine: !!data.showCenterLine,
      lines: lines
    };
  }

  function importJsonFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(String(reader.result));
      } catch (e) {
        alert("JSONの読み込みに失敗しました");
        return;
      }
      if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
        alert("正しいJSONファイルではないようです");
        return;
      }
      if (!confirm("現在のパターンの内容(名前・色・すき間・段の設定など)をすべて上書きします。よろしいですか?")) return;

      var normalized = normalizePatternFromJson(data);
      var pattern = getActivePattern();
      applyNormalizedDataToPattern(pattern, normalized);
      selected = null;
      saveState();
      render();
    };
    reader.readAsText(file);
  }

  function applyNormalizedDataToPattern(pattern, normalized) {
    if (normalized.name) pattern.name = normalized.name;
    pattern.rows = normalized.rows;
    pattern.partSettings = normalized.partSettings;
    pattern.showConductor = normalized.showConductor;
    pattern.showCenterLine = normalized.showCenterLine;
    pattern.lines = normalized.lines;
  }

  // ---- sharing (Firebase Firestore realtime sync) ----

  function firebaseReady() {
    if (db) return true;
    if (!firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY") return false;
    if (typeof firebase === "undefined") return false;
    try {
      firebase.initializeApp(firebaseConfig);
      db = firebase.firestore();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  function generateShareId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function shareDocRef(shareId) {
    return db.collection("patterns").doc(shareId);
  }

  function buildShareUrl(shareId) {
    var url = new URL(window.location.href);
    url.searchParams.set("share", shareId);
    return url;
  }

  function shareCurrentPattern() {
    if (!firebaseReady()) {
      alert("共有機能がまだ設定されていません(Firebaseの設定が必要です)。");
      return;
    }
    var pattern = getActivePattern();
    if (!pattern.shareId) pattern.shareId = generateShareId();
    saveState(true);

    var data = buildPatternData(pattern);
    data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

    shareDocRef(pattern.shareId).set(data).then(function () {
      ensureShareListener(pattern);
      var url = buildShareUrl(pattern.shareId);
      window.history.replaceState(null, "", url.toString());
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url.toString()).catch(function () {});
      }
      prompt("共有リンクをコピーしました。このリンクを開いた人は内容をリアルタイムで見たり編集したりできます:", url.toString());
    }).catch(function (e) {
      console.error(e);
      alert("共有リンクの作成に失敗しました: " + e.message);
    });
  }

  function applyRemoteSnapshotToPattern(pattern, data) {
    var normalized = normalizePatternFromJson(data);
    applyNormalizedDataToPattern(pattern, normalized);
    selected = null;
    saveState(true);
    render();
  }

  function ensureShareListener(pattern) {
    if (!firebaseReady() || !pattern.shareId) return;
    if (shareListenerPatternId === pattern.id && shareUnsubscribe) return;
    if (shareUnsubscribe) {
      shareUnsubscribe();
      shareUnsubscribe = null;
    }
    shareListenerPatternId = pattern.id;
    shareUnsubscribe = shareDocRef(pattern.shareId).onSnapshot(function (snap) {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      var current = getActivePattern();
      if (!current || current.id !== pattern.id) return;
      applyRemoteSnapshotToPattern(current, snap.data());
    }, function (e) {
      console.error(e);
    });
  }

  function refreshShareFromServer() {
    var pattern = getActivePattern();
    if (!firebaseReady() || !pattern.shareId) {
      alert("このパターンはまだ共有されていません。先に「共有リンクを作成/更新」を実行してください。");
      return;
    }
    shareDocRef(pattern.shareId).get({ source: "server" }).then(function (snap) {
      if (!snap.exists) {
        alert("共有データが見つかりませんでした。");
        return;
      }
      applyRemoteSnapshotToPattern(pattern, snap.data());
    }).catch(function (e) {
      console.error(e);
      alert("取得に失敗しました: " + e.message);
    });
  }

  function schedulePushShareUpdate(pattern) {
    if (!firebaseReady() || !pattern.shareId) return;
    if (shareWriteTimer) clearTimeout(shareWriteTimer);
    shareWriteTimer = setTimeout(function () {
      shareWriteTimer = null;
      var data = buildPatternData(pattern);
      data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
      shareDocRef(pattern.shareId).set(data).catch(function (e) {
        console.error(e);
      });
    }, 800);
  }

  function loadSharedPatternFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var shareId = params.get("share");
    if (!shareId || !firebaseReady()) return;

    var existing = state.patterns.find(function (p) {
      return p.shareId === shareId;
    });
    if (existing) {
      state.activeId = existing.id;
      saveState(true);
      render();
      ensureShareListener(existing);
      return;
    }

    shareDocRef(shareId).get().then(function (snap) {
      if (!snap.exists) {
        alert("指定された共有データが見つかりませんでした。");
        return;
      }
      var data = snap.data();
      var normalized = normalizePatternFromJson(data);
      var pattern = createPattern(normalized.name || "共有パターン", 1, 1);
      applyNormalizedDataToPattern(pattern, normalized);
      pattern.shareId = shareId;
      state.patterns.push(pattern);
      state.activeId = pattern.id;
      saveState(true);
      render();
      ensureShareListener(pattern);
    }).catch(function (e) {
      console.error(e);
      alert("共有データの取得に失敗しました: " + e.message);
    });
  }

  function downloadBlob(blob, filename) {
    if (navigator.canShare && typeof File !== "undefined") {
      try {
        var file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file] }).catch(function () {});
          return;
        }
      } catch (e) {
        // fall through to anchor download
      }
    }

    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function dateStampShort() {
    var d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return String(d.getFullYear() % 100).padStart(2, "0") + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function fileBaseName(name) {
    var safe = String(name || "")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .slice(0, 40);
    if (!safe) safe = "パターン";
    return safe + "_" + dateStampShort();
  }

  // ---- Image export (canvas) ----

  function exportImage() {
    var pattern = getActivePattern();
    var cellW = CELL_W;
    var cellH = CELL_H;
    var gapX = GAP_X;
    var gapY = GAP_Y;
    var offsetShift = CELL_W / 2;
    var padding = 24;
    var titleH = 40;
    var markH = 44;
    var markGapY = 14;
    var withConductor = showsConductor(pattern);

    var rowWidths = pattern.rows.map(rowContentWidthPx);
    var maxRowWidth = maxRowWidthPx(pattern);

    var canvas = document.createElement("canvas");
    canvas.width = padding * 2 + maxRowWidth + offsetShift + RISER_PAD;
    canvas.height =
      padding * 2 + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY +
      (withConductor ? markGapY + markH : 0);
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = CELL_TEXT_COLOR;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(pattern.name || "並び順", padding, padding);

    // Every riser shares one common span wide enough to contain every row
    // (including staggered ones), so all platforms line up and match width.
    var minLeft = Infinity;
    var maxRight = -Infinity;
    pattern.rows.forEach(function (row, r) {
      var rowBaseX = padding + (maxRowWidth - rowWidths[r]) / 2 + (r % 2 === 1 ? offsetShift : 0);
      minLeft = Math.min(minLeft, rowBaseX);
      maxRight = Math.max(maxRight, rowBaseX + rowWidths[r]);
    });
    var riserLeft = minLeft - RISER_PAD;
    var riserWidth = maxRight - minLeft + RISER_PAD * 2;
    var ri = 0;
    while (ri < pattern.rows.length) {
      if (!rowOnRiser(pattern.rows[ri])) {
        ri++;
        continue;
      }
      var riStart = ri;
      while (ri < pattern.rows.length && rowOnRiser(pattern.rows[ri])) ri++;
      var riEnd = ri - 1;
      var riTop = padding + titleH + riStart * (cellH + gapY) - RISER_PAD;
      var riBottom = padding + titleH + riEnd * (cellH + gapY) + cellH + RISER_PAD;

      ctx.fillStyle = RISER_COLOR;
      ctx.strokeStyle = RISER_BORDER;
      ctx.lineWidth = 1;
      roundRect(ctx, riserLeft, riTop, riserWidth, riBottom - riTop, 8);
      ctx.fill();
      ctx.stroke();
    }

    pattern.rows.forEach(function (row, r) {
      var y = padding + titleH + r * (cellH + gapY);
      var baseX = padding + (maxRowWidth - rowWidths[r]) / 2 + (r % 2 === 1 ? offsetShift : 0);
      var x = baseX;

      var cellIdx = 0;
      row.segments.forEach(function (segLen, segIdx) {
        if (segIdx > 0) x += getGapPx(row, segIdx - 1);
        for (var i = 0; i < segLen; i++) {
          var cellData = row.cells[cellIdx];
          ctx.fillStyle = cellData.color || "#ffffff";
          ctx.strokeStyle = "#333844";
          ctx.lineWidth = 2;
          roundRect(ctx, x, y, cellW, cellH, 10);
          ctx.fill();
          ctx.stroke();

          drawFittedText(ctx, cellData.name || "", x + cellW / 2, y + cellH / 2, cellW - 12);

          x += cellW + gapX;
          cellIdx++;
        }
      });
    });

    var linesTop = padding + titleH;
    var linesBottom =
      padding + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY;
    // Align to the same center the conductor mark uses (row 0's unshifted
    // center, shifted to match the last row's parity), not the riser
    // background's full-extent span, so the two visually coincide.
    var linesLastRowIsOffset = (pattern.rows.length - 1) % 2 === 1;
    var linesCenter = padding + maxRowWidth / 2 + (linesLastRowIsOffset ? offsetShift : 0);

    if (showsCenterLine(pattern)) {
      ctx.strokeStyle = CENTER_LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(linesCenter, linesTop);
      ctx.lineTo(linesCenter, linesBottom);
      ctx.stroke();
    }

    ensureLines(pattern).forEach(function (line) {
      var x = linesCenter + line.pos;
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, linesTop);
      ctx.lineTo(x, linesBottom);
      ctx.stroke();
    });

    if (withConductor) {
      var markY =
        padding + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY + markGapY;
      var lastRowIsOffset = (pattern.rows.length - 1) % 2 === 1;
      var markCx = padding + maxRowWidth / 2 + (lastRowIsOffset ? offsetShift : 0);
      var markCy = markY + markH / 2;
      ctx.fillStyle = CELL_TEXT_COLOR;
      ctx.beginPath();
      ctx.arc(markCx, markCy, markH / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("指揮", markCx, markCy);
    }

    canvas.toBlob(function (blob) {
      if (!blob) {
        alert("画像の生成に失敗しました");
        return;
      }
      downloadBlob(blob, fileBaseName(pattern.name) + ".png");
    }, "image/png");
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFittedText(ctx, text, cx, cy, maxWidth) {
    if (!text) return;
    var fontSize = 18;
    ctx.fillStyle = CELL_TEXT_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    do {
      ctx.font = fontSize + "px sans-serif";
      var width = ctx.measureText(text).width;
      if (width <= maxWidth || fontSize <= 9) break;
      fontSize -= 1;
    } while (true);
    ctx.fillText(text, cx, cy);
  }

  // ---- wiring ----

  el.modeEditBtn.addEventListener("click", function () {
    setMode("edit");
  });
  el.modeSwapBtn.addEventListener("click", function () {
    setMode("swap");
  });
  el.modePaintBtn.addEventListener("click", function () {
    setMode("paint");
  });
  el.modeLineBtn.addEventListener("click", function () {
    setMode("line");
  });

  el.showCenterLineCheckbox.addEventListener("change", function () {
    getActivePattern().showCenterLine = el.showCenterLineCheckbox.checked;
    saveState();
    renderGrid();
  });

  el.grid.addEventListener("click", function (e) {
    if (mode !== "line") return;
    var pattern = getActivePattern();
    var cellsWraps = el.grid.querySelectorAll(".cellsWrap");
    if (cellsWraps.length === 0) return;

    var gridRect = el.grid.getBoundingClientRect();
    var minLeft = Infinity;
    var maxRight = -Infinity;
    cellsWraps.forEach(function (w) {
      var r = w.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left - gridRect.left);
      maxRight = Math.max(maxRight, r.right - gridRect.left);
    });
    var center = (minLeft + maxRight) / 2;
    var clickX = e.clientX - gridRect.left;

    ensureLines(pattern).push({ id: makeLineId(), pos: clickX - center });
    saveState();
    render();
  });

  el.clearBtn.addEventListener("click", function () {
    closeMenu();
    clearAllNames();
  });
  el.shareBtn.addEventListener("click", function () {
    closeMenu();
    shareCurrentPattern();
  });
  el.refreshShareBtn.addEventListener("click", function () {
    closeMenu();
    refreshShareFromServer();
  });
  el.exportCsvBtn.addEventListener("click", function () {
    closeMenu();
    exportCsv();
  });
  el.exportJsonBtn.addEventListener("click", exportJson);
  el.exportImageBtn.addEventListener("click", exportImage);
  el.deletePatternBtn.addEventListener("click", function () {
    closeMenu();
    deleteActivePattern();
  });
  el.renamePatternBtn.addEventListener("click", function () {
    closeMenu();
    renameActivePattern();
  });

  function closeMenu() {
    el.menuPanel.hidden = true;
    el.menuBtn.setAttribute("aria-expanded", "false");
  }

  el.menuBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    var willOpen = el.menuPanel.hidden;
    el.menuPanel.hidden = !willOpen;
    el.menuBtn.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", function (e) {
    if (!el.menuPanel.hidden && !el.menuPanel.contains(e.target) && e.target !== el.menuBtn) {
      closeMenu();
    }
  });

  el.addRowBtn.addEventListener("click", function () {
    var pattern = getActivePattern();
    var lastRow = pattern.rows[pattern.rows.length - 1];
    var colCount = lastRow ? segmentsTotal(lastRow.segments) : DEFAULT_COL_COUNT;
    pattern.rows.push(createRow([colCount]));
    saveState();
    render();
  });

  el.showConductorCheckbox.addEventListener("change", function () {
    getActivePattern().showConductor = el.showConductorCheckbox.checked;
    saveState();
    renderGrid();
  });

  el.partSchemeSelect.addEventListener("change", function () {
    var pattern = getActivePattern();
    var settings = ensurePartSettings(pattern);
    settings.scheme = el.partSchemeSelect.value;
    settings.counts = {};
    saveState();
    renderPartSettings();
    renderPalette();
  });

  el.autoColorBtn.addEventListener("click", autoColorizeByParts);

  el.importCsvInput.addEventListener("change", function () {
    closeMenu();
    var file = el.importCsvInput.files[0];
    if (file) {
      importCsvFile(file);
    }
    el.importCsvInput.value = "";
  });

  el.importJsonInput.addEventListener("change", function () {
    closeMenu();
    var file = el.importJsonInput.files[0];
    if (file) {
      importJsonFile(file);
    }
    el.importJsonInput.value = "";
  });

  // ---- init ----

  var restored = loadState();
  if (!restored) {
    var pattern = createPattern("パターン1", DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT);
    state.patterns = [pattern];
    state.activeId = pattern.id;
    saveState();
  }
  render();
  loadSharedPatternFromUrl();
})();
