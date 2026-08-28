import { useEffect, useRef, useState } from "react";
import { TrashIcon, EditModeIcon } from "../icons";
import { useApp } from "../state/AppStoreContext";
import type { Pattern } from "../types";

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}


function PatternMiniPreview({ pattern }: { pattern: Pattern }) {
  const VW = 120;
  const VH = 84;
  const cellW = 9;
  const cellH = 7;
  const cellGap = 1.5;
  const rowGap = 5;

  const maxCols = Math.max(...pattern.rows.map((r) => r.cells.length), 1);
  const naturalRowPx = maxCols * cellW + (maxCols - 1) * cellGap;
  const scale = Math.min(1, (VW - 8) / naturalRowPx);
  const scaledCellW = cellW * scale;
  const scaledCellGap = cellGap * scale;
  const scaledCellH = cellH * scale;

  const rowsHeight =
    pattern.rows.length * scaledCellH + Math.max(0, pattern.rows.length - 1) * rowGap;
  const conductorR = 5;
  const conductorY = rowsHeight + rowGap + conductorR;
  const totalH = pattern.showConductor !== false ? conductorY + conductorR : rowsHeight;
  const startY = Math.max(0, (VH - totalH) / 2);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="80" aria-hidden="true">
      {pattern.rows.map((row, r) => {
        const rowWidth =
          row.cells.length * scaledCellW + Math.max(0, row.cells.length - 1) * scaledCellGap;
        const xStart = (VW - rowWidth) / 2;
        const y = startY + r * (scaledCellH + rowGap);
        return row.cells.map((cell, c) => (
          <rect
            key={c}
            x={xStart + c * (scaledCellW + scaledCellGap)}
            y={y}
            width={scaledCellW}
            height={scaledCellH}
            rx={1.5}
            fill={cell.color ?? "#4F6BF8"}
          />
        ));
      })}
      {pattern.showConductor !== false && (
        <circle
          cx={VW / 2}
          cy={startY + conductorY}
          r={conductorR}
          fill="#1A2035"
          opacity={0.5}
        />
      )}
    </svg>
  );
}

interface CardProps {
  pattern: Pattern;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function LayoutCard({ pattern, onOpen, onRename, onDelete }: CardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(pattern.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renaming) setDraft(pattern.name);
  }, [pattern.name, renaming]);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  function commitRename() {
    const trimmed = draft.trim();
    onRename(trimmed || pattern.name);
    setRenaming(false);
  }

  function startRename(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(pattern.name);
    setRenaming(true);
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`「${pattern.name}」を削除しますか？`)) return;
    onDelete();
  }

  return (
    <div className="layoutCard">
      <button
        type="button"
        className="cardThumbBtn"
        onClick={onOpen}
        aria-label={`${pattern.name}を編集`}
      >
        <PatternMiniPreview pattern={pattern} />
      </button>
      <div className="cardInfoRow">
        <div className="cardNameWrap">
          {renaming ? (
            <input
              ref={inputRef}
              className="cardRenameInput"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") { setDraft(pattern.name); setRenaming(false); }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="cardName" onDoubleClick={startRename} title={pattern.name}>
              {pattern.name || "無題"}
            </span>
          )}
        </div>
        <div className="cardActions">
          <button
            type="button"
            className="cardActionBtn"
            onClick={startRename}
            title="名前を変更"
            aria-label="名前を変更"
          >
            <EditModeIcon />
          </button>
          <button
            type="button"
            className="cardActionBtn danger"
            onClick={handleDelete}
            title="削除"
            aria-label="削除"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListScreen() {
  const { state, navigateToEdit, addPattern, renamePattern, deletePattern } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNew() {
    addPattern();
    navigateToEdit();
  }

  return (
    <div className="listScreen">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div className="sidebarBackdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={"listSidebar" + (sidebarOpen ? " listSidebarOpen" : "")}>
        <div className="listSidebarHead">
          <div className="listSidebarMark">
            <svg width="15" height="13" viewBox="0 0 15 13" fill="none" aria-hidden="true">
              <rect x="0" y="0" width="15" height="3" rx="1.5" fill="white"/>
              <rect x="1.5" y="5" width="12" height="3" rx="1.5" fill="white" opacity="0.78"/>
              <rect x="4" y="10" width="7" height="3" rx="1.5" fill="white" opacity="0.55"/>
            </svg>
          </div>
          <span className="listSidebarName">narabi</span>
          <button type="button" className="sidebarCloseBtn" aria-label="サイドバーを閉じる" onClick={() => setSidebarOpen(false)}>✕</button>
        </div>
        <nav className="listSidebarNav">
          <div className="listNavItem listNavItemActive">
            <GridIcon />
            マイレイアウト
          </div>
        </nav>
        <div className="listSidebarUser">
          <div className="listSidebarAvatar">K</div>
          <span className="listSidebarUserName">ログイン中</span>
        </div>
      </aside>

      {/* Main content */}
      <div className="listMain">
        <div className="listMainHead">
          <button type="button" className="sidebarToggleBtn" aria-label="メニューを開く" onClick={() => setSidebarOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="2" y="4" width="14" height="1.8" rx="0.9" fill="currentColor"/>
              <rect x="2" y="8.1" width="14" height="1.8" rx="0.9" fill="currentColor"/>
              <rect x="2" y="12.2" width="14" height="1.8" rx="0.9" fill="currentColor"/>
            </svg>
          </button>
          <h1 className="listMainTitle">マイレイアウト</h1>
          <button type="button" className="listNewBtn" onClick={handleNew}>
            ＋ 新しいレイアウト
          </button>
        </div>

        <div className="cardGrid">
          {state.patterns.map((p: Pattern) => (
            <LayoutCard
              key={p.id}
              pattern={p}
              onOpen={() => navigateToEdit(p.id)}
              onRename={(name) => renamePattern(p.id, name)}
              onDelete={() => deletePattern(p.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
