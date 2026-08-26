import type { PartSchemeEntry } from "./types";

export const STORAGE_KEY = "narabikae_state_v3";

export const PALETTE = [
  "#a9d6a5",
  "#a9c9e8",
  "#d3a9d6",
  "#f0da8a",
  "#e8a9a9",
  "#f0c08a",
  "#a9e0d6",
  "#cfd3da",
];

export const PART_SCHEMES: Record<string, PartSchemeEntry[]> = {
  "4": [
    { key: "Sop", color: "#e8a9a9" },
    { key: "Alt", color: "#f0da8a" },
    { key: "Ten", color: "#a9c9e8" },
    { key: "Bas", color: "#a9d6a5" },
  ],
  "6": [
    { key: "Sop", color: "#e8a9a9" },
    { key: "Mez", color: "#f0c08a" },
    { key: "Alt", color: "#f0da8a" },
    { key: "Ten", color: "#a9c9e8" },
    { key: "Bar", color: "#a9e0d6" },
    { key: "Bas", color: "#a9d6a5" },
  ],
  "8": [
    { key: "Sop1", color: "#e8a9a9" },
    { key: "Sop2", color: "#eec4ae" },
    { key: "Alt1", color: "#f0da8a" },
    { key: "Alt2", color: "#d7e2a0" },
    { key: "Ten1", color: "#a9c9e8" },
    { key: "Ten2", color: "#c3b8ea" },
    { key: "Bas1", color: "#a9d6a5" },
    { key: "Bas2", color: "#a9e0d6" },
  ],
};

export const CELL_TEXT_COLOR = "#1f2430";

export const DEFAULT_ROW_COUNT = 4;
export const DEFAULT_COL_COUNT = 6;
export const DEFAULT_GAP_CELLS = 0.25;

export const CELL_W = 44;
export const CELL_H = 52;
export const GAP_X = 2;
export const GAP_Y = 10;
export const GRID_PAD_LEFT = 4;
export const RISER_PAD = 8;

export const RISER_COLOR = "#d9c7a8";
export const RISER_BORDER = "#b3987a";
export const LINE_COLOR = "#d98c3c";
export const CENTER_LINE_COLOR = "#333333";

export const CELL_MAX_LENGTH = 10;

export const firebaseConfig = {
  apiKey: "AIzaSyDlQrgeQXoDHlw9OlYM92Om5mnh9_qlwTY",
  authDomain: "order-maker-e0b6c.firebaseapp.com",
  projectId: "order-maker-e0b6c",
  storageBucket: "order-maker-e0b6c.firebasestorage.app",
  messagingSenderId: "347811601828",
  appId: "1:347811601828:web:3cb7b4abd5c81b8535b531",
};
