import { useState, useRef, type ChangeEvent } from "react";
import { useApp } from "../../state/AppStoreContext";
import type { Member } from "../../types";

function parseMemberText(text: string): Member[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const members: Member[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Auto-detect: tab (spreadsheet copy) or comma (CSV)
    const sep = line.includes("\t") ? "\t" : ",";
    const cols = line.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    if (cols.length < 3) continue;
    const [part1, part2, name] = cols;
    if (!name || name === "氏名" || name === "名前") continue; // skip header
    members.push({
      id: Math.random().toString(36).slice(2),
      name: name.trim(),
      part1: part1?.trim() ?? "",
      part2: part2?.trim() ?? "",
    });
  }
  return members;
}

function downloadTemplateCsv() {
  const content = "パート1,パート2,氏名\nSop,1st,田中 花子\nAlt,2nd,鈴木 美咲\n";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "members_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { setMembers } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"paste" | "file">("paste");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<Member[]>([]);

  function handlePasteChange(text: string) {
    setPasteText(text);
    setError(null);
    const parsed = parseMemberText(text);
    pendingRef.current = parsed;
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseMemberText(text);
      if (parsed.length === 0) {
        setError("メンバーが見つかりませんでした。形式を確認してください。");
        pendingRef.current = [];
      } else {
        pendingRef.current = parsed;
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  function handleImport() {
    const pending = pendingRef.current;
    if (pending.length === 0) {
      setError(tab === "paste"
        ? "貼り付けられたデータにメンバーが見つかりませんでした。"
        : "先にCSVファイルを選択してください。");
      return;
    }
    setMembers(pending);
    onClose();
  }

  const pastePreview = parseMemberText(pasteText);

  return (
    <div className="memberDialogBackdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="memberDialog" role="dialog" aria-modal="true" aria-label="メンバーを取り込む">
        <h2 className="memberDialogTitle">メンバーを取り込む</h2>

        <div className="memberDialogTabs">
          <button
            type="button"
            className={"memberDialogTab" + (tab === "paste" ? " active" : "")}
            onClick={() => { setTab("paste"); setError(null); pendingRef.current = []; }}
          >
            スプレッドシートからコピペ
          </button>
          <button
            type="button"
            className={"memberDialogTab" + (tab === "file" ? " active" : "")}
            onClick={() => { setTab("file"); setError(null); pendingRef.current = []; }}
          >
            CSVファイル
          </button>
        </div>

        {tab === "paste" ? (
          <>
            <p className="memberDialogDesc">
              スプレッドシートで <code>パート1</code>・<code>パート2</code>・<code>氏名</code> の3列を選択してコピーし、下に貼り付けてください。
            </p>
            <textarea
              className="memberPasteArea"
              placeholder={"Sop\t1st\t田中 花子\nAlt\t2nd\t鈴木 美咲"}
              value={pasteText}
              onChange={(e) => handlePasteChange(e.target.value)}
              rows={7}
              spellCheck={false}
            />
            {pasteText && (
              <p className="memberPastePreview">
                {pastePreview.length > 0
                  ? `${pastePreview.length}人を認識しました`
                  : "メンバーが認識できません。列の順番を確認してください。"}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="memberDialogDesc">
              パート1・パート2・氏名の3列で作成したCSVを取り込みます。
            </p>
            <button type="button" className="templateLink" onClick={downloadTemplateCsv}>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" aria-hidden="true">
                <path d="M12 3v12m0 0l-3.5-3.5M12 15l3.5-3.5M5 19h14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              テンプレートCSVをダウンロード
            </button>
            <label className="fileDrop" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}>
              <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" fill="none" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeWidth="1.6" strokeLinejoin="round" />
                <polyline points="14 2 14 8 20 8" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span>{fileName ?? "ファイルを選択またはドロップ"}</span>
              <span className="fileDropHint">.csv のみ対応</span>
              <input ref={fileRef} type="file" accept=".csv" hidden onChange={handleFile} />
            </label>
          </>
        )}

        {error && <p className="memberDialogError">{error}</p>}
        <div className="memberDialogBtns">
          <button type="button" className="btn" onClick={onClose}>キャンセル</button>
          <button type="button" className="btn primary" onClick={handleImport}>取り込む</button>
        </div>
      </div>
    </div>
  );
}

export function MemberPool() {
  const { members, clearMembers } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [poolOpen, setPoolOpen] = useState(true);

  return (
    <>
      <div className="memberPool">
        <div className="poolHeader">
          <button
            type="button"
            className="poolToggleBtn"
            onClick={() => setPoolOpen(v => !v)}
            aria-expanded={poolOpen}
            aria-label={poolOpen ? "メンバーを折りたたむ" : "メンバーを広げる"}
          >
            <span className={`poolChevron${poolOpen ? "" : " collapsed"}`}>▾</span>
            <span className="poolLabel">メンバー {members.length > 0 && `(${members.length}人)`}</span>
          </button>
          <div className="poolHeaderActions">
            {members.length > 0 && (
              <button type="button" className="poolClearBtn" onClick={clearMembers}>クリア</button>
            )}
            <button type="button" className="poolImportBtn" onClick={() => setDialogOpen(true)}>
              <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" fill="none" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              CSV取り込み
            </button>
          </div>
        </div>

        {poolOpen && (members.length === 0 ? (
          <button type="button" className="poolEmpty" onClick={() => setDialogOpen(true)}>
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" fill="none" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" strokeWidth="1.6" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span className="poolEmptyText">メンバーをまだ登録していません</span>
            <span className="poolEmptyCta">CSVを取り込む →</span>
          </button>
        ) : (
          <div className="memberList">
            {members.map((m) => (
              <div
                key={m.id}
                className="memberChip"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("application/x-member", m.name);
                  e.dataTransfer.setData("application/x-member-id", m.id);
                }}
              >
                <span className="chipName">{m.name}</span>
                <div className="chipParts">
                  {m.part1 && <span className="chipPart chipPart1">{m.part1}</span>}
                  {m.part2 && <span className="chipPart chipPart2">{m.part2}</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {dialogOpen && <ImportDialog onClose={() => setDialogOpen(false)} />}
    </>
  );
}
