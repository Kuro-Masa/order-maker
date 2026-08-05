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
  var CELL_W = 88;
  var CELL_H = 52;
  var GAP_X = 8;
  var GAP_Y = 10;
  var GRID_PAD_LEFT = 4;
  var RISER_PAD = 8;
  var RISER_COLOR = "#d9c7a8";
  var RISER_BORDER = "#b3987a";

  var state = {
    patterns: [], // [{ id, name, rows: [{ segments: [n,...], gaps: [cellUnits,...], cells: [{name, color}, ...] }] }]
    activeId: null
  };

  var mode = "edit"; // "edit" | "swap" | "paint"
  var selected = null; // { r, c } flat cell index within row.cells
  var currentColor = PALETTE[0];
  var nextPatternNum = 1;

  var el = {
    tabBar: document.getElementById("tabBar"),
    menuBtn: document.getElementById("menuBtn"),
    menuPanel: document.getElementById("menuPanel"),
    renamePatternBtn: document.getElementById("renamePatternBtn"),
    deletePatternBtn: document.getElementById("deletePatternBtn"),
    modeEditBtn: document.getElementById("modeEditBtn"),
    modeSwapBtn: document.getElementById("modeSwapBtn"),
    modePaintBtn: document.getElementById("modePaintBtn"),
    clearBtn: document.getElementById("clearBtn"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    importCsvInput: document.getElementById("importCsvInput"),
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

  function createRow(segments, gaps, name) {
    var total = segmentsTotal(segments);
    var cells = [];
    for (var i = 0; i < total; i++) {
      cells.push({ name: "", color: null });
    }
    var normalizedGaps = gaps ? gaps.slice() : segments.slice(1).map(function () {
      return DEFAULT_GAP_CELLS;
    });
    return { segments: segments.slice(), gaps: normalizedGaps, cells: cells, name: name || "", onRiser: false };
  }

  function rowDisplayName(row, r) {
    return row.name || "第" + (r + 1) + "行";
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
    return { id: makeId(), name: name, rows: rows, partSettings: { scheme: "4", counts: {} }, showConductor: true };
  }

  function showsConductor(pattern) {
    return pattern.showConductor !== false;
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
    state.patterns.splice(idx, 1);
    var next = state.patterns[Math.max(0, idx - 1)];
    state.activeId = next.id;
    selected = null;
    saveState();
    render();
  }

  function switchPattern(id) {
    if (id === state.activeId) return;
    state.activeId = id;
    selected = null;
    saveState();
    render();
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

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // ---- rendering ----

  function render() {
    renderTabs();
    renderGrid();
    renderPalette();
    renderRowsList();
    renderPartSettings();
    el.showConductorCheckbox.checked = showsConductor(getActivePattern());
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

      var nameLabel = document.createElement("span");
      nameLabel.className = "rowNameLabel";
      nameLabel.textContent = rowDisplayName(row, r);
      rowDiv.appendChild(nameLabel);

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

  function createCellEl(row, r, c) {
    var cellData = row.cells[c];
    var input = document.createElement("input");
    input.type = "text";
    input.className = "cell";
    input.value = cellData.name;
    input.maxLength = 10;
    input.autocomplete = "off";
    input.spellcheck = false;
    if (cellData.color) {
      input.style.background = cellData.color;
      input.style.color = CELL_TEXT_COLOR;
    }

    if (mode === "edit") {
      input.readOnly = false;
      input.addEventListener("input", function () {
        cellData.name = input.value;
        saveState();
      });
    } else if (mode === "swap") {
      input.readOnly = true;
      input.classList.add("readonly-mode");
      if (selected && selected.r === r && selected.c === c) {
        input.classList.add("selected");
      }
      input.addEventListener("click", function () {
        onCellSwapClick(r, c);
      });
    } else if (mode === "paint") {
      input.readOnly = true;
      input.classList.add("readonly-mode");
      input.addEventListener("click", function () {
        cellData.color = currentColor;
        saveState();
        renderGrid();
      });
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

      var nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "rowNameInput";
      nameInput.value = row.name || "";
      nameInput.placeholder = "第" + (r + 1) + "行";
      nameInput.maxLength = 12;
      nameInput.addEventListener("input", function () {
        row.name = nameInput.value;
        saveState();
        renderGrid();
      });

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
      removeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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

      topRow.appendChild(nameInput);
      topRow.appendChild(input);
      topRow.appendChild(removeBtn);
      item.appendChild(topRow);
      item.appendChild(riserToggle);
      el.rowsList.appendChild(item);
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
    } else {
      el.hint.textContent = "マスをタップして名前を入力してください";
    }
  }

  function updateModeButtons() {
    el.modeEditBtn.classList.toggle("active", mode === "edit");
    el.modeSwapBtn.classList.toggle("active", mode === "swap");
    el.modePaintBtn.classList.toggle("active", mode === "paint");
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
    var offsetShift = 44;
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

  el.clearBtn.addEventListener("click", function () {
    closeMenu();
    clearAllNames();
  });
  el.exportCsvBtn.addEventListener("click", exportCsv);
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

  // ---- init ----

  var restored = loadState();
  if (!restored) {
    var pattern = createPattern("パターン1", DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT);
    state.patterns = [pattern];
    state.activeId = pattern.id;
    saveState();
  }
  render();
})();
