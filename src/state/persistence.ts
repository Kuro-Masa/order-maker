import { STORAGE_KEY } from "../constants";
import type { AppState } from "../types";
import { createDefaultPattern } from "./patternHelpers";

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.patterns) && parsed.patterns.length > 0) {
        let activeId = parsed.activeId || parsed.patterns[0].id;
        if (!parsed.patterns.some((p: { id: string }) => p.id === activeId)) {
          activeId = parsed.patterns[0].id;
        }
        const now = Date.now();
        return {
          patterns: parsed.patterns.map((p: { updatedAt?: number }) =>
            p.updatedAt ? p : { ...p, updatedAt: now }
          ),
          activeId,
          members: Array.isArray(parsed.members) ? parsed.members : [],
        };
      }
    }
  } catch {
    // fall through to fresh state
  }
  const pattern = createDefaultPattern("パターン1");
  return { patterns: [pattern], activeId: pattern.id, members: [] };
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Last server version of each shared pattern, kept across reloads so local edits made
// before a reload (or while offline) can still be merged instead of overwritten
const SHARE_BASES_KEY = STORAGE_KEY + "_share_bases";

export function loadShareBases<T>(): Record<string, T> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARE_BASES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveShareBases(bases: Record<string, unknown>) {
  try {
    localStorage.setItem(SHARE_BASES_KEY, JSON.stringify(bases));
  } catch {
    // storage full or unavailable: the base stays in memory only
  }
}
