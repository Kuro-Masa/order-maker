import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MenuDotsIcon } from "../../icons";
import { useApp } from "../../state/AppStoreContext";

export function MenuPanel() {
  const {
    renameActivePattern,
    clearAllNames,
    shareCurrentPattern,
    refreshShareFromServer,
    exportCsvFile,
    importCsvFile,
    importJsonFile,
    deleteActivePattern,
  } = useApp();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  function handleCsvChange(e: ChangeEvent<HTMLInputElement>) {
    setOpen(false);
    const file = e.target.files?.[0];
    if (file) importCsvFile(file);
    e.target.value = "";
  }

  function handleJsonChange(e: ChangeEvent<HTMLInputElement>) {
    setOpen(false);
    const file = e.target.files?.[0];
    if (file) importJsonFile(file);
    e.target.value = "";
  }

  return (
    <div className="menuWrap" ref={wrapRef}>
      <button
        type="button"
        className="iconBtn"
        aria-label="メニュー"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MenuDotsIcon />
      </button>
      {open && (
        <div className="menuPanel">
          <button type="button" className="menuItem" onClick={() => run(renameActivePattern)}>
            名前を変更
          </button>
          <button type="button" className="menuItem" onClick={() => run(clearAllNames)}>
            名前を全消去
          </button>
          <button type="button" className="menuItem" onClick={() => run(shareCurrentPattern)}>
            共有リンクを作成/更新
          </button>
          <button type="button" className="menuItem" onClick={() => run(refreshShareFromServer)}>
            共有内容を最新に取得
          </button>
          <button type="button" className="menuItem" onClick={() => run(exportCsvFile)}>
            CSV書き出し(名前のみ)
          </button>
          <label className="menuItem file-btn">
            CSV読み込み(名前のみ)
            <input type="file" accept=".csv" hidden onChange={handleCsvChange} />
          </label>
          <label className="menuItem file-btn">
            JSON読み込み(全設定)
            <input type="file" accept=".json" hidden onChange={handleJsonChange} />
          </label>
          <button type="button" className="menuItem danger" onClick={() => run(deleteActivePattern)}>
            このパターンを削除
          </button>
        </div>
      )}
    </div>
  );
}
