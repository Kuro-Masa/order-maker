import { useEffect, useMemo, useRef, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { DEFAULT_COL_COUNT, DEFAULT_ROW_COUNT, PALETTE, PART_SCHEMES } from "../constants";
import type { Mode, Pattern, PatternJson, Selected } from "../types";
import { loadState, saveState } from "./persistence";
import {
  createPattern,
  createRow,
  getCellsColumnMajor,
  makeLineId,
  parseRowSpec,
  regenerateRowCells,
  segmentsTotal,
} from "./patternHelpers";
import {
  applyNormalizedDataToPattern,
  exportJsonData,
  normalizePatternFromJson,
} from "../features/io/json";
import { exportCsv as writeCsv, rowsFromCsv } from "../features/io/csv";
import { exportImage as writeImage } from "../features/io/imageExport";
import { downloadBlob, fileBaseName } from "../features/io/download";
import {
  buildShareUrl,
  fetchPatternFromFirestore,
  firebaseReady,
  generateShareId,
  listenToPattern,
  pushPatternToFirestore,
} from "../features/share/share";

export function useAppStore() {
  const [state, setState] = useState(() => loadState());
  const [mode, setModeRaw] = useState<Mode>("edit");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [currentColor, setCurrentColor] = useState<string | null>(PALETTE[0]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const stateRef = useRef(state);
  const shareUnsubRef = useRef<Unsubscribe | null>(null);
  const shareListenerPatternIdRef = useRef<string | null>(null);
  const shareWriteTimerRef = useRef<number | null>(null);
  const skipNextSharePushRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activePattern = useMemo(
    () => state.patterns.find((p) => p.id === state.activeId) || state.patterns[0],
    [state]
  );

  function schedulePush(pattern: Pattern) {
    if (!firebaseReady() || !pattern.shareId) return;
    if (shareWriteTimerRef.current) window.clearTimeout(shareWriteTimerRef.current);
    shareWriteTimerRef.current = window.setTimeout(() => {
      shareWriteTimerRef.current = null;
      pushPatternToFirestore(pattern).catch((e) => console.error(e));
    }, 800);
  }

  useEffect(() => {
    saveState(state);
    if (skipNextSharePushRef.current) {
      skipNextSharePushRef.current = false;
      return;
    }
    const pattern = state.patterns.find((p) => p.id === state.activeId);
    if (pattern && pattern.shareId) schedulePush(pattern);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    return () => {
      if (shareUnsubRef.current) shareUnsubRef.current();
    };
  }, []);

  function updatePatternById(patternId: string, updater: (p: Pattern) => Pattern) {
    setState((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => (p.id === patternId ? updater(p) : p)),
    }));
  }

  function updateActivePattern(updater: (p: Pattern) => Pattern) {
    if (!activePattern) return;
    updatePatternById(activePattern.id, updater);
  }

  // ---- pattern (tab) management ----

  function addPattern() {
    const pattern = createPattern(
      "パターン" + (state.patterns.length + 1),
      DEFAULT_ROW_COUNT,
      DEFAULT_COL_COUNT
    );
    setState((prev) => ({ patterns: [...prev.patterns, pattern], activeId: pattern.id }));
    setSelected(null);
  }

  function deleteActivePattern() {
    if (state.patterns.length <= 1) {
      alert("最後の1つは削除できません");
      return;
    }
    if (!activePattern || !confirm(`「${activePattern.name}」を削除しますか?`)) return;
    const idx = state.patterns.findIndex((p) => p.id === state.activeId);
    const removedId = state.patterns[idx].id;
    const newPatterns = state.patterns.slice();
    newPatterns.splice(idx, 1);
    const next = newPatterns[Math.max(0, idx - 1)];
    setState({ patterns: newPatterns, activeId: next.id });
    setSelected(null);
    if (shareListenerPatternIdRef.current === removedId && shareUnsubRef.current) {
      shareUnsubRef.current();
      shareUnsubRef.current = null;
      shareListenerPatternIdRef.current = null;
    }
  }

  function switchPattern(id: string) {
    if (id === state.activeId) return;
    setState((prev) => ({ ...prev, activeId: id }));
    setSelected(null);
    const pattern = state.patterns.find((p) => p.id === id);
    if (pattern?.shareId) {
      ensureShareListener(pattern);
    } else if (shareUnsubRef.current) {
      shareUnsubRef.current();
      shareUnsubRef.current = null;
      shareListenerPatternIdRef.current = null;
    }
  }

  function renameActivePattern() {
    if (!activePattern) return;
    const name = prompt("パターン名を入力してください", activePattern.name);
    if (name === null) return;
    const trimmed = name.trim() || activePattern.name;
    updateActivePattern((p) => ({ ...p, name: trimmed }));
  }

  // ---- row helpers ----

  function updateRowSpec(rowIndex: number, specText: string) {
    updateActivePattern((p) => {
      const spec = parseRowSpec(specText);
      const rows = p.rows.slice();
      rows[rowIndex] = regenerateRowCells(rows[rowIndex], spec.segments, spec.gaps);
      return { ...p, rows };
    });
    setSelected(null);
  }

  function addRow() {
    updateActivePattern((p) => {
      const lastRow = p.rows[p.rows.length - 1];
      const colCount = lastRow ? segmentsTotal(lastRow.segments) : DEFAULT_COL_COUNT;
      return { ...p, rows: [...p.rows, createRow([colCount])] };
    });
  }

  function removeRow(rowIndex: number) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      rows.splice(rowIndex, 1);
      return { ...p, rows };
    });
    setSelected(null);
  }

  function toggleRowOnRiser(rowIndex: number, checked: boolean) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      rows[rowIndex] = { ...rows[rowIndex], onRiser: checked };
      return { ...p, rows };
    });
  }

  // ---- part color settings ----

  function setPartScheme(scheme: string) {
    updateActivePattern((p) => ({ ...p, partSettings: { scheme, counts: {} } }));
  }

  function setPartCount(key: string, count: number) {
    updateActivePattern((p) => ({
      ...p,
      partSettings: {
        ...p.partSettings,
        counts: { ...p.partSettings.counts, [key]: Math.max(0, count) },
      },
    }));
  }

  function autoColorizeByParts() {
    if (!activePattern) return;
    const settings = activePattern.partSettings;
    const parts = PART_SCHEMES[settings.scheme];
    if (!parts) return;

    const partsTotal = parts.reduce((sum, part) => sum + (settings.counts[part.key] || 0), 0);
    if (partsTotal === 0) {
      alert("各パートの人数を入力してください");
      return;
    }
    if (!confirm("マスの色を人数に応じて自動で塗り直します。既存の色は上書きされます。よろしいですか?")) return;

    updateActivePattern((p) => {
      const rows = p.rows.map((row) => ({ ...row, cells: row.cells.map((c) => ({ ...c })) }));
      const newPattern = { ...p, rows };
      const flatCells = getCellsColumnMajor(newPattern);
      flatCells.forEach((c) => {
        c.color = null;
      });
      let idx = 0;
      parts.forEach((part) => {
        const count = settings.counts[part.key] || 0;
        for (let i = 0; i < count && idx < flatCells.length; i++) {
          flatCells[idx].color = part.color;
          idx++;
        }
      });
      if (partsTotal > flatCells.length) {
        setTimeout(() => {
          alert(
            `人数の合計(${partsTotal}人)がマスの数(${flatCells.length}個)を超えています。` +
              `${flatCells.length}個目までしか色を割り当てられませんでした。`
          );
        }, 0);
      }
      return newPattern;
    });
  }

  function clearAllNames() {
    if (!confirm("すべての名前を消去しますか?(色は残ります)")) return;
    updateActivePattern((p) => ({
      ...p,
      rows: p.rows.map((row) => ({ ...row, cells: row.cells.map((c) => ({ ...c, name: "" })) })),
    }));
  }

  // ---- lines ----

  function toggleCenterLine(checked: boolean) {
    updateActivePattern((p) => ({ ...p, showCenterLine: checked }));
  }

  function toggleConductor(checked: boolean) {
    updateActivePattern((p) => ({ ...p, showConductor: checked }));
  }

  function addLine(pos: number) {
    updateActivePattern((p) => ({ ...p, lines: [...p.lines, { id: makeLineId(), pos }] }));
  }

  function updateLinePos(lineId: string, pos: number) {
    updateActivePattern((p) => ({
      ...p,
      lines: p.lines.map((l) => (l.id === lineId ? { ...l, pos } : l)),
    }));
  }

  function removeLine(lineId: string) {
    updateActivePattern((p) => ({ ...p, lines: p.lines.filter((l) => l.id !== lineId) }));
  }

  // ---- cells ----

  function setCellName(rowIndex: number, cellIndex: number, name: string) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      const cells = rows[rowIndex].cells.slice();
      cells[cellIndex] = { ...cells[cellIndex], name };
      rows[rowIndex] = { ...rows[rowIndex], cells };
      return { ...p, rows };
    });
  }

  function onCellSwapClick(r: number, c: number) {
    if (!selected) {
      setSelected({ r, c });
      return;
    }
    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }
    const sel = selected;
    updateActivePattern((p) => {
      const rows = p.rows.map((row) => ({ ...row, cells: row.cells.slice() }));
      const a = rows[sel.r].cells[sel.c];
      const b = rows[r].cells[c];
      rows[sel.r].cells[sel.c] = b;
      rows[r].cells[c] = a;
      return { ...p, rows };
    });
    setSelected(null);
  }

  function paintCell(r: number, c: number, color: string | null) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      const cells = rows[r].cells.slice();
      cells[c] = { ...cells[c], color };
      rows[r] = { ...rows[r], cells };
      return { ...p, rows };
    });
  }

  // ---- mode ----

  function changeMode(newMode: Mode) {
    setModeRaw(newMode);
    setSelected(null);
  }

  // ---- export / import ----

  function exportJson() {
    if (!activePattern) return;
    const data = exportJsonData(activePattern);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    downloadBlob(blob, fileBaseName(activePattern.name) + ".json");
  }

  function importJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      let data: PatternJson;
      try {
        data = JSON.parse(String(reader.result));
      } catch {
        alert("JSONの読み込みに失敗しました");
        return;
      }
      if (!data || typeof data !== "object" || !Array.isArray(data.rows)) {
        alert("正しいJSONファイルではないようです");
        return;
      }
      if (
        !confirm(
          "現在のパターンの内容(名前・色・すき間・段の設定など)をすべて上書きします。よろしいですか?"
        )
      )
        return;
      const normalized = normalizePatternFromJson(data);
      updateActivePattern((p) => {
        const next = { ...p };
        applyNormalizedDataToPattern(next, normalized);
        return next;
      });
      setSelected(null);
    };
    reader.readAsText(file);
  }

  function exportCsvFile() {
    if (!activePattern) return;
    writeCsv(activePattern);
  }

  function importCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = rowsFromCsv(String(reader.result));
      updateActivePattern((p) => ({ ...p, rows }));
      setSelected(null);
    };
    reader.readAsText(file);
  }

  function exportImageFile() {
    if (!activePattern) return;
    writeImage(activePattern);
  }

  // ---- sharing (Firebase Firestore realtime sync) ----

  function ensureShareListener(pattern: Pattern) {
    if (!firebaseReady() || !pattern.shareId) return;
    if (shareListenerPatternIdRef.current === pattern.id && shareUnsubRef.current) return;
    if (shareUnsubRef.current) {
      shareUnsubRef.current();
      shareUnsubRef.current = null;
    }
    shareListenerPatternIdRef.current = pattern.id;
    shareUnsubRef.current = listenToPattern(pattern.shareId, (data) => {
      applyRemoteSnapshotToPattern(pattern.id, data as PatternJson);
    });
  }

  function applyRemoteSnapshotToPattern(patternId: string, data: PatternJson) {
    const normalized = normalizePatternFromJson(data);
    skipNextSharePushRef.current = true;
    setState((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => {
        if (p.id !== patternId) return p;
        const next = { ...p };
        applyNormalizedDataToPattern(next, normalized);
        return next;
      }),
    }));
    setSelected(null);
  }

  async function shareCurrentPattern() {
    if (!activePattern) return;
    if (!firebaseReady()) {
      alert("共有機能がまだ設定されていません(Firebaseの設定が必要です)。");
      return;
    }
    let pattern = activePattern;
    if (!pattern.shareId) {
      const shareId = generateShareId();
      updateActivePattern((p) => ({ ...p, shareId }));
      pattern = { ...pattern, shareId };
    }
    try {
      await pushPatternToFirestore(pattern);
      ensureShareListener(pattern);
      const url = buildShareUrl(pattern.shareId!);
      window.history.replaceState(null, "", url.toString());
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url.toString()).catch(() => {});
      }
      setShareUrl(url.toString());
    } catch (e) {
      console.error(e);
      alert("共有リンクの作成に失敗しました: " + (e as Error).message);
    }
  }

  async function refreshShareFromServer() {
    if (!activePattern) return;
    if (!firebaseReady() || !activePattern.shareId) {
      alert("このパターンはまだ共有されていません。先に「共有リンクを作成/更新」を実行してください。");
      return;
    }
    try {
      const data = await fetchPatternFromFirestore(activePattern.shareId);
      if (!data) {
        alert("共有データが見つかりませんでした。");
        return;
      }
      applyRemoteSnapshotToPattern(activePattern.id, data as PatternJson);
    } catch (e) {
      console.error(e);
      alert("取得に失敗しました: " + (e as Error).message);
    }
  }

  // Load a shared pattern from ?share=<id> on first mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (!shareId || !firebaseReady()) return;

    const existing = stateRef.current.patterns.find((p) => p.shareId === shareId);
    if (existing) {
      setState((prev) => ({ ...prev, activeId: existing.id }));
      ensureShareListener(existing);
      return;
    }

    fetchPatternFromFirestore(shareId)
      .then((data) => {
        if (!data) {
          alert("指定された共有データが見つかりませんでした。");
          return;
        }
        const normalized = normalizePatternFromJson(data as PatternJson);
        const pattern = createPattern(normalized.name || "共有パターン", 1, 1);
        applyNormalizedDataToPattern(pattern, normalized);
        pattern.shareId = shareId;
        setState((prev) => ({ patterns: [...prev.patterns, pattern], activeId: pattern.id }));
        ensureShareListener(pattern);
      })
      .catch((e) => {
        console.error(e);
        alert("共有データの取得に失敗しました: " + (e as Error).message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    activePattern,
    mode,
    changeMode,
    selected,
    setSelected,
    currentColor,
    setCurrentColor,
    addPattern,
    deleteActivePattern,
    switchPattern,
    renameActivePattern,
    updateRowSpec,
    addRow,
    removeRow,
    toggleRowOnRiser,
    setPartScheme,
    setPartCount,
    autoColorizeByParts,
    clearAllNames,
    toggleCenterLine,
    toggleConductor,
    addLine,
    updateLinePos,
    removeLine,
    setCellName,
    onCellSwapClick,
    paintCell,
    exportJson,
    importJsonFile,
    exportCsvFile,
    importCsvFile,
    exportImageFile,
    shareUrl,
    dismissShareUrl: () => setShareUrl(null),
    shareCurrentPattern,
    refreshShareFromServer,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
