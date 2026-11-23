import { useState, useRef, useLayoutEffect, type MouseEvent, type PointerEvent } from "react";
import { BackgroundLayer } from "../background/BackgroundLayer";
import { rowShiftPx, showsCenterLine, totalCellCount } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { Row } from "./Row";
import { GuideLine } from "./GuideLine";
import { useGridLayout } from "./useGridLayout";
import { arcBandPath, curveExtraDrop, curveRadii, radialFrame, radialPosAt, riserHalfAngles, rowOutlineHalfAngle, RISER_BAND_HALF } from "../../state/curve";
import { rowOnRiser } from "../../state/patternHelpers";

export function GridView() {
  const { activePattern, mode, addLine, updateLinePos, toolbarMode, selectedEditRow, setSelectedEditRow, addRow, updateBackground } = useApp();
  const [bgDrag, setBgDrag] = useState<{ startX: number; startY: number; dx: number; dy: number } | null>(null);
  const bgMode = mode === "background" && !!activePattern.background;
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

  const radii = curveRadii(activePattern);
  const extraDrop = curveExtraDrop(activePattern);
  const riserAngles = radii ? riserHalfAngles(activePattern, radii) : null;
  const curveReady = !!radii && layout.rowCenters.length === activePattern.rows.length;
  const radial =
    radii && curveReady
      ? radialFrame(radii, layout.axis, layout.rowCenters[activePattern.rows.length - 1])
      : undefined;
  const isRowsMode = toolbarMode === "rows";

  function handleGridClick(e: MouseEvent<HTMLDivElement>) {
    if (mode !== "line") return;
    const wraps = (cellsWrapRefs.current || []).filter(Boolean) as HTMLDivElement[];
    if (wraps.length === 0 || !gridRef.current) return;

    const gridRect = gridRef.current.getBoundingClientRect();
    if (radial) {
      const x = (e.clientX - gridRect.left) / zoom;
      const y = (e.clientY - gridRect.top) / zoom;
      addLine(Math.round(radialPosAt(radial, x, y)));
      return;
    }
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


  // In background mode, dragging anywhere on the grid moves the background (committed on release)
  function handleBgPointerDown(e: PointerEvent<HTMLElement>) {
    if (!bgMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setBgDrag({ startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 });
  }
  function handleBgPointerMove(e: PointerEvent<HTMLElement>) {
    if (!bgDrag) return;
    setBgDrag({ ...bgDrag, dx: (e.clientX - bgDrag.startX) / zoom, dy: (e.clientY - bgDrag.startY) / zoom });
  }
  function handleBgPointerUp() {
    if (!bgDrag) return;
    const bg = activePattern.background;
    if (bg && (bgDrag.dx || bgDrag.dy)) {
      updateBackground({ x: Math.round(bg.x + bgDrag.dx), y: Math.round(bg.y + bgDrag.dy) });
    }
    setBgDrag(null);
  }

  const lastRow = activePattern.rows[activePattern.rows.length - 1];
  const lastShift = lastRow ? rowShiftPx(lastRow) : 0;

  // Extra padding so left-shifted rows (transform: translateX) stay within
  // the scroll container and are reachable by scrolling.
  const maxShiftPx = activePattern.rows.reduce(
    (max, row) => Math.max(max, Math.abs(rowShiftPx(row))),
    0
  );

  // Grow the grid area so the whole background stays visible and scrollable
  const bg = activePattern.background;
  const bgLive = bg && bgDrag ? { ...bg, x: bg.x + bgDrag.dx, y: bg.y + bgDrag.dy } : bg;
  const bgPadTop = bgLive ? Math.max(0, Math.ceil(-bgLive.y) - 16) : 0;
  const bgSpan = bgLive ? Math.ceil(2 * Math.max(-bgLive.x, bgLive.x + bgLive.width)) + 24 : 0;
  const bgMinHeight =
    bgLive && layout.lines ? Math.ceil(layout.lines.top + bgLive.y + bgLive.width * bgLive.aspect) + 16 : 0;

  const zoomStep = 0.1;
  const minZoom = 0.3;
  const maxZoom = 1.5;

  const total = totalCellCount(activePattern);

  function formatUpdatedAt(ts: number | undefined): string {
    if (!ts) return "";
    const d = new Date(ts);
    const mo = d.getMonth() + 1;
    const da = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${mo}/${da} ${hh}:${mm}`;
  }

  return (
    <>
    <div className="gridAboveBar">
      <span className="gridTotalCount">合計 {total} マス</span>
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
      {activePattern.updatedAt && (
        <span className="gridUpdatedAt">{formatUpdatedAt(activePattern.updatedAt)}</span>
      )}
    </div>
    <section
      className={"gridWrap" + (bgMode ? " gridWrapBgMode" : "")}
      ref={wrapRef}
      onPointerDown={handleBgPointerDown}
      onPointerMove={handleBgPointerMove}
      onPointerUp={handleBgPointerUp}
      onPointerCancel={handleBgPointerUp}
    >
      <div
        className="gridRows"
        ref={gridRef}
        style={{
          ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: "top center" } : {}),
          ...(maxShiftPx > 0 ? { paddingLeft: `${10 + maxShiftPx}px`, paddingRight: `${22 + maxShiftPx}px` } : {}),
          ...(bgPadTop > 0 ? { paddingTop: 16 + bgPadTop } : {}),
          ...(bgMinHeight > 0 ? { minHeight: bgMinHeight } : {}),
        }}
        onClick={handleGridClick}
      >
        {bgSpan > 0 && <div aria-hidden style={{ width: bgSpan, height: 0, flex: "0 0 auto", order: 99 }} />}
        {bgLive && layout.lines && (
          <BackgroundLayer bg={bgLive} axis={layout.axis} top={layout.lines.top} active={bgMode} />
        )}
        {activePattern.rows.map((row, r) => (
          <Row
            key={r}
            row={row}
            r={r}
            cellsWrapRef={(el) => {
              cellsWrapRefs.current[r] = el;
            }}
            radius={radii?.[r]}
          />
        ))}

        {extraDrop > 0 && <div aria-hidden style={{ height: extraDrop, flex: "0 0 auto" }} />}

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
          {(activePattern.specialMarkers ?? [])
            .filter((m) => m.side === "left")
            .map((m) => (
              <div key={m.id} className="specialMark" title={m.label}>
                {m.label}
              </div>
            ))}
          <div
            className="conductorMark"
            style={lastShift !== 0 ? { transform: `translateX(${lastShift}px)` } : undefined}
            title="指揮者(この位置が前)"
          >
            指揮
          </div>
          {(activePattern.specialMarkers ?? [])
            .filter((m) => m.side === "right")
            .map((m) => (
              <div key={m.id} className="specialMark" title={m.label}>
                {m.label}
              </div>
            ))}
        </div>

        {radii && riserAngles && curveReady && (
          <svg
            className={"riserArcs" + (toolbarMode === "rows" ? " riserSelectable" : "")}
            width={1}
            height={1}
            aria-hidden
          >
            {activePattern.rows.map((row, r) => {
              if (!rowOnRiser(row)) return null;
              const R = radii[r];
              const cy = layout.rowCenters[r] + R;
              // stroke (width 6) rounds the corners; shrink the band so the outline matches
              const inner = Math.max(1, R - RISER_BAND_HALF + 3);
              const outer = R + RISER_BAND_HALF - 3;
              const half = Math.max(0.001, riserAngles[r] - 3 / R);
              return (
                <path
                  key={r}
                  className="riserArc"
                  d={arcBandPath(layout.axis, cy, inner, outer, half)}
                  onClick={toolbarMode === "rows" ? () => setSelectedEditRow(r) : undefined}
                />
              );
            })}
            {isRowsMode && selectedEditRow !== null && selectedEditRow < activePattern.rows.length && (() => {
              const r = selectedEditRow;
              const R = radii[r];
              // matches the straight outline: 6px ring around the 44px-tall row
              const band = 22 + 3;
              return (
                <path
                  className="rowSelectArc"
                  d={arcBandPath(
                    layout.axis,
                    layout.rowCenters[r] + R,
                    Math.max(1, R - band),
                    R + band,
                    rowOutlineHalfAngle(activePattern.rows[r], R, true),
                  )}
                />
              );
            })()}
          </svg>
        )}

        {!radii && layout.risers.map((rect, i) => (
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
            radial={radial}
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
              angle={line.angle}
              radial={radial}
              draggable={mode === "line"}
              onDragEnd={(newPos) => updateLinePos(line.id, newPos)}
            />
          ))}
      </div>
    </section>
    </>
  );
}
