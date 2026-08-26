import { LinesAccordionIcon, TrashIcon } from "../../icons";
import { showsCenterLine } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Accordion } from "./Accordion";

export function LineSettings() {
  const { activePattern, toggleCenterLine, updateLinePos, removeLine } = useApp();

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
