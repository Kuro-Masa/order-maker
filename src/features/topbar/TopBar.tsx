import { useEffect, useState } from "react";
import { useApp } from "../../state/AppStoreContext";
import { MenuPanel } from "./MenuPanel";

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

export function TopBar() {
  const { navigateToList } = useApp();
  return (
    <section className="topBar">
      <button type="button" className="topBarBackBtn" onClick={navigateToList}>
        ← 一覧
      </button>
      <PatternNameInput />
      <MenuPanel />
    </section>
  );
}
