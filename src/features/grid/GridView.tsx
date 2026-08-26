import { useRef, type MouseEvent } from "react";
import { showsCenterLine, showsConductor } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Row } from "./Row";
import { GuideLine } from "./GuideLine";
import { useGridLayout } from "./useGridLayout";

export function GridView() {
  const { activePattern, mode, addLine, updateLinePos } = useApp();
  const gridRef = useRef<HTMLDivElement>(null);
  const cellsWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const layout = useGridLayout(gridRef, cellsWrapRefs, activePattern);

  function handleGridClick(e: MouseEvent<HTMLDivElement>) {
    if (mode !== "line") return;
    const wraps = (cellsWrapRefs.current || []).filter(Boolean) as HTMLDivElement[];
    if (wraps.length === 0 || !gridRef.current) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    let minLeft = Infinity;
    let maxRight = -Infinity;
    wraps.forEach((w) => {
      const r = w.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left - gridRect.left);
      maxRight = Math.max(maxRight, r.right - gridRect.left);
    });
    const center = (minLeft + maxRight) / 2;
    const clickX = e.clientX - gridRect.left;

    addLine(clickX - center);
  }

  const lastRowIsOffset = (activePattern.rows.length - 1) % 2 === 1;

  return (
    <section className="gridWrap">
      <div className="gridRows" ref={gridRef} onClick={handleGridClick}>
        {activePattern.rows.map((row, r) => (
          <Row
            key={r}
            row={row}
            r={r}
            cellsWrapRef={(el) => {
              cellsWrapRefs.current[r] = el;
            }}
          />
        ))}

        {showsConductor(activePattern) && (
          <div
            className={"conductorMark" + (lastRowIsOffset ? " offset" : "")}
            title="指揮者(この位置が前)"
          >
            指揮
          </div>
        )}

        {layout.risers.map((rect, i) => (
          <div
            key={i}
            className="riserBg"
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          />
        ))}

        {layout.lines && showsCenterLine(activePattern) && (
          <GuideLine
            center={layout.lines.center}
            top={layout.lines.top}
            height={layout.lines.bottom - layout.lines.top}
            isCenterLine
          />
        )}

        {layout.lines &&
          activePattern.lines.map((line) => (
            <GuideLine
              key={line.id}
              center={layout.lines!.center}
              top={layout.lines!.top}
              height={layout.lines!.bottom - layout.lines!.top}
              pos={line.pos}
              draggable={mode === "line"}
              onDragEnd={(newPos) => updateLinePos(line.id, newPos)}
            />
          ))}
      </div>
    </section>
  );
}
