import { useEffect, useState, type KeyboardEvent } from "react";
import { RowsAccordionIcon, TrashIcon } from "../../icons";
import { computeTotals, rowIsOffset, rowOnRiser, serializeRowSpec, showsConductor } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import type { RowData } from "../../types";
import { Accordion } from "./Accordion";

function RowEditorItem({
  row,
  r,
  isLast,
  onSpecChange,
  onRemove,
  onRiserToggle,
  onStaggerToggle,
}: {
  row: RowData;
  r: number;
  isLast: boolean;
  onSpecChange: (spec: string) => void;
  onRemove: () => void;
  onRiserToggle: (checked: boolean) => void;
  onStaggerToggle: (checked: boolean) => void;
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
      {!isLast && (
        <label className="riserToggle">
          <input type="checkbox" checked={rowIsOffset(row, r)} onChange={(e) => onStaggerToggle(e.target.checked)} />
          前列から半歩ずらす
        </label>
      )}
    </div>
  );
}

export function RowLayoutSettings() {
  const { activePattern, updateRowSpec, removeRow, toggleRowOnRiser, toggleRowStagger, addRow, toggleConductor } = useApp();
  const { cellsTotal, mismatch } = computeTotals(activePattern);

  return (
    <Accordion icon={<RowsAccordionIcon />} title="配置する枠の設定">
      <div className="rowsEditor">
        <p className="rowsEditorNote">
          横列ごとに人数を設定してください。例: 「8」で8人、「5,5」で5人+すき間(既定0.25マス分)+5人、「5,E2,5」ですき間をマス2個分に指定(小数も可)
        </p>
        <div className="rowsList">
          {activePattern.rows.map((row, r) => (
            <RowEditorItem
              key={r}
              row={row}
              r={r}
              isLast={r === activePattern.rows.length - 1}
              onSpecChange={(spec) => updateRowSpec(r, spec)}
              onRemove={() => removeRow(r)}
              onRiserToggle={(checked) => toggleRowOnRiser(r, checked)}
              onStaggerToggle={(checked) => toggleRowStagger(r, checked)}
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
    </Accordion>
  );
}
