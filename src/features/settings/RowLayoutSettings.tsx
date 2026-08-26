import { useEffect, useRef, useState } from "react";
import { RowsAccordionIcon, TrashIcon } from "../../icons";
import { rowOnRiser } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import type { RowData } from "../../types";
import { Accordion } from "./Accordion";

function RowEditorPanel({
  row,
  rowNum,
  onSpecChange,
  onRiserToggle,
  onRiserWidthChange,
  onShiftChange,
  onRemove,
}: {
  row: RowData;
  rowNum: number;
  onSpecChange: (spec: string) => void;
  onRiserToggle: (checked: boolean) => void;
  onRiserWidthChange: (width: number | undefined) => void;
  onShiftChange: (shift: number) => void;
  onRemove: () => void;
}) {
  const isMulti = row.segments.length >= 2;
  const [hasGap, setHasGap] = useState(isMulti);
  const [count, setCount] = useState(String(row.segments[0] ?? 0));
  const [leftCount, setLeftCount] = useState(String(row.segments[0] ?? 0));
  const [rightCount, setRightCount] = useState(String(row.segments[row.segments.length - 1] ?? 0));
  const [gapSize, setGapSize] = useState(String(row.gaps?.[0] ?? 3));
  const [riserWidthStr, setRiserWidthStr] = useState(
    row.riserWidth != null ? String(row.riserWidth) : ""
  );

  const isOnRiser = rowOnRiser(row);
  const isShifted = (row.shift ?? 0) !== 0;

  useEffect(() => {
    const multi = row.segments.length >= 2;
    setHasGap(multi);
    if (multi) {
      setLeftCount(String(row.segments[0]));
      setRightCount(String(row.segments[row.segments.length - 1]));
      setGapSize(String(row.gaps?.[0] ?? 3));
    } else {
      setCount(String(row.segments[0] ?? 0));
    }
    setRiserWidthStr(row.riserWidth != null ? String(row.riserWidth) : "");
  }, [row]);

  function commitSingle(val: string) {
    onSpecChange(String(parseInt(val) || 0));
  }

  function commitGap(l: string, g: string, r: string) {
    onSpecChange(`${parseInt(l) || 0},E${parseFloat(g) || 1},${parseInt(r) || 0}`);
  }

  function toggleGap(on: boolean) {
    setHasGap(on);
    if (on) {
      const n = parseInt(count) || 0;
      const l = Math.floor(n / 2);
      const r = n - l;
      setLeftCount(String(l));
      setRightCount(String(r));
      setGapSize("3");
      onSpecChange(`${l},E3,${r}`);
    } else {
      const total = (parseInt(leftCount) || 0) + (parseInt(rightCount) || 0);
      setCount(String(total));
      onSpecChange(String(total));
    }
  }

  function computeDefaultRiserWidth() {
    const segs = row.segments.reduce((a, b) => a + b, 0);
    const gaps = row.gaps?.reduce((a, b) => a + b, 0) ?? 0;
    return segs + Math.round(gaps) + 1;
  }

  function handleRiserToggle(on: boolean) {
    if (on) {
      const defaultW = computeDefaultRiserWidth();
      setRiserWidthStr(String(defaultW));
      onRiserToggle(true);
      onRiserWidthChange(defaultW);
    } else {
      setRiserWidthStr("");
      onRiserToggle(false);
      onRiserWidthChange(undefined);
    }
  }

  function handleShiftToggle(on: boolean) {
    onShiftChange(on ? ((row.shift ?? 0) !== 0 ? (row.shift ?? -1) : -1) : 0);
  }

  function commitRiserWidth(val: string) {
    const n = parseInt(val);
    onRiserWidthChange(isNaN(n) || n <= 0 ? undefined : n);
  }

  const label = rowNum === 1 ? "一番前の列" : `前から${rowNum}番目の列`;

  return (
    <div className="rowEditPanelInner">
      <div className="rowEditPanelHeader">
        <p className="rowEditLabel">{label}</p>
        <button
          type="button"
          className="btn remove rowEditDelete"
          aria-label="この列を削除"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <TrashIcon />
        </button>
      </div>

      {/* 左右に分けて間を開ける */}
      <label className="toggleSwitch">
        <input type="checkbox" checked={hasGap} onChange={(e) => toggleGap(e.target.checked)} />
        <span className="toggleTrack" />
        左右に分けて間を開ける
      </label>
      <div className="rowSubContent">
        {hasGap ? (
          <div className="rowGapInline">
            <input
              type="number" className="rowSpecInput compact" min={0} inputMode="numeric"
              value={leftCount}
              onChange={(e) => setLeftCount(e.target.value)}
              onBlur={() => commitGap(leftCount, gapSize, rightCount)}
            />
            <span className="rowGapMidLabel">人 ← 間</span>
            <input
              type="number" className="rowSpecInput compact" min={0} step={0.25} inputMode="decimal"
              value={gapSize}
              onChange={(e) => setGapSize(e.target.value)}
              onBlur={() => commitGap(leftCount, gapSize, rightCount)}
            />
            <span className="rowGapMidLabel">人分 →</span>
            <input
              type="number" className="rowSpecInput compact" min={0} inputMode="numeric"
              value={rightCount}
              onChange={(e) => setRightCount(e.target.value)}
              onBlur={() => commitGap(leftCount, gapSize, rightCount)}
            />
            <span className="rowGapMidLabel">人</span>
          </div>
        ) : (
          <div className="rowGapInline">
            <input
              type="number" className="rowSpecInput" min={0} inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              onBlur={() => commitSingle(count)}
            />
            <span className="rowSpecGapLabel">人</span>
          </div>
        )}
      </div>

      {/* 段に乗る */}
      <label className="toggleSwitch">
        <input type="checkbox" checked={isOnRiser} onChange={(e) => handleRiserToggle(e.target.checked)} />
        <span className="toggleTrack" />
        段に乗る
      </label>
      {isOnRiser && (
        <div className="rowSubContent">
          <div className="rowGapInline">
            <input
              type="number" className="rowSpecInput compact" min={1} inputMode="numeric"
              value={riserWidthStr}
              onChange={(e) => setRiserWidthStr(e.target.value)}
              onBlur={() => commitRiserWidth(riserWidthStr)}
            />
            <span className="rowSpecGapLabel">人分の幅</span>
          </div>
        </div>
      )}

      {/* 列を横にずらす */}
      <label className="toggleSwitch">
        <input type="checkbox" checked={isShifted} onChange={(e) => handleShiftToggle(e.target.checked)} />
        <span className="toggleTrack" />
        列を横にずらす
      </label>
      {isShifted && (
        <div className="rowSubContent">
          <div className="rowShiftInline">
            {([-1, 1] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={"btn rowShiftBtn" + ((row.shift ?? 0) === v ? " active" : "")}
                onClick={(e) => { e.stopPropagation(); onShiftChange(v); }}
              >
                {v === -1 ? "←" : "→"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RowSettingsContent() {
  const {
    activePattern, updateRowSpec, removeRow, toggleRowOnRiser,
    setRiserWidth, setRowShift, selectedEditRow, setSelectedEditRow,
  } = useApp();
  const rows = activePattern.rows;
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (selectedEditRow !== null && selectedEditRow < rows.length) {
      cardRefs.current[selectedEditRow]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedEditRow, rows.length]);

  return (
    <div className="rowsEditor">
      {rows.length === 0 && (
        <p className="rowsEditorNote rowsEditorHint">
          レイアウトで「＋ 列を追加」を押して列を追加してください。
        </p>
      )}
      {rows.map((row, r) => {
        const rowNum = rows.length - r;
        const isSelected = selectedEditRow === r;
        return (
          <div
            key={r}
            ref={(el) => { cardRefs.current[r] = el; }}
            className={"rowEditCard" + (isSelected ? " rowEditCardSelected" : "")}
            onClick={() => setSelectedEditRow(r)}
          >
            <RowEditorPanel
              row={row}
              rowNum={rowNum}
              onSpecChange={(spec) => updateRowSpec(r, spec)}
              onRiserToggle={(checked) => toggleRowOnRiser(r, checked)}
              onRiserWidthChange={(w) => setRiserWidth(r, w)}
              onShiftChange={(shift) => setRowShift(r, shift)}
              onRemove={() => { removeRow(r); setSelectedEditRow(null); }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function RowLayoutSettings() {
  return (
    <Accordion icon={<RowsAccordionIcon />} title="配置する枠の設定">
      <RowSettingsContent />
    </Accordion>
  );
}
