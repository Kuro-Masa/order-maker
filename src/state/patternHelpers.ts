import {
  CELL_W,
  DEFAULT_GAP_CELLS,
  GAP_X,
  PALETTE,
  PART_SCHEMES,
} from "../constants";
import type { CellData, Pattern, RowData } from "../types";

export function makeId(): string {
  return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function makeLineId(): string {
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function segmentsTotal(segments: number[]): number {
  return segments.reduce((a, b) => a + b, 0);
}

export function rowShiftPx(row: RowData): number {
  return (row.shift ?? 0) * 22;
}

export function createRow(segments: number[], gaps?: number[]): RowData {
  const total = segmentsTotal(segments);
  const cells: CellData[] = [];
  for (let i = 0; i < total; i++) {
    cells.push({ name: "", color: null });
  }
  const normalizedGaps = gaps
    ? gaps.slice()
    : segments.slice(1).map(() => DEFAULT_GAP_CELLS);
  return { segments: segments.slice(), gaps: normalizedGaps, cells, onRiser: false, shift: 0 };
}

export function createPattern(name: string, rowCount: number, colCount: number): Pattern {
  const rows: RowData[] = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(createRow([colCount]));
  }
  return {
    id: makeId(),
    name,
    rows,
    partSettings: { scheme: "4", counts: {} },
    showConductor: true,
    showCenterLine: false,
    lines: [],
    shareId: null,
  };
}

export function createDefaultPattern(name: string): Pattern {
  return {
    id: makeId(),
    name,
    rows: [
      createRow([12]),
      createRow([11]),
      createRow([3, 3], [4]),
    ],
    partSettings: { scheme: "4", counts: {} },
    showConductor: true,
    showCenterLine: false,
    lines: [],
    shareId: null,
  };
}

export function rowOnRiser(row: RowData): boolean {
  return !!row.onRiser;
}

export function getGapCells(row: RowData, i: number): number {
  return row.gaps && row.gaps[i] !== undefined ? row.gaps[i] : DEFAULT_GAP_CELLS;
}

export function gapCellsToPx(n: number): number {
  return n * CELL_W + Math.max(0, n - 1) * GAP_X;
}

export function getGapPx(row: RowData, i: number): number {
  return gapCellsToPx(getGapCells(row, i));
}

export function rowContentWidthPx(row: RowData): number {
  let w = 0;
  row.segments.forEach((segLen, i) => {
    if (i > 0) w += getGapPx(row, i - 1);
    w += segLen * CELL_W + (segLen - 1) * GAP_X;
  });
  return w;
}

export function maxRowWidthPx(pattern: Pattern): number {
  return pattern.rows.reduce((max, row) => Math.max(max, rowContentWidthPx(row)), 0);
}

export function showsConductor(pattern: Pattern): boolean {
  return pattern.showConductor !== false;
}

export function showsCenterLine(pattern: Pattern): boolean {
  return !!pattern.showCenterLine;
}

export function ensurePartSettings(pattern: Pattern) {
  if (!pattern.partSettings) {
    pattern.partSettings = { scheme: "4", counts: {} };
  }
  return pattern.partSettings;
}

export interface RowSpec {
  segments: number[];
  gaps: number[];
}

export function parseRowSpec(text: string): RowSpec {
  const tokens = String(text || "")
    .split(/[,+\s]+/)
    .filter((s) => s.length > 0);
  const segments: number[] = [];
  const gaps: number[] = [];
  let currentSum = 0;
  let hasCurrent = false;

  function flushSegment() {
    if (hasCurrent) {
      segments.push(currentSum);
      currentSum = 0;
      hasCurrent = false;
    }
  }

  tokens.forEach((tok) => {
    const gapMatch = /^E(\d*\.?\d+)$/i.exec(tok);
    if (gapMatch) {
      flushSegment();
      gaps.push(Math.max(0, parseFloat(gapMatch[1])));
      return;
    }
    const n = parseInt(tok, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    currentSum += n;
    hasCurrent = true;
  });
  flushSegment();

  let finalSegments = segments;
  if (finalSegments.length === 0) finalSegments = [1];
  const finalGaps = gaps.slice(0, finalSegments.length - 1);
  while (finalGaps.length < finalSegments.length - 1) finalGaps.push(DEFAULT_GAP_CELLS);

  return { segments: finalSegments, gaps: finalGaps };
}

export function formatGapCells(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

export function serializeRowSpec(row: RowData): string {
  const parts: string[] = [];
  row.segments.forEach((segLen, i) => {
    if (i > 0) parts.push("E" + formatGapCells(getGapCells(row, i - 1)));
    parts.push(String(segLen));
  });
  return parts.join(",");
}

export function regenerateRowCells(row: RowData, newSegments: number[], newGaps: number[]): RowData {
  const total = segmentsTotal(newSegments);
  const newCells: CellData[] = [];
  for (let i = 0; i < total; i++) {
    newCells.push(row.cells[i] || { name: "", color: null });
  }
  return { ...row, segments: newSegments, gaps: newGaps, cells: newCells };
}

export function totalCellCount(pattern: Pattern): number {
  return pattern.rows.reduce((sum, row) => sum + segmentsTotal(row.segments), 0);
}

export function getCellsColumnMajor(pattern: Pattern): CellData[] {
  const maxLen = pattern.rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
  const flatCells: CellData[] = [];
  for (let c = 0; c < maxLen; c++) {
    pattern.rows.forEach((row) => {
      if (row.cells[c]) flatCells.push(row.cells[c]);
    });
  }
  return flatCells;
}

export function computeTotals(pattern: Pattern) {
  const cellsTotal = totalCellCount(pattern);
  const settings = pattern.partSettings;
  if (settings.scheme === "none") {
    return { cellsTotal, partsTotal: 0, mismatch: false, isNone: true };
  }
  const parts = PART_SCHEMES[settings.scheme] || [];
  const partsTotal = parts.reduce((sum, part) => sum + (settings.counts[part.key] || 0), 0);
  return { cellsTotal, partsTotal, mismatch: partsTotal !== cellsTotal, isNone: false };
}

export function getActivePalette(pattern: Pattern) {
  const settings = ensurePartSettings(pattern);
  if (settings.scheme === "none" || !PART_SCHEMES[settings.scheme]) {
    return PALETTE.map((color) => ({ key: null as string | null, color }));
  }
  return PART_SCHEMES[settings.scheme].map((p) => ({ key: p.key as string | null, color: p.color }));
}
