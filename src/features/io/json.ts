import { DEFAULT_COL_COUNT, DEFAULT_GAP_CELLS, PART_SCHEMES } from "../../constants";
import { createRow, ensurePartSettings, makeLineId, segmentsTotal, showsCenterLine, showsConductor } from "../../state/patternHelpers";
import type { BackgroundData, NormalizedPatternData, Pattern, PatternJson } from "../../types";

export const MAX_LINE_ANGLE = 85;

export function clampLineAngle(a: number): number {
  return Number.isFinite(a) ? Math.min(MAX_LINE_ANGLE, Math.max(-MAX_LINE_ANGLE, a)) : 0;
}

export function buildPatternData(pattern: Pattern) {
  return {
    name: pattern.name,
    showConductor: showsConductor(pattern),
    showCenterLine: showsCenterLine(pattern),
    lines: (pattern.lines || []).map((l) => ({ id: l.id, pos: l.pos, ...(l.angle ? { angle: l.angle } : {}) })),
    partSettings: ensurePartSettings(pattern),
    specialMarkers: pattern.specialMarkers ?? [],
    ...(pattern.curve ? { curve: pattern.curve } : {}),
    ...(pattern.background ? { background: { ...pattern.background } } : {}),
    rows: pattern.rows.map((row) => ({
      segments: row.segments,
      gaps: row.gaps,
      onRiser: !!row.onRiser,
      ...(row.riserWidth != null ? { riserWidth: row.riserWidth } : {}),
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
          const riserWidth = typeof r.riserWidth === "number" && Number.isFinite(r.riserWidth) && r.riserWidth > 0 ? r.riserWidth : undefined;
          return { segments, gaps, cells, onRiser: !!r.onRiser, shift, riserWidth };
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
          const angle = clampLineAngle(Number(l.angle));
          return { id: makeLineId(), pos, ...(angle ? { angle } : {}) };
        })
        .filter((l): l is { id: string; pos: number; angle?: number } => l !== null)
    : [];

  const specialMarkers: import("../../types").SpecialMarker[] = Array.isArray(data.specialMarkers)
    ? data.specialMarkers
        .filter((m) => m && typeof m.label === "string" && (m.side === "left" || m.side === "right"))
        .map((m, i) => ({ id: typeof m.id === "string" ? m.id : `sm${i}`, label: m.label, side: m.side as "left" | "right" }))
    : [];

  return {
    name: typeof data.name === "string" ? data.name : "",
    rows,
    partSettings: { scheme, counts },
    showConductor: data.showConductor !== false,
    showCenterLine: !!data.showCenterLine,
    lines,
    specialMarkers,
    curve: typeof data.curve === "number" && Number.isFinite(data.curve) ? Math.min(100, Math.max(0, data.curve)) : 0,
    background: normalizeBackground(data.background),
  };
}

function normalizeBackground(b: PatternJson["background"]): BackgroundData | null {
  if (!b || typeof b.imageId !== "string" || !b.imageId) return null;
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return {
    imageId: b.imageId,
    aspect: Math.max(0.01, num(b.aspect, 1)),
    x: num(b.x, -450),
    y: num(b.y, 0),
    width: Math.max(20, num(b.width, 900)),
    opacity: Math.min(1, Math.max(0, num(b.opacity, 0.5))),
  };
}

export function applyNormalizedDataToPattern(pattern: Pattern, normalized: NormalizedPatternData) {
  if (normalized.name) pattern.name = normalized.name;
  pattern.rows = normalized.rows;
  pattern.partSettings = normalized.partSettings;
  pattern.showConductor = normalized.showConductor;
  pattern.showCenterLine = normalized.showCenterLine;
  pattern.lines = normalized.lines;
  pattern.specialMarkers = normalized.specialMarkers;
  pattern.curve = normalized.curve;
  pattern.background = normalized.background;
}
