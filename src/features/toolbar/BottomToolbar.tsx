import { useState } from "react";
import { ImageIcon, TrashIcon } from "../../icons";
import { showsCenterLine } from "../../state/patternHelpers";
import { useApp } from "../../state/AppStoreContext";
import { RowSettingsContent } from "../settings/RowLayoutSettings";
import { PartColorSettingsContent } from "../settings/PartColorSettings";
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" strokeWidth="1.8" strokeLinejoin="round" />
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

function NamesPanel() {
  const { clearAllNames } = useApp();
  return (
    <div className="panelContent">
      <p className="panelHint">
        マスをタップして名前を入力できます。Enterで次へ、Tabで隣のマスへ移動します。
      </p>
      <button type="button" className="btn" onClick={clearAllNames}>
        名前を全消去
      </button>
    </div>
  );
}

function SortPanel() {
  return (
    <div className="panelContent">
      <p className="panelHint">
        入れ替えたい2つのマスを順にタップしてください。選択中のマスは黄色くハイライトされます。
      </p>
    </div>
  );
}

function PaintPanel() {
  return (
    <div className="panelContent">
      <PartColorSettingsContent />
    </div>
  );
}

function LinesPanel() {
  const { activePattern, toggleCenterLine, updateLinePos, removeLine } = useApp();
  return (
    <div className="panelContent">
      <p className="panelHint">
        空いている場所をタップして縦線を追加。追加した線はドラッグで移動できます。
      </p>
      <label className="conductorToggle">
        <input
          type="checkbox"
          checked={showsCenterLine(activePattern)}
          onChange={(e) => toggleCenterLine(e.target.checked)}
        />
        中心線を表示
      </label>
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
    <div className="panelContent sharePanelContent">
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
  { id: "names", icon: <PencilIcon />,      label: "名前編集"   },
  { id: "sort",  icon: <SortArrowsIcon />,  label: "入れ替え"   },
  { id: "paint", icon: <PaletteIcon />,     label: "色塗り"     },
  { id: "lines", icon: <VerticalLinesIcon />, label: "縦線"     },
  { id: "share", icon: <ShareOutputIcon />, label: "出力・共有" },
];

// ── Main export ───────────────────────────────────────────────

export function BottomToolbar() {
  const { changeMode, toolbarMode, setToolbarMode } = useApp();
  const [panelOpen, setPanelOpen] = useState(false);
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
          {toolbarMode === "names" && <NamesPanel />}
          {toolbarMode === "sort"  && <SortPanel />}
          {toolbarMode === "paint" && <PaintPanel />}
          {toolbarMode === "lines" && <LinesPanel />}
          {toolbarMode === "share" && <SharePanel />}
        </div>
      )}
    </div>
  );
}
