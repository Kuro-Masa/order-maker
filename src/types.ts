export interface CellData {
  name: string;
  color: string | null;
}

export interface RowData {
  segments: number[];
  gaps: number[];
  cells: CellData[];
  onRiser: boolean;
  riserWidth?: number; // custom riser background width in cell units (undefined = auto)
  shift?: number; // -1 = left half-cell, 0 = center, 1 = right half-cell
}

export interface LineData {
  id: string;
  pos: number;
  angle?: number; // degrees, clockwise, pivoting on the front (conductor-side) end
}

export interface PartSettings {
  scheme: string;
  counts: Record<string, number>;
}

export interface SpecialMarker {
  id: string;
  label: string;
  side: "left" | "right";
}

// Floor plan or venue drawing shown under the grid. The image itself lives in
// backgrounds/{imageId} (and a local cache); the layout only keeps where it sits.
export interface BackgroundData {
  imageId: string;
  aspect: number; // height / width of the image
  x: number; // left edge, px from the grid's center axis
  y: number; // top edge, px from the top of the first row
  width: number; // px at 100% zoom
  opacity: number; // 0..1
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
  members?: Member[];
  updatedAt?: number;
  specialMarkers?: SpecialMarker[];
  curve?: number; // 0 = straight, 100 = semicircle
  background?: BackgroundData | null;
}

export interface Member {
  id: string;
  name: string;
  part1: string;
  part2: string;
}

export interface AppState {
  patterns: Pattern[];
  activeId: string | null;
  members: Member[];
}

export type Mode = "edit" | "swap" | "paint" | "line" | "background";

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
  lines?: { pos: number; angle?: number }[];
  partSettings?: { scheme?: string; counts?: Record<string, number> };
  rows?: {
    segments?: number[];
    gaps?: number[];
    onRiser?: boolean;
    riserWidth?: number;
    shift?: number;
    stagger?: boolean;
    cells?: { name?: string; color?: string | null }[];
  }[];
  specialMarkers?: { id?: string; label: string; side: string }[];
  curve?: number;
  background?: Partial<BackgroundData> | null;
  updatedAt?: unknown;
  writerId?: string;
}

export interface NormalizedPatternData {
  name: string;
  rows: RowData[];
  partSettings: PartSettings;
  showConductor: boolean;
  showCenterLine: boolean;
  lines: LineData[];
  specialMarkers: SpecialMarker[];
  curve: number;
  background: BackgroundData | null;
}
