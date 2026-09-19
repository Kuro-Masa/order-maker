import { LinesAccordionIcon, TrashIcon } from "../../icons";
import { showsCenterLine } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Accordion } from "./Accordion";

const SPECIAL_PRESETS = [
  { id: "piano", label: "ピアノ", side: "left" as const },
  { id: "percussion", label: "打楽器", side: "right" as const },
];

export function LineSettings() {
  const { activePattern, toggleCenterLine, updateLinePos, removeLine, toggleSpecialMarker } = useApp();
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
            <div className="lineItem" key={line.id}>
              <span className="lineTypeLabel">縦線</span>
              <input
                type="number"
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
          ))}
        </div>
      </div>
    </Accordion>
  );
}
