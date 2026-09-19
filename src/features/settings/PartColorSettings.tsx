import { useRef, useState } from "react";
import { PART_SCHEMES } from "../../constants";
import { PartsAccordionIcon } from "../../icons";
import { useApp } from "../../state/AppStoreContext";
import type { Pattern } from "../../types";
import { Accordion } from "./Accordion";

function countByColor(pattern: Pattern, color: string): number {
  return pattern.rows.reduce(
    (sum, row) => sum + row.cells.filter((c) => c.color === color).length,
    0
  );
}

const STORAGE_KEY = "narabiCustomColors";
const MAX_CUSTOM = 8;

function loadCustomColors(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomColors(colors: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(colors)); } catch {}
}

export function PartColorSettingsContent() {
  const { activePattern, setPartScheme, currentColor, setCurrentColor, clearColorFromCells } = useApp();
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);
  const inputRef = useRef<HTMLInputElement>(null);
  const settings = activePattern.partSettings;
  const effectiveScheme = ["4", "6", "8"].includes(settings.scheme) ? settings.scheme : "4";
  const parts = PART_SCHEMES[effectiveScheme] || [];

  const presetColorSet = new Set(parts.map((p) => p.color));
  const extraColors = customColors.filter((c) => !presetColorSet.has(c));

  function handleColorPick(color: string) {
    setCurrentColor(color);
    setCustomColors((prev) => {
      const next = [color, ...prev.filter((c) => c !== color)].slice(0, MAX_CUSTOM);
      saveCustomColors(next);
      return next;
    });
  }

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
        {extraColors.map((color) => (
          <div className="partCountItem" key={color}>
            <div className="partSwatchWrap">
              <button
                type="button"
                className={"partSwatch" + (currentColor === color ? " selected" : "")}
                style={{ background: color }}
                onClick={() => setCurrentColor(currentColor === color ? null : color)}
                aria-label={color}
              />
              <button
                type="button"
                className="partSwatchRemove"
                aria-label="この色を削除"
                onClick={() => {
                  setCustomColors((prev) => {
                    const next = prev.filter((c) => c !== color);
                    saveCustomColors(next);
                    return next;
                  });
                  clearColorFromCells(color);
                  if (currentColor === color) setCurrentColor(null);
                }}
              >✕</button>
            </div>
            <span className="partCountDisplay">{countByColor(activePattern, color)}</span>
          </div>
        ))}
        <div className="partCountItem">
          <button
            type="button"
            className="partSwatch partSwatchAdd"
            title="色を追加"
            onClick={() => inputRef.current?.click()}
          >
            +
          </button>
          <input
            ref={inputRef}
            type="color"
            className="colorPickerInput"
            defaultValue={currentColor ?? "#aaccff"}
            onChange={(e) => handleColorPick(e.target.value)}
            aria-label="カスタムカラーを選択"
          />
        </div>
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
