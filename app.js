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

  var CELL_TEXT_COLOR = "#1f2430";
  var DEFAULT_ROW_COUNT = 4;
  var DEFAULT_COL_COUNT = 6;
  var DEFAULT_GAP_CELLS = 0.25;
  var CELL_W = 88;
  var GAP_X = 8;

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
    addRowBtn: document.getElementById("addRowBtn")
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
    return { segments: segments.slice(), gaps: normalizedGaps, cells: cells };
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

  function createPattern(name, rowCount, colCount) {
    var rows = [];
    for (var i = 0; i < rowCount; i++) {
      rows.push(createRow([colCount]));
    }
    return { id: makeId(), name: name, rows: rows };
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
    var pendingGap = null;
    tokens.forEach(function (tok) {
      var gapMatch = /^g(\d*\.?\d+)$/i.exec(tok);
      if (gapMatch) {
        pendingGap = Math.max(0, parseFloat(gapMatch[1]));
        return;
      }
      var n = parseInt(tok, 10);
      if (!Number.isFinite(n) || n <= 0) return;
      if (segments.length > 0) {
        gaps.push(pendingGap !== null ? pendingGap : DEFAULT_GAP_CELLS);
      }
      segments.push(n);
      pendingGap = null;
    });
    if (segments.length === 0) segments = [1];
    return { segments: segments, gaps: gaps };
  }

  function formatGapCells(n) {
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  function serializeRowSpec(row) {
    var parts = [];
    row.segments.forEach(function (segLen, i) {
      if (i > 0) parts.push("g" + formatGapCells(getGapCells(row, i - 1)));
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

    pattern.rows.forEach(function (row, r) {
      var rowDiv = document.createElement("div");
      rowDiv.className = "row" + (r % 2 === 1 ? " offset" : "");

      var cellIdx = 0;
      row.segments.forEach(function (segLen, segIdx) {
        if (segIdx > 0) {
          var gapPx = getGapPx(row, segIdx - 1);
          var spacer = document.createElement("div");
          spacer.className = "segmentGap";
          spacer.style.width = gapPx + "px";
          spacer.style.flex = "0 0 " + gapPx + "px";
          rowDiv.appendChild(spacer);
        }
        for (var i = 0; i < segLen; i++) {
          rowDiv.appendChild(createCellEl(row, r, cellIdx));
          cellIdx++;
        }
      });

      el.grid.appendChild(rowDiv);
    });
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
    el.palette.hidden = false;
    el.palette.innerHTML = "";

    PALETTE.forEach(function (color) {
      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "swatch" + (currentColor === color ? " active" : "");
      sw.style.background = color;
      sw.addEventListener("click", function () {
        currentColor = color;
        renderPalette();
      });
      el.palette.appendChild(sw);
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

      var label = document.createElement("span");
      label.className = "rowLabel";
      label.textContent = "第" + (r + 1) + "行";

      var input = document.createElement("input");
      input.type = "text";
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
      removeBtn.textContent = "削除";
      removeBtn.addEventListener("click", function () {
        pattern.rows.splice(r, 1);
        selected = null;
        saveState();
        render();
      });

      item.appendChild(label);
      item.appendChild(input);
      item.appendChild(removeBtn);
      el.rowsList.appendChild(item);
    });
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
    var cellW = 88;
    var cellH = 52;
    var gapX = 8;
    var gapY = 10;
    var offsetShift = 44;
    var padding = 24;
    var titleH = 40;

    function rowContentWidth(row) {
      var w = 0;
      row.segments.forEach(function (segLen, i) {
        if (i > 0) w += getGapPx(row, i - 1);
        w += segLen * cellW + (segLen - 1) * gapX;
      });
      return w;
    }

    var rowWidths = pattern.rows.map(rowContentWidth);
    var maxRowWidth = rowWidths.reduce(function (a, b) {
      return Math.max(a, b);
    }, 0);

    var canvas = document.createElement("canvas");
    canvas.width = padding * 2 + maxRowWidth + offsetShift;
    canvas.height =
      padding * 2 + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY;
    var ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = CELL_TEXT_COLOR;
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(pattern.name || "並び順", padding, padding);

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
