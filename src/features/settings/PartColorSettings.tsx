import { PART_SCHEMES } from "../../constants";
import { PartsAccordionIcon } from "../../icons";
import { useApp } from "../../state/AppStoreContext";
import { Accordion } from "./Accordion";

export function PartColorSettingsContent() {
  const { activePattern, setPartScheme, currentColor, setCurrentColor } = useApp();
  const settings = activePattern.partSettings;
  const effectiveScheme = ["4", "6", "8"].includes(settings.scheme) ? settings.scheme : "4";
  const parts = PART_SCHEMES[effectiveScheme] || [];

  return (
    <div className="partSettings">
      <div className="partSchemeRow">
        <label htmlFor="partSchemeSelect">声部数</label>
        <select
          id="partSchemeSelect"
          value={effectiveScheme}
          onChange={(e) => setPartScheme(e.target.value)}
        >
          <option value="4">4声</option>
          <option value="6">6声</option>
          <option value="8">8声</option>
        </select>
      </div>
      <div className="partCountsList">
        {parts.map((part) => (
          <div className="partCountItem" key={part.key}>
            <button
              type="button"
              className={"partSwatch" + (currentColor === part.color ? " selected" : "")}
              style={{ background: part.color }}
              onClick={() => setCurrentColor(currentColor === part.color ? null : part.color)}
              aria-label={part.key}
            />
            <span className="partCountDisplay">{settings.counts[part.key] || 0}</span>
          </div>
        ))}
      </div>
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
