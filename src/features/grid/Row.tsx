import { Fragment } from "react";
import { getGapPx, rowIsOffset } from "../../state/patternHelpers";
import type { RowData } from "../../types";
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
  let cellIdx = 0;
  return (
    <div className={"row" + (rowIsOffset(row, r) ? " offset" : "")}>
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
    </div>
  );
}
