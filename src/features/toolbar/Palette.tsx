import { getActivePalette } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";

export function Palette() {
  const { activePattern, mode, currentColor, setCurrentColor } = useApp();

  if (mode !== "paint") return null;

  const activePalette = getActivePalette(activePattern);

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
      <button
        type="button"
        className={"swatch clear" + (currentColor === null ? " active" : "")}
        title="色をクリア"
        onClick={() => setCurrentColor(null)}
      />
    </div>
  );
}
