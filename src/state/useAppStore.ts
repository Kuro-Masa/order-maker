import { useEffect, useMemo, useRef, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { DEFAULT_COL_COUNT, PALETTE, PART_SCHEMES } from "../constants";
import type { Mode, Pattern, PatternJson, Selected } from "../types";
import { loadState, saveState } from "./persistence";
import {
  createDefaultPattern,
  createPattern,
  createRow,
  makeLineId,
  parseRowSpec,
  regenerateRowCells,
  segmentsTotal,
} from "./patternHelpers";
import {
  applyNormalizedDataToPattern,
  normalizePatternFromJson,
} from "../features/io/json";
import { exportImage as writeImage } from "../features/io/imageExport";
import {
  buildShareUrl,
  fetchPatternFromFirestore,
  firebaseReady,
  listenToPattern,
  pushPatternToFirestore,
} from "../features/share/share";

export function useAppStore() {
  const [state, setState] = useState(() => loadState());
  const [screen, setScreen] = useState<"list" | "edit">("list");
  const [mode, setModeRaw] = useState<Mode>("edit");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [currentColor, setCurrentColor] = useState<string | null>(PALETTE[0]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [toolbarMode, setToolbarMode] = useState<string>("rows");
  const [selectedEditRow, setSelectedEditRow] = useState<number | null>(null);

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

  // ---- screen navigation ----

  function navigateToEdit(patternId?: string, { replace = false } = {}) {
    const id = patternId ?? state.activeId;
    if (patternId && patternId !== state.activeId) {
      setState((prev) => ({ ...prev, activeId: patternId }));
      setSelected(null);
    }
    setScreen("edit");
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("layout", id);
    url.searchParams.delete("share");
    if (replace) {
      window.history.replaceState(null, "", url.toString());
    } else {
      window.history.pushState(null, "", url.toString());
    }
  }

  function navigateToList() {
    setScreen("list");
    window.history.pushState(null, "", window.location.pathname);
  }

  // ---- pattern (tab) management ----

  function addPattern() {
    const pattern = createDefaultPattern("パターン" + (state.patterns.length + 1));
    setState((prev) => ({ ...prev, patterns: [...prev.patterns, pattern], activeId: pattern.id }));
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
    setState((prev) => ({ ...prev, patterns: newPatterns, activeId: next.id }));
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

  function renamePattern(patternId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    updatePatternById(patternId, (p) => ({ ...p, name: trimmed }));
  }

  function deletePattern(patternId: string) {
    const idx = state.patterns.findIndex((p) => p.id === patternId);
    if (idx < 0) return;
    const removedId = state.patterns[idx].id;
    let newPatterns = state.patterns.filter((p) => p.id !== patternId);
    let newActiveId: string;
    if (newPatterns.length === 0) {
      const fresh = createDefaultPattern("パターン1");
      newPatterns = [fresh];
      newActiveId = fresh.id;
    } else {
      newActiveId = newPatterns[Math.max(0, idx - 1)].id;
    }
    setState((prev) => ({ ...prev, patterns: newPatterns, activeId: newActiveId }));
    setSelected(null);
    if (shareListenerPatternIdRef.current === removedId && shareUnsubRef.current) {
      shareUnsubRef.current();
      shareUnsubRef.current = null;
      shareListenerPatternIdRef.current = null;
    }
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

  function addCellToRow(rowIndex: number, side: "left" | "right") {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      const row = { ...rows[rowIndex] };
      const segments = row.segments.slice();
      const cells = row.cells.slice();
      const newCell = { name: "", color: null };
      if (side === "right") {
        segments[segments.length - 1]++;
        cells.push(newCell);
      } else {
        segments[0]++;
        cells.unshift(newCell);
      }
      row.shift = 0;
      rows[rowIndex] = { ...row, segments, cells };
      return { ...p, rows };
    });
  }

  function toggleRowOnRiser(rowIndex: number, checked: boolean) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      rows[rowIndex] = { ...rows[rowIndex], onRiser: checked };
      return { ...p, rows };
    });
  }

  function setRowShift(rowIndex: number, shift: number) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      rows[rowIndex] = { ...rows[rowIndex], shift };
      return { ...p, rows };
    });
  }

  // ---- part color settings ----

  function setPartScheme(scheme: string) {
    updateActivePattern((p) => ({ ...p, partSettings: { scheme, counts: {} } }));
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
      const newPattern = { ...p, rows };
      const parts = PART_SCHEMES[p.partSettings.scheme];
      if (parts) {
        const allCells = newPattern.rows.flatMap((row) => row.cells);
        const counts: Record<string, number> = {};
        parts.forEach((part) => {
          counts[part.key] = allCells.filter((cell) => cell.color === part.color).length;
        });
        return { ...newPattern, partSettings: { ...newPattern.partSettings, counts } };
      }
      return newPattern;
    });
  }

  // ---- mode ----

  function changeMode(newMode: Mode) {
    setModeRaw(newMode);
    setSelected(null);
  }

  // ---- export / import ----

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
      // Use the pattern's own id as the Firestore document id
      const shareId = pattern.id;
      updateActivePattern((p) => ({ ...p, shareId }));
      pattern = { ...pattern, shareId };
    }
    try {
      await pushPatternToFirestore(pattern);
      ensureShareListener(pattern);
      const shareUrl = buildShareUrl(pattern.shareId!);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareUrl.toString()).catch(() => {});
      }
      setShareUrl(shareUrl.toString());
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

  // On first mount: restore screen from URL params (?layout= or ?share=).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const layoutId = params.get("layout");
    const shareId = params.get("share");

    // ?layout=:id → open that pattern directly
    if (layoutId && !shareId) {
      const pattern = stateRef.current.patterns.find((p) => p.id === layoutId);
      if (pattern) navigateToEdit(layoutId, { replace: true });
      else window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    // ?share=:shareId → load from Firestore and open
    if (!shareId || !firebaseReady()) return;

    const existing = stateRef.current.patterns.find(
      (p) => p.shareId === shareId || p.id === shareId
    );
    if (existing) {
      setState((prev) => ({ ...prev, activeId: existing.id }));
      ensureShareListener(existing);
      setScreen("edit");
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
        setState((prev) => ({ ...prev, patterns: [...prev.patterns, pattern], activeId: pattern.id }));
        ensureShareListener(pattern);
        setScreen("edit");
      })
      .catch((e) => {
        console.error(e);
        alert("共有データの取得に失敗しました: " + (e as Error).message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward button
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const layoutId = params.get("layout");
      if (layoutId) {
        const pattern = stateRef.current.patterns.find((p) => p.id === layoutId);
        if (pattern) {
          setState((prev) => ({ ...prev, activeId: layoutId }));
          setSelected(null);
          setScreen("edit");
        } else {
          setScreen("list");
        }
      } else {
        setScreen("list");
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return {
    state,
    activePattern,
    screen,
    navigateToEdit,
    navigateToList,
    mode,
    changeMode,
    toolbarMode,
    setToolbarMode,
    selectedEditRow,
    setSelectedEditRow,
    selected,
    setSelected,
    currentColor,
    setCurrentColor,
    addPattern,
    deleteActivePattern,
    switchPattern,
    renameActivePattern,
    renamePattern,
    deletePattern,
    updateRowSpec,
    addRow,
    removeRow,
    addCellToRow,
    toggleRowOnRiser,
    setRowShift,
    setPartScheme,
    clearAllNames,
    toggleCenterLine,
    toggleConductor,
    addLine,
    updateLinePos,
    removeLine,
    setCellName,
    onCellSwapClick,
    paintCell,
    exportImageFile,
    shareUrl,
    dismissShareUrl: () => setShareUrl(null),
    shareCurrentPattern,
    refreshShareFromServer,
    members: state.members,
    setMembers: (members: import("../types").Member[]) =>
      setState((prev) => ({ ...prev, members })),
    clearMembers: () => setState((prev) => ({ ...prev, members: [] })),
    removeMember: (id: string) =>
      setState((prev) => ({ ...prev, members: prev.members.filter((m) => m.id !== id) })),
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
