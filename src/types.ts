export interface CellData {
  name: string;
  color: string | null;
}

export interface RowData {
  segments: number[];
  gaps: number[];
  cells: CellData[];
  onRiser: boolean;
  shift?: number; // -1 = left half-cell, 0 = center, 1 = right half-cell
}

export interface LineData {
  id: string;
  pos: number;
}

export interface PartSettings {
  scheme: string;
  counts: Record<string, number>;
}

export interface Pattern {
  id: string;
  name: string;
  rows: RowData[];
  partSettings: PartSettings;
  showConductor: boolean;
  showCenterLine: boolean;
  lines: LineData[];
  shareId: string | null;
}

export interface AppState {
  patterns: Pattern[];
  activeId: string | null;
}

export type Mode = "edit" | "swap" | "paint" | "line";

export interface Selected {
  r: number;
  c: number;
}

export interface PartSchemeEntry {
  key: string;
  color: string;
}

export interface PatternJson {
  type?: string;
  version?: number;
  name?: string;
  showConductor?: boolean;
  showCenterLine?: boolean;
  lines?: { pos: number }[];
  partSettings?: { scheme?: string; counts?: Record<string, number> };
  rows?: {
    segments?: number[];
    gaps?: number[];
    onRiser?: boolean;
    shift?: number;
    stagger?: boolean;
    cells?: { name?: string; color?: string | null }[];
  }[];
  updatedAt?: unknown;
}

export interface NormalizedPatternData {
  name: string;
  rows: RowData[];
  partSettings: PartSettings;
  showConductor: boolean;
  showCenterLine: boolean;
  lines: LineData[];
}
