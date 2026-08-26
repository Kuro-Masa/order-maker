import { useEffect, useState } from "react";
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
  rowNum: number;   // 1 = front
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

  function commitRiserWidth(val: string) {
    const n = parseInt(val);
    onRiserWidthChange(isNaN(n) || n <= 0 ? undefined : n);
  }

  const label = rowNum === 1 ? "一番前の列を編集中" : `前から${rowNum}番目の列を編集中`;

  return (
    <div className="rowEditPanel">
      <p className="rowsEditorNote rowEditLabel">{label}</p>

      {/* Top row: count + shift + delete */}
      <div className="rowEditTopRow">
        <div className="rowEditCounts">
          {hasGap ? (
            <>
              <input
                type="number" className="rowSpecInput compact" min={0} inputMode="numeric"
                value={leftCount}
                onChange={(e) => setLeftCount(e.target.value)}
                onBlur={() => commitGap(leftCount, gapSize, rightCount)}
              />
              <span className="rowSpecGapLabel">←</span>
              <input
                type="number" className="rowSpecInput compact" min={0} inputMode="numeric"
                value={rightCount}
                onChange={(e) => setRightCount(e.target.value)}
                onBlur={() => commitGap(leftCount, gapSize, rightCount)}
              />
            </>
          ) : (
            <>
              <input
                type="number" className="rowSpecInput" min={0} inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                onBlur={() => commitSingle(count)}
              />
              <span className="rowSpecGapLabel">人</span>
            </>
          )}
        </div>
        <div className="rowShiftInline">
          {([-1, 0, 1] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={"btn rowShiftBtn" + ((row.shift ?? 0) === v ? " active" : "")}
              onClick={() => onShiftChange(v)}
            >
              {v === -1 ? "←" : v === 0 ? "中" : "→"}
            </button>
          ))}
        </div>
        <button type="button" className="btn remove rowEditDelete" aria-label="この列を削除" onClick={onRemove}>
          <TrashIcon />
        </button>
      </div>

      {/* Gap size */}
      {hasGap && (
        <div className="rowGapSizeRow">
          <span className="rowSpecGapLabel">すき間:</span>
          <input
            type="number" className="rowSpecInput compact" min={0} step={0.25} inputMode="decimal"
            value={gapSize}
            onChange={(e) => setGapSize(e.target.value)}
            onBlur={() => commitGap(leftCount, gapSize, rightCount)}
          />
          <span className="rowSpecGapLabel">人分</span>
        </div>
      )}

      {/* Gap toggle */}
      <label className="gapToggle">
        <input type="checkbox" checked={hasGap} onChange={(e) => toggleGap(e.target.checked)} />
        左右に分けて間を開ける
      </label>

      {/* Riser toggle + width */}
      <div className="riserToggleRow">
        <label className="gapToggle" style={{ flex: 1 }}>
          <input type="checkbox" checked={rowOnRiser(row)} onChange={(e) => onRiserToggle(e.target.checked)} />
          段に乗る
        </label>
        {rowOnRiser(row) && (
          <>
            <input
              type="number" className="rowSpecInput compact" min={1} inputMode="numeric"
              placeholder="自動"
              value={riserWidthStr}
              onChange={(e) => setRiserWidthStr(e.target.value)}
              onBlur={() => commitRiserWidth(riserWidthStr)}
            />
            <span className="rowSpecGapLabel">人分の幅</span>
          </>
        )}
      </div>
    </div>
  );
}

export function RowSettingsContent() {
  const { activePattern, updateRowSpec, removeRow, toggleRowOnRiser, setRiserWidth, setRowShift, addRow, selectedEditRow, setSelectedEditRow } = useApp();
  const rows = activePattern.rows;

  useEffect(() => {
    if (selectedEditRow !== null && selectedEditRow >= rows.length) {
      setSelectedEditRow(rows.length > 0 ? rows.length - 1 : null);
    }
  }, [rows.length, selectedEditRow, setSelectedEditRow]);

  const validSelection = selectedEditRow !== null && selectedEditRow < rows.length;
  const rowNum = validSelection ? rows.length - selectedEditRow : 0;

  return (
    <div className="rowsEditor">
      {validSelection ? (
        <RowEditorPanel
          key={selectedEditRow}
          row={rows[selectedEditRow]}
          rowNum={rowNum}
          onSpecChange={(spec) => updateRowSpec(selectedEditRow, spec)}
          onRiserToggle={(checked) => toggleRowOnRiser(selectedEditRow, checked)}
          onRiserWidthChange={(w) => setRiserWidth(selectedEditRow, w)}
          onShiftChange={(shift) => setRowShift(selectedEditRow, shift)}
          onRemove={() => { removeRow(selectedEditRow); setSelectedEditRow(null); }}
        />
      ) : (
        <p className="rowsEditorNote rowsEditorHint">
          上のレイアウトで編集したい列をタップしてください。
        </p>
      )}
      <button type="button" className="btn addRowBtn" onClick={addRow}>
        ＋ 行を追加
      </button>
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
