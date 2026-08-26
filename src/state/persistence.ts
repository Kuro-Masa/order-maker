import { DEFAULT_COL_COUNT, DEFAULT_ROW_COUNT, STORAGE_KEY } from "../constants";
import type { AppState } from "../types";
import { createPattern } from "./patternHelpers";

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
        return {
          patterns: parsed.patterns,
          activeId,
          members: Array.isArray(parsed.members) ? parsed.members : [],
        };
      }
    }
  } catch {
    // fall through to fresh state
  }
  const pattern = createPattern("パターン1", DEFAULT_ROW_COUNT, DEFAULT_COL_COUNT);
  return { patterns: [pattern], activeId: pattern.id, members: [] };
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
