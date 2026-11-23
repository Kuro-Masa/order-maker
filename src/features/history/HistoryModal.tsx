import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../../state/AppStoreContext";
import { PatternMiniPreview } from "../../screens/ListScreen";
import { normalizePatternFromJson } from "../io/json";
import { fetchHistory, type HistoryEntry } from "./history";
import type { Pattern } from "../../types";

function formatTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return `今日 ${hm}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  return `${sameYear ? "" : d.getFullYear() + "/"}${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

function entryPattern(entry: HistoryEntry): Pattern {
  const n = normalizePatternFromJson(entry.data);
  return { ...n, id: entry.id, shareId: null };
}

export function HistoryModal({ onClose }: { onClose: () => void }) {
  const { activePattern, user, signIn, restoreFromHistory } = useApp();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const available = !!activePattern && (!!activePattern.shareId || !!user);

  useEffect(() => {
    if (!activePattern || !available) return;
    let alive = true;
    setEntries(null);
    setError(null);
    fetchHistory(activePattern, user?.uid ?? null)
      .then((list) => alive && setEntries(list))
      .catch((e) => {
        console.error(e);
        if (alive) setError("履歴を読み込めませんでした");
      });
    return () => {
      alive = false;
    };
    // Reload when switching layouts or accounts, not on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePattern?.id, activePattern?.shareId, user?.uid, available]);

  function handleRestore(entry: HistoryEntry) {
    if (!confirm(`${formatTime(entry.endedAt)}（${entry.editor.name}）の状態に戻しますか？\n戻したあとも「元に戻す」で取り消せます。`)) return;
    restoreFromHistory(entry.data);
    onClose();
  }

  return createPortal(
    <div className="memberDialogBackdrop" onClick={onClose}>
      <div className="privacyModal historyModal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="編集履歴">
        <div className="privacyModalHead">
          <h2 className="privacyModalTitle">編集履歴</h2>
          <button type="button" className="privacyModalClose" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <div className="historyBody">
          {!available ? (
            <div className="historyEmpty">
              <p>ログインすると、このレイアウトの編集履歴が保存され、過去の状態に戻せるようになります。</p>
              <p>共有リンクで共有したレイアウトは、ログインしなくても履歴が残ります。</p>
              <button type="button" className="accountSignInBtn historySignInBtn" onClick={signIn}>Googleでログイン</button>
            </div>
          ) : error ? (
            <p className="historyEmpty">{error}</p>
          ) : entries === null ? (
            <p className="historyEmpty">読み込み中…</p>
          ) : entries.length === 0 ? (
            <p className="historyEmpty">まだ履歴がありません。編集すると数秒後に記録されます。</p>
          ) : (
            <ul className="historyList">
              {entries.map((entry, i) => (
                <li key={entry.id} className="historyItem">
                  <div className="historyThumb">
                    <PatternMiniPreview pattern={entryPattern(entry)} />
                  </div>
                  <div className="historyMeta">
                    <span className="historyTime">
                      {formatTime(entry.endedAt)}
                      {i === 0 && <span className="historyLatest">最新</span>}
                    </span>
                    <span className="historyEditor">{entry.editor.name}</span>
                    <span className="historyName">{entry.data.name}</span>
                  </div>
                  <button type="button" className="historyRestoreBtn" onClick={() => handleRestore(entry)}>
                    この状態に戻す
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
