import { DEFAULT_COL_COUNT, DEFAULT_GAP_CELLS, PART_SCHEMES } from "../../constants";
import { createRow, ensurePartSettings, makeLineId, segmentsTotal, showsCenterLine, showsConductor } from "../../state/patternHelpers";
import type { NormalizedPatternData, Pattern, PatternJson } from "../../types";

export function buildPatternData(pattern: Pattern) {
  return {
    name: pattern.name,
    showConductor: showsConductor(pattern),
    showCenterLine: showsCenterLine(pattern),
    lines: pattern.lines || [],
    partSettings: ensurePartSettings(pattern),
    rows: pattern.rows.map((row) => ({
      segments: row.segments,
      gaps: row.gaps,
      onRiser: !!row.onRiser,
      shift: row.shift ?? 0,
      cells: row.cells,
    })),
  };
}

export function exportJsonData(pattern: Pattern) {
  const data: Record<string, unknown> = buildPatternData(pattern);
  data.type = "order-maker-pattern";
  data.version = 1;
  return data;
}

export function normalizePatternFromJson(data: PatternJson): NormalizedPatternData {
  const rows =
    Array.isArray(data.rows) && data.rows.length > 0
      ? data.rows.map((r) => {
          let segments = Array.isArray(r.segments)
            ? r.segments.map(Number).filter((n) => Number.isFinite(n) && n > 0)
            : [];
          if (segments.length === 0) segments = [1];

          const gaps = Array.isArray(r.gaps)
            ? r.gaps.slice(0, segments.length - 1).map((n) => {
                const num = Number(n);
                return Number.isFinite(num) && num >= 0 ? num : DEFAULT_GAP_CELLS;
              })
            : [];
          while (gaps.length < segments.length - 1) gaps.push(DEFAULT_GAP_CELLS);

          const total = segmentsTotal(segments);
          const cells = [];
          for (let i = 0; i < total; i++) {
            const c = (Array.isArray(r.cells) && r.cells[i]) || {};
            cells.push({
              name: typeof c.name === "string" ? c.name : "",
              color: typeof c.color === "string" ? c.color : null,
            });
          }

          const shift = typeof r.shift === "number" ? r.shift : (r.stagger ? 1 : 0);
          return { segments, gaps, cells, onRiser: !!r.onRiser, shift };
        })
      : [createRow([DEFAULT_COL_COUNT])];

  const scheme =
    data.partSettings && (PART_SCHEMES[data.partSettings.scheme ?? ""] || data.partSettings.scheme === "none")
      ? (data.partSettings.scheme as string)
      : "4";
  const counts =
    data.partSettings && data.partSettings.counts && typeof data.partSettings.counts === "object"
      ? data.partSettings.counts
      : {};

  const lines = Array.isArray(data.lines)
    ? data.lines
        .map((l) => {
          const pos = Number(l && l.pos);
          if (!Number.isFinite(pos)) return null;
          return { id: makeLineId(), pos };
        })
        .filter((l): l is { id: string; pos: number } => l !== null)
    : [];

  return {
    name: typeof data.name === "string" ? data.name : "",
    rows,
    partSettings: { scheme, counts },
    showConductor: data.showConductor !== false,
    showCenterLine: !!data.showCenterLine,
    lines,
  };
}

export function applyNormalizedDataToPattern(pattern: Pattern, normalized: NormalizedPatternData) {
  if (normalized.name) pattern.name = normalized.name;
  pattern.rows = normalized.rows;
  pattern.partSettings = normalized.partSettings;
  pattern.showConductor = normalized.showConductor;
  pattern.showCenterLine = normalized.showCenterLine;
  pattern.lines = normalized.lines;
}
