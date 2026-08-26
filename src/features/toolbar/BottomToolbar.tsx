import { useState } from "react";
import { ImageIcon, TrashIcon } from "../../icons";
import { CELL_W, GAP_X } from "../../constants";
import { showsCenterLine, segmentsTotal } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import type { Pattern } from "../../types";
import { RowSettingsContent } from "../settings/RowLayoutSettings";
import { PartColorSettingsContent } from "../settings/PartColorSettings";
import { MemberPool } from "../members/MemberPool";
import type { Mode } from "../../types";

type ToolbarMode = "rows" | "names" | "sort" | "paint" | "lines" | "share";

const STORE_MODE: Record<ToolbarMode, Mode> = {
  rows: "edit",
  names: "edit",
  sort: "swap",
  paint: "paint",
  lines: "line",
  share: "edit",
};

// ── Icons ─────────────────────────────────────────────────────

function TableLayoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="3" y="5" width="18" height="3.5" rx="1.2" strokeWidth="1.7" />
      <rect x="3" y="10.5" width="18" height="3.5" rx="1.2" strokeWidth="1.7" />
      <rect x="3" y="16" width="18" height="3.5" rx="1.2" strokeWidth="1.7" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="7" r="4" strokeWidth="1.8" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SortArrowsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M4 8h13l-3-3m3 3l-3 3M20 16H7l3 3m-3-3l3-3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M12 21a8 8 0 1 1 0-16c4 0 7 2.5 7 6 0 2-1.5 3-3 3h-2a1.5 1.5 0 0 0 0 3h.5a1.5 1.5 0 0 1 0 3c-.8.3-1.6.5-2.5.5z" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="8" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="14" cy="7" r="1" />
    </svg>
  );
}

function VerticalLinesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M8 4v16M16 4v16" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ShareOutputIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M12 3v12m0-12L8.5 6.5M12 3l3.5 3.5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── Mode panels ───────────────────────────────────────────────

function bestLinePos(pattern: Pattern): number {
  let maxCells = 0;
  pattern.rows.forEach((row) => {
    const n = segmentsTotal(row.segments);
    if (n > maxCells) maxCells = n;
  });
  const halfW = Math.round((maxCells * CELL_W + Math.max(0, maxCells - 1) * GAP_X) / 2);
  const existing = pattern.lines.map((l) => l.pos).sort((a, b) => a - b);
  const sorted = [-halfW, ...existing, halfW];
  let bestMid = 0;
  let bestGap = -1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i];
    if (gap > bestGap) { bestGap = gap; bestMid = (sorted[i] + sorted[i + 1]) / 2; }
  }
  return Math.round(bestMid);
}

function MemberEditPanel() {
  const { clearAllNames } = useApp();
  return (
    <div className="panelContent memberEditPanel">
      <p className="panelHint">マスをタップして名前を入力できます。</p>
      <MemberPool />
      <button type="button" className="btn danger" onClick={clearAllNames}>
        レイアウト上の名前をクリア
      </button>
    </div>
  );
}

function SortPanel() {
  return (
    <div className="panelContent">
      <p className="panelHint">
        入れ替えたい2つのマスを順にタップしてください。選択中のマスは青線で囲われます。
      </p>
    </div>
  );
}

function PaintPanel() {
  return (
    <div className="panelContent">
      <p className="panelHint">声部の色を選択してからマスをタップすると色を塗れます。</p>
      <PartColorSettingsContent />
    </div>
  );
}

function LinesPanel() {
  const { activePattern, toggleCenterLine, addLine, updateLinePos, removeLine } = useApp();
  return (
    <div className="panelContent">
      <p className="panelHint">グリッド上の空いている場所をタップして縦線を追加。追加した線はドラッグで移動できます。</p>
      <div className="linesActions">
        <label className="conductorToggle">
          <input
            type="checkbox"
            checked={showsCenterLine(activePattern)}
            onChange={(e) => toggleCenterLine(e.target.checked)}
          />
          中心線を表示
        </label>
        <button type="button" className="btn" onClick={() => addLine(bestLinePos(activePattern))}>
          縦線を追加
        </button>
      </div>
      {activePattern.lines.length > 0 && (
        <div className="linesList">
          {activePattern.lines.map((line) => (
            <div className="lineItem" key={line.id}>
              <span className="lineTypeLabel">縦線</span>
              <input
                type="number"
                value={Math.round(line.pos)}
                onChange={(e) => updateLinePos(line.id, parseFloat(e.target.value) || 0)}
              />
              <button
                type="button"
                className="btn remove"
                aria-label="この線を削除"
                onClick={() => removeLine(line.id)}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SharePanel() {
  const { exportImageFile } = useApp();

  return (
    <div className="panelContent">
      <p className="panelHint">レイアウトを画像ファイルとして保存できます。</p>
      <button type="button" className="btn exportImageBtn" onClick={exportImageFile}>
        <ImageIcon />
        画像で出力
      </button>
    </div>
  );
}

// ── Toolbar buttons config ────────────────────────────────────

const BUTTONS: { id: ToolbarMode; icon: React.ReactNode; label: string }[] = [
  { id: "rows",  icon: <TableLayoutIcon />, label: "列の編集"   },
  { id: "names", icon: <MembersIcon />,     label: "メンバー編集" },
  { id: "sort",  icon: <SortArrowsIcon />,  label: "入れ替え"   },
  { id: "paint", icon: <PaletteIcon />,     label: "色塗り"     },
  { id: "lines", icon: <VerticalLinesIcon />, label: "縦線"     },
  { id: "share", icon: <ShareOutputIcon />, label: "出力"      },
];

// ── Main export ───────────────────────────────────────────────

export function BottomToolbar() {
  const { changeMode, toolbarMode, setToolbarMode } = useApp();
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelHeight, setPanelHeight] = useState(200);

  function selectMode(m: ToolbarMode) {
    if (toolbarMode === m) {
      setPanelOpen(v => !v);
    } else {
      setToolbarMode(m);
      changeMode(STORE_MODE[m]);
      setPanelOpen(true);
    }
  }

  function handleResizePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const startY = e.clientY;
    const startH = panelHeight;
    function onMove(ev: PointerEvent) {
      const delta = startY - ev.clientY;
      setPanelHeight(Math.max(80, Math.min(600, startH + delta)));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="editBottom">
      <div className="modeToolbar" role="toolbar" aria-label="編集モード">
        {BUTTONS.map(({ id, icon, label }) => (
          <button
            key={id}
            type="button"
            className={"modeBtn" + (toolbarMode === id ? " active" : "")}
            onClick={() => selectMode(id)}
            aria-pressed={toolbarMode === id}
          >
            {icon}
            <span className="modeBtnLabel">{label}</span>
          </button>
        ))}
      </div>
      {panelOpen && (
        <div className="modeSettingsPanel" style={{ height: panelHeight }}>
          <div className="panelResizeHandle" onPointerDown={handleResizePointerDown} />
          {toolbarMode === "rows"  && <div className="panelContent"><RowSettingsContent /></div>}
          {toolbarMode === "names" && <MemberEditPanel />}
          {toolbarMode === "sort"  && <SortPanel />}
          {toolbarMode === "paint" && <PaintPanel />}
          {toolbarMode === "lines" && <LinesPanel />}
          {toolbarMode === "share" && <SharePanel />}
        </div>
      )}
    </div>
  );
}
