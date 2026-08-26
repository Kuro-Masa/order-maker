import { useEffect, useState, type KeyboardEvent } from "react";
import { RowsAccordionIcon, TrashIcon } from "../../icons";
import { computeTotals, rowOnRiser, serializeRowSpec, showsConductor } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import type { RowData } from "../../types";
import { Accordion } from "./Accordion";

function RowEditorItem({
  row,
  onSpecChange,
  onRemove,
  onRiserToggle,
  onShiftChange,
}: {
  row: RowData;
  onSpecChange: (spec: string) => void;
  onRemove: () => void;
  onRiserToggle: (checked: boolean) => void;
  onShiftChange: (shift: number) => void;
}) {
  const [text, setText] = useState(serializeRowSpec(row));

  useEffect(() => {
    setText(serializeRowSpec(row));
  }, [row]);

  function commit() {
    onSpecChange(text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  }

  return (
    <div className="rowItem">
      <div className="rowItemTop">
        <input
          type="text"
          className="rowSpecInput"
          inputMode="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="btn remove"
          aria-label="この行を削除"
          title="この行を削除"
          onClick={onRemove}
        >
          <TrashIcon />
        </button>
      </div>
      <label className="riserToggle">
        <input type="checkbox" checked={rowOnRiser(row)} onChange={(e) => onRiserToggle(e.target.checked)} />
        段に乗る(プレビューに背景を表示)
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
        ))}</div>
    </div>
  );
}

export function RowSettingsContent() {
  const { activePattern, updateRowSpec, removeRow, toggleRowOnRiser, setRowShift, addRow, toggleConductor } = useApp();
  const { cellsTotal, mismatch } = computeTotals(activePattern);

  return (
    <div className="rowsEditor">
      <p className="rowsEditorNote">
        横列ごとに人数を設定してください。例: 「8」で8人、「5,E0.25,5」で5人+すき間+5人、「5,E2,5」ですき間をマス2個分に指定(小数も可・Eは人数に含みません)
      </p>
      <div className="rowsList">
        {activePattern.rows.map((row, r) => (
          <RowEditorItem
            key={r}
            row={row}
            onSpecChange={(spec) => updateRowSpec(r, spec)}
            onRemove={() => removeRow(r)}
            onRiserToggle={(checked) => toggleRowOnRiser(r, checked)}
            onShiftChange={(shift) => setRowShift(r, shift)}
          />
        ))}
      </div>
      <button type="button" className="btn" onClick={addRow}>
        ＋ 行を追加
      </button>
      <p className={"partTotalSummary" + (mismatch ? " mismatch" : "")}>マスの数: {cellsTotal}個</p>
      <label className="conductorToggle">
        <input
          type="checkbox"
          checked={showsConductor(activePattern)}
          onChange={(e) => toggleConductor(e.target.checked)}
        />
        一番下の中央に指揮者マークを表示
      </label>
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
