import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CELL_W, GAP_X, RISER_PAD } from "../../constants";
import { rowOnRiser } from "../../state/patternHelpers";
import type { Pattern } from "../../types";

export interface RiserRect {
  left: number;
  top: number;
  width: number;
  height: number;
  startRow: number;
}

export interface LinesLayout {
  center: number;
  top: number;
  bottom: number;
}

export interface GridLayout {
  risers: RiserRect[];
  lines: LinesLayout | null;
}

const EMPTY_LAYOUT: GridLayout = { risers: [], lines: null };

export function useGridLayout(
  gridRef: RefObject<HTMLDivElement | null>,
  cellsWrapRefs: RefObject<(HTMLDivElement | null)[]>,
  pattern: Pattern,
  zoom = 1
): GridLayout {
  const [layout, setLayout] = useState<GridLayout>(EMPTY_LAYOUT);
  const lastSignatureRef = useRef<string | null>(null);

  function commitLayout(next: GridLayout) {
    const signature = JSON.stringify(next);
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;
    setLayout(next);
  }

  useLayoutEffect(() => {
    const gridEl = gridRef.current;
    const wrapsArr = cellsWrapRefs.current || [];
    if (!gridEl || wrapsArr.length === 0 || wrapsArr.some((w) => !w)) {
      commitLayout(EMPTY_LAYOUT);
      return;
    }
    const wraps = wrapsArr as HTMLDivElement[];
    const gridRect = gridEl.getBoundingClientRect();

    // getBoundingClientRect returns visual (post-transform) coordinates.
    // Divide by zoom to convert back to the layout coordinate system used
    // by the gridRows element when positioning absolute children.
    const s = zoom;

    // Every riser shares one common span wide enough to contain every row
    // (including staggered ones), so all platforms line up and match width.
    let minLeft = Infinity;
    let maxRight = -Infinity;
    wraps.forEach((w) => {
      const r = w.getBoundingClientRect();
      minLeft = Math.min(minLeft, (r.left - gridRect.left) / s);
      maxRight = Math.max(maxRight, (r.right - gridRect.left) / s);
    });
    const left = minLeft - RISER_PAD;
    const width = maxRight - minLeft + RISER_PAD * 2;

    const risers: RiserRect[] = [];
    let i = 0;
    while (i < pattern.rows.length) {
      if (!rowOnRiser(pattern.rows[i])) {
        i++;
        continue;
      }
      const start = i;
      while (i < pattern.rows.length && rowOnRiser(pattern.rows[i])) i++;
      const end = i - 1;
      const startRect = wraps[start].getBoundingClientRect();
      const endRect = wraps[end].getBoundingClientRect();
      const top = (startRect.top - gridRect.top) / s - RISER_PAD;
      const bottom = (endRect.bottom - gridRect.top) / s + RISER_PAD;
      const customCells = pattern.rows.slice(start, end + 1).find((r) => r.riserWidth != null)?.riserWidth;
      let rLeft = left;
      let rWidth = width;
      if (customCells !== undefined) {
        rWidth = customCells * (CELL_W + GAP_X) - GAP_X + RISER_PAD * 2;
        const center = (minLeft + maxRight) / 2;
        rLeft = center - rWidth / 2;
      }
      risers.push({ left: rLeft, top, width: rWidth, height: bottom - top, startRow: start });
    }

    // Align to the same center the conductor mark uses (row 0's unshifted
    // center, shifted to match the last row's parity), not the riser
    // background's full-extent span, so the two visually coincide.
    const lastWrap = wraps[wraps.length - 1];
    const lastWrapRect = lastWrap.getBoundingClientRect();
    const center = (lastWrapRect.left + lastWrapRect.right) / 2 / s - gridRect.left / s;

    const firstRect = wraps[0].getBoundingClientRect();
    const top = (firstRect.top - gridRect.top) / s;
    const bottom = (lastWrapRect.bottom - gridRect.top) / s;

    commitLayout({ risers, lines: { center, top, bottom } });
  });

  return layout;
}
