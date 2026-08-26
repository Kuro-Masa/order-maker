import { useEffect, useState } from "react";
import { RowsAccordionIcon, TrashIcon } from "../../icons";
import { rowOnRiser, segmentsTotal } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import type { RowData } from "../../types";
import { Accordion } from "./Accordion";

function RowEditorPanel({
  row,
  onSpecChange,
  onRiserToggle,
  onShiftChange,
}: {
  row: RowData;
  onSpecChange: (spec: string) => void;
  onRiserToggle: (checked: boolean) => void;
  onShiftChange: (shift: number) => void;
}) {
  const isMulti = row.segments.length >= 2;
  const [hasGap, setHasGap] = useState(isMulti);
  const [count, setCount] = useState(String(row.segments[0] ?? 0));
  const [leftCount, setLeftCount] = useState(String(row.segments[0] ?? 0));
  const [rightCount, setRightCount] = useState(String(row.segments[row.segments.length - 1] ?? 0));
  const [gapSize, setGapSize] = useState(String(row.gaps?.[0] ?? 4));

  useEffect(() => {
    const multi = row.segments.length >= 2;
    setHasGap(multi);
    if (multi) {
      setLeftCount(String(row.segments[0]));
      setRightCount(String(row.segments[row.segments.length - 1]));
      setGapSize(String(row.gaps?.[0] ?? 4));
    } else {
      setCount(String(row.segments[0] ?? 0));
    }
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
      setGapSize("4");
      onSpecChange(`${l},E4,${r}`);
    } else {
      const total = (parseInt(leftCount) || 0) + (parseInt(rightCount) || 0);
      setCount(String(total));
      onSpecChange(String(total));
    }
  }

  return (
    <div className="rowEditPanel">
      {hasGap ? (
        <div className="rowSpecGap">
          <input
            type="number"
            className="rowSpecInput compact"
            min={0}
            inputMode="numeric"
            value={leftCount}
            onChange={(e) => setLeftCount(e.target.value)}
            onBlur={() => commitGap(leftCount, gapSize, rightCount)}
          />
          <span className="rowSpecGapLabel">人 ← すき間 →</span>
          <input
            type="number"
            className="rowSpecInput compact"
            min={0}
            inputMode="numeric"
            value={rightCount}
            onChange={(e) => setRightCount(e.target.value)}
            onBlur={() => commitGap(leftCount, gapSize, rightCount)}
          />
          <span className="rowSpecGapLabel">人</span>
        </div>
      ) : (
        <div className="rowSpecSingle">
          <input
            type="number"
            className="rowSpecInput"
            min={0}
            inputMode="numeric"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            onBlur={() => commitSingle(count)}
          />
          <span className="rowSpecGapLabel">人</span>
        </div>
      )}
      {hasGap && (
        <div className="rowGapSizeRow">
          <span className="rowSpecGapLabel">すき間の幅:</span>
          <input
            type="number"
            className="rowSpecInput compact"
            min={0}
            step={0.25}
            inputMode="decimal"
            value={gapSize}
            onChange={(e) => setGapSize(e.target.value)}
            onBlur={() => commitGap(leftCount, gapSize, rightCount)}
          />
          <span className="rowSpecGapLabel">人分</span>
        </div>
      )}
      <label className="gapToggle">
        <input type="checkbox" checked={hasGap} onChange={(e) => toggleGap(e.target.checked)} />
        左右に分けて間を開ける
      </label>
      <label className="gapToggle">
        <input type="checkbox" checked={rowOnRiser(row)} onChange={(e) => onRiserToggle(e.target.checked)} />
        段に乗る
      </label>
      <div className="rowShiftControl">
        <span className="rowShiftLabel">横位置:</span>
        {([-1, 0, 1] as const).map((v) => (
          <button
            key={v}
            type="button"
            className={"btn rowShiftBtn" + ((row.shift ?? 0) === v ? " active" : "")}
            onClick={() => onShiftChange(v)}
          >
            {v === -1 ? "←" : v === 0 ? "中央" : "→"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RowSettingsContent() {
  const { activePattern, updateRowSpec, removeRow, toggleRowOnRiser, setRowShift, addRow } = useApp();
  const [selectedRow, setSelectedRow] = useState<number | null>(null);

  const rows = activePattern.rows;
  const displayOrder = [...rows.keys()].reverse();

  useEffect(() => {
    if (selectedRow !== null && selectedRow >= rows.length) {
      setSelectedRow(rows.length > 0 ? rows.length - 1 : null);
    }
  }, [rows.length, selectedRow]);

  return (
    <div className="rowsEditor">
      <p className="rowsEditorNote">
        横列ごとの人数を設定できます。行をタップして編集。
      </p>
      <div className="stageView">
        {displayOrder.map((r) => {
          const row = rows[r];
          const total = segmentsTotal(row.segments);
          const isSelected = selectedRow === r;
          return (
            <div
              key={r}
              className={"stageRow" + (isSelected ? " selected" : "")}
              onClick={() => setSelectedRow(isSelected ? null : r)}
            >
              <div className="stageRowCells">
                {Array.from({ length: Math.min(total, 24) }, (_, i) => (
                  <div key={i} className="stageRowDot" />
                ))}
                {total > 24 && <span className="stageRowMore">+{total - 24}</span>}
              </div>
              <span className="stageRowCount">{total}人</span>
              <button
                type="button"
                className="btn remove stageRowRemove"
                aria-label="この行を削除"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRow(r);
                  if (selectedRow === r) setSelectedRow(null);
                }}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>
      {selectedRow !== null && selectedRow < rows.length && (
        <RowEditorPanel
          key={selectedRow}
          row={rows[selectedRow]}
          onSpecChange={(spec) => updateRowSpec(selectedRow, spec)}
          onRiserToggle={(checked) => toggleRowOnRiser(selectedRow, checked)}
          onShiftChange={(shift) => setRowShift(selectedRow, shift)}
        />
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
