import { Fragment } from "react";
import { getGapPx, rowShiftPx } from "../../state/patternHelpers";
import type { RowData } from "../../types";
import { useApp } from "../../state/AppStoreContext";
import { Cell } from "./Cell";

export function Row({
  row,
  r,
  cellsWrapRef,
}: {
  row: RowData;
  r: number;
  cellsWrapRef: (el: HTMLDivElement | null) => void;
}) {
  const { toolbarMode, addCellToRow } = useApp();
  const showAddBtns = toolbarMode === "rows";
  let cellIdx = 0;
  return (
    <div className="row" style={rowShiftPx(row) !== 0 ? { transform: `translateX(${rowShiftPx(row)}px)` } : undefined}>
      {showAddBtns && (
        <button type="button" className="rowAddCellBtn" onClick={() => addCellToRow(r, "left")} aria-label="左にセルを追加">+</button>
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
              return <Cell key={idx} row={row} r={r} c={idx} />;
            })}
          </Fragment>
        ))}
      </div>
      {showAddBtns && (
        <button type="button" className="rowAddCellBtn" onClick={() => addCellToRow(r, "right")} aria-label="右にセルを追加">+</button>
      )}
    </div>
  );
}
