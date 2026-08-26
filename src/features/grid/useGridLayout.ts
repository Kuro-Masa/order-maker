import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CELL_W, RISER_PAD } from "../../constants";
import { rowOnRiser } from "../../state/patternHelpers";
import type { Pattern } from "../../types";

export interface RiserRect {
  left: number;
  top: number;
  width: number;
  height: number;
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
  pattern: Pattern
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

    // Every riser shares one common span wide enough to contain every row
    // (including staggered ones), so all platforms line up and match width.
    let minLeft = Infinity;
    let maxRight = -Infinity;
    wraps.forEach((w) => {
      const r = w.getBoundingClientRect();
      minLeft = Math.min(minLeft, r.left - gridRect.left);
      maxRight = Math.max(maxRight, r.right - gridRect.left);
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
      const top = startRect.top - gridRect.top - RISER_PAD;
      const bottom = endRect.bottom - gridRect.top + RISER_PAD;
      risers.push({ left, top, width, height: bottom - top });
    }

    // Align to the same center the conductor mark uses (row 0's unshifted
    // center, shifted to match the last row's parity), not the riser
    // background's full-extent span, so the two visually coincide.
    const row0Rect = wraps[0].getBoundingClientRect();
    const row0Center = (row0Rect.left + row0Rect.right) / 2 - gridRect.left;
    const lastRowIsOffset = (pattern.rows.length - 1) % 2 === 1;
    const center = row0Center + (lastRowIsOffset ? CELL_W / 2 : 0);

    const firstRect = wraps[0].getBoundingClientRect();
    const lastRect = wraps[wraps.length - 1].getBoundingClientRect();
    const top = firstRect.top - gridRect.top;
    const bottom = lastRect.bottom - gridRect.top;

    commitLayout({ risers, lines: { center, top, bottom } });
  });

  return layout;
}
