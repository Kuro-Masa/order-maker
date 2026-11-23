import { Fragment } from "react";
import { CELL_W } from "../../constants";
import { getGapPx, rowShiftPx } from "../../state/patternHelpers";
import type { RowData } from "../../types";
import { useApp } from "../../state/AppStoreContext";
import { Cell } from "./Cell";
import { cellCenterOffsets, curvePoint } from "../../state/curve";

export function Row({
  row,
  r,
  cellsWrapRef,
  radius,
}: {
  row: RowData;
  r: number;
  cellsWrapRef: (el: HTMLDivElement | null) => void;
  radius?: number;
}) {
  const offsets = radius ? cellCenterOffsets(row) : null;
  function arcTransform(s: number): string | undefined {
    if (!radius) return undefined;
    const { dx, dy, angle } = curvePoint(s, radius);
    return `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${angle.toFixed(4)}rad)`;
  }
  function curveTransform(idx: number): string | undefined {
    return offsets ? arcTransform(offsets[idx]) : undefined;
  }
  // "+" buttons sit just outside the row ends (22px wide + 4px margin), so follow the arc from there
  const ADD_BTN_OFFSET = CELL_W / 2 + 4 + 11;
  const addBtnStyle = (side: "left" | "right") => {
    if (!offsets || offsets.length === 0) return undefined;
    const s = side === "left" ? offsets[0] - ADD_BTN_OFFSET : offsets[offsets.length - 1] + ADD_BTN_OFFSET;
    return { transform: arcTransform(s) };
  };
  const { toolbarMode, addCellToRow, selectedEditRow, setSelectedEditRow } = useApp();
  const showAddBtns = toolbarMode === "rows";
  const isRowsMode = toolbarMode === "rows";
  const isSelected = isRowsMode && selectedEditRow === r;
  let cellIdx = 0;
  return (
    <div
      className={"row" + (radius ? " rowCurved" : "") + (isRowsMode ? " rowSelectable" : "") + (isSelected ? " rowSelectedForEdit" : "")}
      style={rowShiftPx(row) !== 0 ? { transform: `translateX(${rowShiftPx(row)}px)` } : undefined}
      onClick={isRowsMode ? () => setSelectedEditRow(r) : undefined}
    >
      {showAddBtns && (
        <button type="button" className="rowAddCellBtn" style={addBtnStyle("left")} onClick={() => addCellToRow(r, "left")} aria-label="左にセルを追加">+</button>
      )}
      <div className="cellsWrap" ref={cellsWrapRef}>
        {row.segments.map((segLen, segIdx) => (
          <Fragment key={segIdx}>
            {segIdx > 0 &&
              (() => {
                const gapPx = getGapPx(row, segIdx - 1);
                return <div className="segmentGap" style={{ width: gapPx, flex: `0 0 ${gapPx}px` }} />;
              })()}
            {Array.from({ length: segLen }).map(() => {
              const idx = cellIdx++;
              return <Cell key={idx} row={row} r={r} c={idx} curveTransform={curveTransform(idx)} />;
            })}
          </Fragment>
        ))}
      </div>
      {showAddBtns && (
        <button type="button" className="rowAddCellBtn" style={addBtnStyle("right")} onClick={() => addCellToRow(r, "right")} aria-label="右にセルを追加">+</button>
      )}
    </div>
  );
}
