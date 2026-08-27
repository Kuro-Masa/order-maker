import { useState, useRef, useLayoutEffect, type MouseEvent } from "react";
import { rowShiftPx, showsCenterLine } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Row } from "./Row";
import { GuideLine } from "./GuideLine";
import { useGridLayout } from "./useGridLayout";

export function GridView() {
  const { activePattern, mode, addLine, updateLinePos, toolbarMode, setSelectedEditRow, addRow } = useApp();
  const [zoom, setZoom] = useState(1);
  const wrapRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cellsWrapRefs = useRef<(HTMLDivElement | null)[]>([]);
  const layout = useGridLayout(gridRef, cellsWrapRefs, activePattern, zoom);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
  }, [activePattern.id]);

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

  const lastRow = activePattern.rows[activePattern.rows.length - 1];
  const lastShift = lastRow ? rowShiftPx(lastRow) : 0;

  const zoomStep = 0.1;
  const minZoom = 0.3;
  const maxZoom = 1.5;

  return (
    <>
    <div className="gridZoomControls">
      <button
        type="button"
        className="gridZoomBtn"
        aria-label="縮小"
        disabled={zoom <= minZoom}
        onClick={() => setZoom((z) => parseFloat(Math.max(minZoom, z - zoomStep).toFixed(1)))}
      >−</button>
      <span className="gridZoomLabel">{Math.round(zoom * 100)}%</span>
      <button
        type="button"
        className="gridZoomBtn"
        aria-label="拡大"
        disabled={zoom >= maxZoom}
        onClick={() => setZoom((z) => parseFloat(Math.min(maxZoom, z + zoomStep).toFixed(1)))}
      >＋</button>
    </div>
    <section className="gridWrap" ref={wrapRef}>
      <div
        className="gridRows"
        ref={gridRef}
        style={zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: "top center" } : undefined}
        onClick={handleGridClick}
      >
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

        {toolbarMode === "rows" && (
          <button
            type="button"
            className="gridAddRowBtn"
            onClick={(e) => { e.stopPropagation(); addRow(); }}
          >
            ＋ 列を追加
          </button>
        )}

        <div className="conductorSeparator">
          <div
            className="conductorMark"
            style={lastShift !== 0 ? { transform: `translateX(${lastShift}px)` } : undefined}
            title="指揮者(この位置が前)"
          >
            指揮
          </div>
        </div>

        {layout.risers.map((rect, i) => (
          <div
            key={i}
            className={"riserBg" + (toolbarMode === "rows" ? " riserSelectable" : "")}
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            onClick={toolbarMode === "rows" ? () => setSelectedEditRow(rect.startRow) : undefined}
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
    </>
  );
}
