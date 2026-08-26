import { PART_SCHEMES } from "../../constants";
import { PartsAccordionIcon } from "../../icons";
import { computeTotals } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Accordion } from "./Accordion";

export function PartColorSettingsContent() {
  const { activePattern, setPartScheme, setPartCount, autoColorizeByParts } = useApp();
  const settings = activePattern.partSettings;
  const isNone = settings.scheme === "none";
  const parts = PART_SCHEMES[settings.scheme] || [];
  const { partsTotal, mismatch } = computeTotals(activePattern);

  return (
    <div className="partSettings">
      <div className="partSchemeRow">
        <label htmlFor="partSchemeSelect">声部数</label>
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
        <>
          <p className="partCountsLabel">各声部の人数</p>
          <div className="partCountsList">
            {parts.map((part) => (
              <div className="partCountItem" key={part.key}>
                <span className="partSwatch" style={{ background: part.color }} />
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
          <div className="partCountsFooter">
            <p className={"partTotalSummary" + (mismatch ? " mismatch" : "")}>合計 {partsTotal}人</p>
            <button type="button" className="btn primary" onClick={autoColorizeByParts}>
              自動で色分け
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function PartColorSettings() {
  return (
    <Accordion icon={<PartsAccordionIcon />} title="パートの色分け">
      <PartColorSettingsContent />
    </Accordion>
  );
}
