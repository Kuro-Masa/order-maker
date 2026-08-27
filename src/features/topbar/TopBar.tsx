import { useEffect, useRef, useState } from "react";
import { useApp } from "../../state/AppStoreContext";
import type { Pattern } from "../../types";

function PatternNameInput() {
  const { activePattern, renamePattern } = useApp();
  const [draft, setDraft] = useState(activePattern?.name ?? "");

  // Sync only when navigating to a different pattern, not during typing
  useEffect(() => {
    setDraft(activePattern?.name ?? "");
  }, [activePattern?.id]);

  function commit() {
    const trimmed = draft.trim();
    if (!activePattern) return;
    if (trimmed && trimmed !== activePattern.name) {
      renamePattern(activePattern.id, trimmed);
    } else {
      setDraft(activePattern.name);
    }
  }

  return (
    <input
      type="text"
      className="patternNameInput"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      aria-label="パターン名"
    />
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="14" height="1.8" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="2" y="8.1" width="14" height="1.8" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="2" y="12.2" width="14" height="1.8" rx="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

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

function EditSidebarDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { state, activePattern, navigateToEdit, navigateToList, addPattern } = useApp();
  const drawerRef = useRef<HTMLDivElement>(null);

  function handleNew() {
    addPattern();
    navigateToEdit();
    onClose();
  }

  function handlePatternClick(p: Pattern) {
    navigateToEdit(p.id);
    onClose();
  }

  function handleListClick() {
    navigateToList();
    onClose();
  }

  return (
    <>
      {open && (
        <div className="editSidebarBackdrop" onClick={onClose} />
      )}
      <div
        ref={drawerRef}
        className={"editSidebarDrawer" + (open ? " editSidebarDrawerOpen" : "")}
        aria-label="メニュー"
      >
        <div className="editSidebarHead">
          <div className="editSidebarMark">
            <svg width="15" height="13" viewBox="0 0 15 13" fill="none" aria-hidden="true">
              <rect x="0" y="0" width="15" height="3" rx="1.5" fill="white" stroke="none" />
              <rect x="1.5" y="5" width="12" height="3" rx="1.5" fill="white" opacity="0.78" stroke="none" />
              <rect x="4" y="10" width="7" height="3" rx="1.5" fill="white" opacity="0.55" stroke="none" />
            </svg>
          </div>
          <span className="editSidebarName">オーダーメーカー</span>
          <button
            type="button"
            className="editSidebarCloseBtn"
            aria-label="閉じる"
            onClick={onClose}
          >✕</button>
        </div>

        <div className="editSidebarSection">
          <button type="button" className="editSidebarListLink" onClick={handleListClick}>
            ← 一覧画面へ
          </button>
          <button type="button" className="editSidebarNewBtn" onClick={handleNew}>
            ＋ 新しいレイアウト
          </button>
        </div>

        <div className="editSidebarNavLabel">最近のレイアウト</div>
        <nav className="editSidebarNav">
          {state.patterns.map((p) => (
            <button
              key={p.id}
              type="button"
              className={"editSidebarNavItem" + (p.id === activePattern?.id ? " editSidebarNavItemActive" : "")}
              onClick={() => handlePatternClick(p)}
            >
              <GridIcon />
              <span className="editSidebarNavItemName">{p.name || "無題"}</span>
            </button>
          ))}
          {state.patterns.length === 0 && (
            <p className="editSidebarEmpty">レイアウトがありません</p>
          )}
        </nav>
      </div>
    </>
  );
}

export function TopBar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <section className="topBar">
        <button
          type="button"
          className="topBarMenuBtn"
          aria-label="メニューを開く"
          onClick={() => setDrawerOpen(true)}
        >
          <HamburgerIcon />
        </button>
        <PatternNameInput />
      </section>
      <EditSidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
