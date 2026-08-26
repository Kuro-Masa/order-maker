import { PART_SCHEMES } from "../../constants";
import { PartsAccordionIcon } from "../../icons";
import { computeTotals } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Accordion } from "./Accordion";

export function PartColorSettings() {
  const { activePattern, setPartScheme, setPartCount, autoColorizeByParts } = useApp();
  const settings = activePattern.partSettings;
  const isNone = settings.scheme === "none";
  const parts = PART_SCHEMES[settings.scheme] || [];
  const { partsTotal, mismatch } = computeTotals(activePattern);

  return (
    <Accordion icon={<PartsAccordionIcon />} title="パートの色分け">
      <div className="partSettings">
        <div className="partSchemeRow">
          <label htmlFor="partSchemeSelect">配色パターン</label>
          <select
            id="partSchemeSelect"
            value={settings.scheme}
            onChange={(e) => setPartScheme(e.target.value)}
          >
            <option value="none">パート分けを使わない</option>
            <option value="4">4色(Sop/Alt/Ten/Bas)</option>
            <option value="6">6色(Sop/Mez/Alt/Ten/Bar/Bas)</option>
            <option value="8">8色(Sop1/Sop2/Alt1/Alt2/Ten1/Ten2/Bas1/Bas2)</option>
          </select>
        </div>
        {isNone && (
          <p className="rowsEditorNote">パート分けを使わない場合、色塗りモードで自由に色を選べます。</p>
        )}
        {!isNone && (
          <div className="partCountsList">
            {parts.map((part) => (
              <div className="partCountItem" key={part.key}>
                <span className="partSwatch" style={{ background: part.color }} />
                <span className="partLabel">{part.key}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={settings.counts[part.key] || 0}
                  onChange={(e) => setPartCount(part.key, parseInt(e.target.value, 10) || 0)}
                />
              </div>
            ))}
          </div>
        )}
        {!isNone && (
          <p className={"partTotalSummary" + (mismatch ? " mismatch" : "")}>人数合計: {partsTotal}人</p>
        )}
        {!isNone && (
          <button type="button" className="btn primary" onClick={autoColorizeByParts}>
            人数に応じて自動で色分け
          </button>
        )}
      </div>
    </Accordion>
  );
}
