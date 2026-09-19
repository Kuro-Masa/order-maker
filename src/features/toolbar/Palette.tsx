import { useRef, useState } from "react";
import { getActivePalette } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";

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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {}
}

export function Palette() {
  const { activePattern, mode, currentColor, setCurrentColor } = useApp();
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);
  const inputRef = useRef<HTMLInputElement>(null);

  if (mode !== "paint") return null;

  const activePalette = getActivePalette(activePattern);

  function handleColorPick(color: string) {
    setCurrentColor(color);
    setCustomColors((prev) => {
      // Move to front if already exists, otherwise prepend
      const next = [color, ...prev.filter((c) => c !== color)].slice(0, MAX_CUSTOM);
      saveCustomColors(next);
      return next;
    });
  }

  // Colors from palette that are NOT already in activePalette
  const extraColors = customColors.filter(
    (c) => !activePalette.some((p) => p.color === c)
  );

  return (
    <div className="palette">
      {activePalette.map((part, i) => (
        <div className="swatchWrap" key={part.key ?? i}>
          <button
            type="button"
            className={"swatch" + (currentColor === part.color ? " active" : "")}
            style={{ background: part.color }}
            title={part.key ?? undefined}
            onClick={() => setCurrentColor(part.color)}
          />
        </div>
      ))}
      {extraColors.map((color) => (
        <button
          key={color}
          type="button"
          className={"swatch" + (currentColor === color ? " active" : "")}
          style={{ background: color }}
          title={color}
          onClick={() => setCurrentColor(color)}
        />
      ))}
      {/* Custom color picker */}
      <button
        type="button"
        className="swatch swatchAdd"
        title="色を追加"
        onClick={() => inputRef.current?.click()}
      >
        <span aria-hidden="true">+</span>
      </button>
      <input
        ref={inputRef}
        type="color"
        className="colorPickerInput"
        defaultValue={currentColor ?? "#aaccff"}
        onChange={(e) => handleColorPick(e.target.value)}
        aria-label="カスタムカラーを選択"
      />
      <button
        type="button"
        className={"swatch clear" + (currentColor === null ? " active" : "")}
        title="色をクリア"
        onClick={() => setCurrentColor(null)}
      />
    </div>
  );
}
