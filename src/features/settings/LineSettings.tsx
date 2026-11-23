import { LinesAccordionIcon, TrashIcon } from "../../icons";
import { showsCenterLine } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Accordion } from "./Accordion";
import { MAX_LINE_ANGLE } from "../io/json";
import type { LineData } from "../../types";

export function LineItemRow({ line }: { line: LineData }) {
  const { updateLinePos, updateLineAngle, removeLine } = useApp();
  const angle = Math.round(line.angle ?? 0);
  return (
    <div className="lineItem">
      <div className="lineItemMain">
        <span className="lineTypeLabel">縦線</span>
        <input
          type="number"
          aria-label="線の位置"
          value={Math.round(line.pos)}
          onChange={(e) => updateLinePos(line.id, parseFloat(e.target.value) || 0)}
        />
        <button
          type="button"
          className="btn remove"
          aria-label="この線を削除"
          title="この線を削除"
          onClick={() => removeLine(line.id)}
        >
          <TrashIcon />
        </button>
      </div>
      <div className="lineItemAngle">
        <span className="lineTypeLabel">角度</span>
        <input
          type="range"
          className="lineAngleSlider"
          aria-label="線の角度"
          min={-MAX_LINE_ANGLE}
          max={MAX_LINE_ANGLE}
          step={1}
          value={angle}
          onChange={(e) => updateLineAngle(line.id, Number(e.target.value))}
          onDoubleClick={() => updateLineAngle(line.id, 0)}
        />
        <input
          type="number"
          className="lineAngleInput"
          aria-label="線の角度(度)"
          min={-MAX_LINE_ANGLE}
          max={MAX_LINE_ANGLE}
          value={angle}
          onChange={(e) => updateLineAngle(line.id, parseFloat(e.target.value) || 0)}
        />
        <span className="lineAngleUnit">°</span>
      </div>
    </div>
  );
}

const SPECIAL_PRESETS = [
  { id: "piano", label: "ピアノ", side: "left" as const },
  { id: "percussion", label: "打楽器", side: "right" as const },
];

export function LineSettings() {
  const { activePattern, toggleCenterLine, toggleSpecialMarker } = useApp();
  const markers = activePattern.specialMarkers ?? [];

  return (
    <Accordion icon={<LinesAccordionIcon />} title="線の設定">
      <div className="rowsEditor">
        <p className="rowsEditorNote">
          ツールバーの「線」モードでプレビューをタップすると縦線を追加できます。位置の微調整や削除はここで行えます。
        </p>
        <label className="conductorToggle">
          <input
            type="checkbox"
            checked={showsCenterLine(activePattern)}
            onChange={(e) => toggleCenterLine(e.target.checked)}
          />
          中心に線を表示
        </label>
        <div className="specialMarkersSection">
          <div className="rowsEditorNote" style={{ marginTop: 10 }}>前方に配置するポジション</div>
          {SPECIAL_PRESETS.map((preset) => (
            <label key={preset.id} className="conductorToggle" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={markers.some((m) => m.id === preset.id)}
                onChange={() => toggleSpecialMarker(preset.id, preset.label, preset.side)}
              />
              {preset.label}（指揮者の{preset.side === "left" ? "左" : "右"}）
            </label>
          ))}
        </div>
        <div className="linesList">
          {activePattern.lines.map((line) => (
            <LineItemRow key={line.id} line={line} />
          ))}
        </div>
      </div>
    </Accordion>
  );
}
