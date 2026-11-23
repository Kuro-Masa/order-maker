import { CELL_H, CELL_W, GAP_X, GAP_Y, RISER_PAD } from "../constants";
import type { Pattern, RowData } from "../types";
import { getGapPx, rowContentWidthPx, rowOnRiser, rowShiftPx } from "./patternHelpers";

// Rows bend around a common center in front of the conductor (concentric arcs).
// curve = 0..100 (%); at 100 the widest row spans exactly a semicircle.

export function curvePercent(pattern: Pattern): number {
  const c = Number(pattern.curve ?? 0);
  return Number.isFinite(c) ? Math.min(100, Math.max(0, c)) : 0;
}

// Horizontal center of every cell, relative to the grid's center axis (shift included)
export function cellCenterOffsets(row: RowData): number[] {
  const out: number[] = [];
  let x = -rowContentWidthPx(row) / 2 + rowShiftPx(row);
  row.segments.forEach((segLen, segIdx) => {
    if (segIdx > 0) x += getGapPx(row, segIdx - 1);
    for (let i = 0; i < segLen; i++) {
      out.push(x + CELL_W / 2);
      x += CELL_W + GAP_X;
    }
  });
  return out;
}

function rowHalfExtent(row: RowData): number {
  return rowContentWidthPx(row) / 2 + Math.abs(rowShiftPx(row));
}

// Radius (to each row's center line) per row, or null when rows are straight
export function curveRadii(pattern: Pattern): number[] | null {
  const t = curvePercent(pattern) / 100;
  const n = pattern.rows.length;
  if (t <= 0 || n === 0) return null;
  const pitch = CELL_H + GAP_Y;
  const maxSpan = t * Math.PI;
  let front = CELL_H;
  pattern.rows.forEach((row, r) => {
    const depth = (n - 1 - r) * pitch;
    front = Math.max(front, (rowHalfExtent(row) * 2) / maxSpan - depth);
  });
  return pattern.rows.map((_, r) => front + (n - 1 - r) * pitch);
}

export interface CurvePoint {
  dx: number; // displacement from the straight position
  dy: number;
  angle: number; // radians, clockwise
}

export function curvePoint(s: number, radius: number): CurvePoint {
  const angle = s / radius;
  return { dx: radius * Math.sin(angle) - s, dy: radius * (1 - Math.cos(angle)), angle };
}

// Angular half-extent of each row's riser (shared by all auto-width risers so they line up)
export function riserHalfAngles(pattern: Pattern, radii: number[]): number[] {
  let common = 0;
  pattern.rows.forEach((row, r) => {
    common = Math.max(common, (rowHalfExtent(row) + RISER_PAD) / radii[r]);
  });
  return pattern.rows.map((row, r) => {
    const a =
      row.riserWidth !== undefined
        ? ((row.riserWidth * (CELL_W + GAP_X) - GAP_X) / 2 + RISER_PAD) / radii[r]
        : common;
    return Math.min(Math.PI, a);
  });
}

// SVG path of an annular sector; (cx, cy) is the circle center, angles measured from "up"
export function arcBandPath(cx: number, cy: number, inner: number, outer: number, half: number): string {
  const pt = (rad: number, a: number) =>
    `${(cx + rad * Math.sin(a)).toFixed(2)} ${(cy - rad * Math.cos(a)).toFixed(2)}`;
  const large = half * 2 > Math.PI ? 1 : 0;
  return (
    `M ${pt(outer, -half)} A ${outer} ${outer} 0 ${large} 1 ${pt(outer, half)} ` +
    `L ${pt(inner, half)} A ${inner} ${inner} 0 ${large} 0 ${pt(inner, -half)} Z`
  );
}

export const RISER_BAND_HALF = CELL_H / 2 + RISER_PAD;

// How far the curved rows reach below the front row's bottom edge
export function curveExtraDrop(pattern: Pattern): number {
  const radii = curveRadii(pattern);
  if (!radii) return 0;
  const n = pattern.rows.length;
  const pitch = CELL_H + GAP_Y;
  let drop = 0;
  pattern.rows.forEach((row, r) => {
    const depth = (n - 1 - r) * pitch;
    const R = radii[r];
    cellCenterOffsets(row).forEach((s) => {
      const { dy, angle } = curvePoint(s, R);
      const low = (CELL_W / 2) * Math.abs(Math.sin(angle)) + (CELL_H / 2) * Math.abs(Math.cos(angle));
      drop = Math.max(drop, dy - depth + low - CELL_H / 2);
    });
    if (rowOnRiser(row)) {
      const half = riserHalfAngles(pattern, radii)[r];
      const c = Math.cos(half);
      const edge = c >= 0 ? R - RISER_BAND_HALF : R + RISER_BAND_HALF;
      drop = Math.max(drop, R - edge * c - depth - CELL_H / 2);
    }
  });
  return Math.ceil(drop);
}

// ---- guide lines on curved rows ----
// A line's `pos` is its arc distance from the center axis, measured at the middle
// radius, so it runs radially from the front row's inner edge to the back row's outer edge.

export interface RadialFrame {
  cx: number; // circle center
  cy: number;
  rIn: number;
  rOut: number;
  rRef: number;
}

export function radialFrame(radii: number[], cx: number, frontRowCenterY: number): RadialFrame {
  const front = radii[radii.length - 1];
  const back = radii[0];
  const rIn = Math.max(1, front - CELL_H / 2);
  const rOut = back + CELL_H / 2;
  return { cx, cy: frontRowCenterY + front, rIn, rOut, rRef: (rIn + rOut) / 2 };
}

export interface RadialLine {
  x: number; // inner (front) end, the pivot
  y: number;
  length: number;
  angle: number; // radians, clockwise from "up"
}

export function radialLine(frame: RadialFrame, pos: number, extraDeg = 0): RadialLine {
  const phi = pos / frame.rRef;
  return {
    x: frame.cx + frame.rIn * Math.sin(phi),
    y: frame.cy - frame.rIn * Math.cos(phi),
    length: frame.rOut - frame.rIn,
    angle: phi + (extraDeg * Math.PI) / 180,
  };
}

// Inverse: the `pos` of a radial line through point (x, y)
export function radialPosAt(frame: RadialFrame, x: number, y: number): number {
  return Math.atan2(x - frame.cx, frame.cy - y) * frame.rRef;
}

// Angular half-extent of a row including its "+" buttons, for the selection outline
export function rowOutlineHalfAngle(row: RowData, radius: number, withAddBtns: boolean): number {
  const pad = withAddBtns ? 22 + 4 + 6 : 6;
  return Math.min(Math.PI, (rowHalfExtent(row) + pad) / radius);
}
