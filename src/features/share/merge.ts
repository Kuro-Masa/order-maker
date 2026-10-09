import { buildPatternData, normalizePatternFromJson } from "../io/json";
import type { Pattern, PatternJson } from "../../types";

export type SyncData = ReturnType<typeof canonicalFromPattern>;

// Comparable form of a pattern: line ids are regenerated on every load, so drop them
export function canonicalFromPattern(pattern: Pattern) {
  const data = buildPatternData(pattern);
  return { ...data, lines: data.lines.map((l) => ({ pos: l.pos })) };
}

export function canonicalFromJson(data: PatternJson): SyncData {
  const normalized = normalizePatternFromJson(data);
  return canonicalFromPattern({ ...normalized, id: "", shareId: null });
}

export function sameData(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Three-way merge: keep both sides' changes relative to base, down to individual cells.
// When both sides changed the same value (or a list changed length on both sides), local wins.
export function merge3<T>(base: T, local: T, remote: T): T {
  if (sameData(local, remote)) return local;
  if (sameData(local, base)) return remote;
  if (sameData(remote, base)) return local;

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    if (base.length === local.length && base.length === remote.length) {
      return base.map((b, i) => merge3(b, local[i], remote[i])) as T;
    }
    return local;
  }

  if (isPlainObject(base) && isPlainObject(local) && isPlainObject(remote)) {
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      out[key] = merge3(base[key], local[key], remote[key]);
    }
    return out as T;
  }

  return local;
}
