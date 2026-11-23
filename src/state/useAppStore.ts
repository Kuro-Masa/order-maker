import { useEffect, useMemo, useRef, useState } from "react";
import type { Unsubscribe } from "firebase/firestore";
import { DEFAULT_COL_COUNT, PALETTE, PART_SCHEMES } from "../constants";
import type { Mode, Pattern, PatternJson, Selected } from "../types";
import { loadShareBases, loadState, saveShareBases, saveState } from "./persistence";
import {
  createDefaultPattern,
  createPattern,
  createRow,
  makeId,
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
  CLIENT_ID,
  fetchPatternFromFirestore,
  firebaseReady,
  listenToPattern,
  pushMergedPatternToFirestore,
  pushPatternToFirestore,
} from "../features/share/share";
import { canonicalFromJson, canonicalFromPattern, merge3, sameData, type SyncData } from "../features/share/merge";

export function useAppStore() {
  const [state, setState] = useState(() => loadState());
  const [screen, setScreen] = useState<"list" | "edit">("list");
  const [mode, setModeRaw] = useState<Mode>("edit");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [currentColor, setCurrentColor] = useState<string | null>(PALETTE[0]);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharedSession, setIsSharedSession] = useState(false);
  const [toolbarMode, setToolbarMode] = useState<string>("rows");
  const [selectedEditRow, setSelectedEditRow] = useState<number | null>(null);
  // Each entry keeps the pattern before and after one local edit, so undo can revert just that edit
  const [undoStack, setUndoStack] = useState<{ before: Pattern; after: Pattern }[]>([]);

  const stateRef = useRef(state);
  const shareUnsubRef = useRef<Unsubscribe | null>(null);
  const shareListenerPatternIdRef = useRef<string | null>(null);
  // Last version of each shared pattern known to be on the server; the base for merging edits
  const shareBasesRef = useRef<Record<string, SyncData>>(loadShareBases<SyncData>());
  const pushTimersRef = useRef(new Map<string, number>());
  const pushInFlightRef = useRef(new Set<string>());
  const pushAgainRef = useRef(new Set<string>());
  const prevPatternsRef = useRef<Pattern[] | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activePattern = useMemo(
    () => state.patterns.find((p) => p.id === state.activeId) || state.patterns[0],
    [state]
  );

  function setShareBase(patternId: string, data: SyncData) {
    const alive = new Set(stateRef.current.patterns.map((p) => p.id));
    alive.add(patternId);
    const next: Record<string, SyncData> = {};
    for (const [id, d] of Object.entries(shareBasesRef.current)) if (alive.has(id)) next[id] = d;
    next[patternId] = data;
    shareBasesRef.current = next;
    saveShareBases(next);
  }

  function schedulePush(patternId: string, delay = 800) {
    if (!firebaseReady()) return;
    const timers = pushTimersRef.current;
    const pending = timers.get(patternId);
    if (pending) window.clearTimeout(pending);
    timers.set(
      patternId,
      window.setTimeout(() => {
        timers.delete(patternId);
        void pushNow(patternId);
      }, delay)
    );
  }

  function flushPendingPushes() {
    for (const [patternId, timer] of pushTimersRef.current) {
      window.clearTimeout(timer);
      pushTimersRef.current.delete(patternId);
      void pushNow(patternId);
    }
  }

  async function pushNow(patternId: string) {
    // One write per pattern at a time, so each push merges on top of the previous result
    if (pushInFlightRef.current.has(patternId)) {
      pushAgainRef.current.add(patternId);
      return;
    }
    // Read the latest state at send time, not the state when the timer was set
    const latest = stateRef.current.patterns.find((p) => p.id === patternId);
    if (!latest?.shareId) return;
    const base = shareBasesRef.current[patternId];
    // Without a known server version a write could wipe others' edits: wait for the listener
    if (!base) return;
    const sent = canonicalFromPattern(latest);
    if (sameData(sent, base)) return; // nothing local to send
    pushInFlightRef.current.add(patternId);
    let retryDelay: number | null = null;
    try {
      const merged = await pushMergedPatternToFirestore(latest, base);
      setShareBase(patternId, merged);
      if (!sameData(merged, sent)) {
        // The server had edits from others: bring them in without dropping anything typed meanwhile
        const current = stateRef.current.patterns.find((p) => p.id === patternId);
        if (current) applySyncedData(patternId, merge3(sent, canonicalFromPattern(current), merged));
      }
    } catch (e) {
      // Offline or contention: never fall back to a blind overwrite, just try the merge again later
      console.error(e);
      retryDelay = 5000;
    } finally {
      pushInFlightRef.current.delete(patternId);
      if (pushAgainRef.current.delete(patternId)) retryDelay = Math.min(retryDelay ?? 0, 300);
      if (retryDelay !== null) schedulePush(patternId, retryDelay);
    }
  }

  useEffect(() => {
    saveState(state);
    // Queue a push for every shared pattern that changed; pushNow skips ones that match the server
    const prev = prevPatternsRef.current;
    prevPatternsRef.current = state.patterns;
    for (const p of state.patterns) {
      if (!p.shareId) continue;
      if (prev && prev.find((q) => q.id === p.id) === p) continue;
      schedulePush(p.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    // Send pending edits right away when the app goes to the background or comes back online
    function onVisibility() {
      if (document.visibilityState === "hidden") flushPendingPushes();
    }
    function onOnline() {
      for (const p of stateRef.current.patterns) if (p.shareId) schedulePush(p.id, 0);
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushPendingPushes);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushPendingPushes);
      window.removeEventListener("online", onOnline);
      if (shareUnsubRef.current) shareUnsubRef.current();
      shareUnsubRef.current = null;
      shareListenerPatternIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updatePatternById(patternId: string, updater: (p: Pattern) => Pattern) {
    setState((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => (p.id === patternId ? updater(p) : p)),
    }));
  }

  function updateActivePattern(updater: (p: Pattern) => Pattern) {
    if (!activePattern) return;
    const before = activePattern;
    const after = { ...updater(before), updatedAt: Date.now() };
    setUndoStack((prev) => [...prev.slice(-49), { before, after }]);
    updatePatternById(before.id, (p) => (p === before ? after : { ...updater(p), updatedAt: after.updatedAt }));
  }

  function undo() {
    if (undoStack.length === 0) return;
    const { before, after } = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    // Revert only what that edit changed; edits other members made since then stay
    updatePatternById(before.id, (current) => merge3(after, before, current));
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
    setToolbarMode("rows");
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
    setUndoStack([]);
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

  function duplicatePattern(patternId: string) {
    const idx = state.patterns.findIndex((p) => p.id === patternId);
    if (idx < 0) return;
    const original = state.patterns[idx];
    const copy: Pattern = JSON.parse(JSON.stringify(original));
    copy.id = makeId();
    copy.name = "コピー_" + original.name;
    copy.shareId = null;
    copy.updatedAt = Date.now();
    const newPatterns = state.patterns.slice();
    newPatterns.splice(idx + 1, 0, copy);
    setState((prev) => ({ ...prev, patterns: newPatterns, activeId: copy.id }));
    setSelected(null);
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

  function setRiserWidth(rowIndex: number, width: number | undefined) {
    updateActivePattern((p) => {
      const rows = p.rows.slice();
      rows[rowIndex] = { ...rows[rowIndex], riserWidth: width };
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

  function setCurve(curve: number) {
    updateActivePattern((p) => ({ ...p, curve: Math.min(100, Math.max(0, Math.round(curve))) }));
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

  function clearColorFromCells(color: string) {
    updateActivePattern((p) => ({
      ...p,
      rows: p.rows.map((row) => ({
        ...row,
        cells: row.cells.map((cell) =>
          cell.color === color ? { ...cell, color: null } : cell
        ),
      })),
    }));
  }

  function toggleSpecialMarker(id: string, label: string, side: "left" | "right") {
    updateActivePattern((p) => {
      const markers = p.specialMarkers ?? [];
      const exists = markers.some((m) => m.id === id);
      return {
        ...p,
        specialMarkers: exists
          ? markers.filter((m) => m.id !== id)
          : [...markers, { id, label, side }],
      };
    });
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
      handleRemoteSnapshot(pattern.id, data as PatternJson);
    });
  }

  function handleRemoteSnapshot(patternId: string, data: PatternJson) {
    const remote = canonicalFromJson(data);
    const base = shareBasesRef.current[patternId];
    setShareBase(patternId, remote);
    // Echo of this tab's own write: local state is already at least this new
    if (data.writerId === CLIENT_ID) return;
    const current = stateRef.current.patterns.find((p) => p.id === patternId);
    if (!current) return;
    if (!base) {
      applyRemoteSnapshotToPattern(patternId, data);
      return;
    }
    // Keep local edits that haven't been sent yet instead of rolling them back
    const local = canonicalFromPattern(current);
    const merged = merge3(base, local, remote);
    if (!sameData(merged, local)) applySyncedData(patternId, merged);
  }

  function applySyncedData(patternId: string, data: SyncData) {
    const normalized = normalizePatternFromJson(data);
    setState((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => {
        if (p.id !== patternId) return p;
        const next = { ...p };
        applyNormalizedDataToPattern(next, normalized);
        return next;
      }),
    }));
  }

  function applyRemoteSnapshotToPattern(patternId: string, data: PatternJson) {
    const normalized = normalizePatternFromJson(data);
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
      const base = shareBasesRef.current[pattern.id];
      if (base) {
        // Already shared: merge onto the server copy instead of replacing others' edits
        setShareBase(pattern.id, await pushMergedPatternToFirestore(pattern, base));
      } else if (!activePattern.shareId) {
        // First share: the document is new, so writing it whole is safe.
        // (Already shared but no known server version: the listener will sync it instead.)
        await pushPatternToFirestore(pattern);
        setShareBase(pattern.id, canonicalFromPattern(pattern));
      }
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
      setShareBase(activePattern.id, canonicalFromJson(data as PatternJson));
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
      setIsSharedSession(true);
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
        setShareBase(pattern.id, canonicalFromJson(data as PatternJson));
        setState((prev) => ({ ...prev, patterns: [...prev.patterns, pattern], activeId: pattern.id }));
        ensureShareListener(pattern);
        setIsSharedSession(true);
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
    duplicatePattern,
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
    setRiserWidth,
    setRowShift,
    setCurve,
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
    isSharedSession,
    shareCurrentPattern,
    refreshShareFromServer,
    members: activePattern?.members ?? [],
    setMembers: (members: import("../types").Member[]) =>
      updateActivePattern((p) => ({ ...p, members })),
    clearMembers: () =>
      updateActivePattern((p) => ({ ...p, members: [] })),
    removeMember: (id: string) =>
      updateActivePattern((p) => ({ ...p, members: (p.members ?? []).filter((m) => m.id !== id) })),
    clearColorFromCells,
    toggleSpecialMarker,
    undo,
    canUndo: undoStack.length > 0,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
