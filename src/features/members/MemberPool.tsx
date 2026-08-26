import { useState, useRef, type ChangeEvent } from "react";
import { useApp } from "../../state/AppStoreContext";
import type { Member } from "../../types";

// ── Types ──────────────────────────────────────────────────────

type ColRole = "name" | "part1" | "part2" | "skip";

const COL_ROLE_LABELS: Record<ColRole, string> = {
  name: "氏名",
  part1: "パート1",
  part2: "パート2",
  skip: "スキップ",
};

// ── Parsing ────────────────────────────────────────────────────

function parseRawText(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows: string[][] = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const sep = raw.includes("\t") ? "\t" : ",";
    const cols = raw.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
    rows.push(cols);
  }
  return rows;
}

const NAME_KEYWORDS = ["氏名", "名前", "name"];
const PART1_KEYWORDS = ["パート1", "part1", "パート", "part"];
const PART2_KEYWORDS = ["パート2", "part2"];

function autoDetectRoles(firstRow: string[]): { roles: ColRole[]; isHeader: boolean } {
  const lower = firstRow.map((c) => c.toLowerCase());
  const roles: ColRole[] = firstRow.map(() => "skip" as ColRole);
  let isHeader = false;

  for (let i = 0; i < lower.length; i++) {
    const c = lower[i];
    if (NAME_KEYWORDS.some((k) => c.includes(k.toLowerCase()))) {
      roles[i] = "name"; isHeader = true;
    } else if (PART2_KEYWORDS.some((k) => c.includes(k.toLowerCase()))) {
      roles[i] = "part2"; isHeader = true;
    } else if (PART1_KEYWORDS.some((k) => c.includes(k.toLowerCase()))) {
      roles[i] = "part1"; isHeader = true;
    }
  }

  if (!isHeader) {
    if (firstRow.length >= 3) { roles[0] = "part1"; roles[1] = "part2"; roles[2] = "name"; }
    else if (firstRow.length === 2) { roles[0] = "part1"; roles[1] = "name"; }
    else if (firstRow.length === 1) { roles[0] = "name"; }
  }

  return { roles, isHeader };
}

function buildMembers(rows: string[][], roles: ColRole[], skipHeader: boolean): Member[] {
  const nameIdx = roles.indexOf("name");
  const part1Idx = roles.indexOf("part1");
  const part2Idx = roles.indexOf("part2");
  if (nameIdx < 0) return [];
  return rows.slice(skipHeader ? 1 : 0).flatMap((row) => {
    const name = row[nameIdx]?.trim() ?? "";
    if (!name) return [];
    return [{
      id: Math.random().toString(36).slice(2),
      name,
      part1: part1Idx >= 0 ? (row[part1Idx]?.trim() ?? "") : "",
      part2: part2Idx >= 0 ? (row[part2Idx]?.trim() ?? "") : "",
    }];
  });
}

// ── Template download ──────────────────────────────────────────

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

// ── Column mapping UI ──────────────────────────────────────────

function ColMapping({
  parsedRows,
  colRoles,
  skipHeader,
  onRoleChange,
  onSkipHeaderChange,
}: {
  parsedRows: string[][];
  colRoles: ColRole[];
  skipHeader: boolean;
  onRoleChange: (idx: number, role: ColRole) => void;
  onSkipHeaderChange: (v: boolean) => void;
}) {
  const numCols = parsedRows[0]?.length ?? 0;
  const members = buildMembers(parsedRows, colRoles, skipHeader);
  const nameAssigned = colRoles.includes("name");

  return (
    <div className="colMapping">
      <div className="colMappingCols">
        {Array.from({ length: numCols }, (_, i) => (
          <div key={i} className="colMappingItem">
            <div className="colSample" title={parsedRows[0]?.[i] ?? ""}>
              {parsedRows[0]?.[i] ?? ""}
            </div>
            <select
              className="colRoleSelect"
              value={colRoles[i] ?? "skip"}
              onChange={(e) => onRoleChange(i, e.target.value as ColRole)}
            >
              {(["name", "part1", "part2", "skip"] as ColRole[]).map((r) => (
                <option key={r} value={r}>{COL_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <label className="skipHeaderLabel">
        <input
          type="checkbox"
          checked={skipHeader}
          onChange={(e) => onSkipHeaderChange(e.target.checked)}
        />
        先頭行をヘッダーとしてスキップ
      </label>
      <p className="memberPastePreview">
        {!nameAssigned
          ? "▲ 氏名の列を指定してください"
          : members.length > 0
          ? `${members.length}人を認識しました`
          : "有効な氏名が見つかりません"}
      </p>
    </div>
  );
}

// ── Import dialog ──────────────────────────────────────────────

function ImportDialog({ onClose }: { onClose: () => void }) {
  const { setMembers } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"paste" | "file">("paste");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [colRoles, setColRoles] = useState<ColRole[]>([]);
  const [skipHeader, setSkipHeader] = useState(false);

  function applyParsed(rows: string[][]) {
    setParsedRows(rows);
    if (rows.length > 0) {
      const { roles, isHeader } = autoDetectRoles(rows[0]);
      setColRoles(roles);
      setSkipHeader(isHeader);
    } else {
      setColRoles([]);
      setSkipHeader(false);
    }
  }

  function switchTab(t: "paste" | "file") {
    setTab(t);
    setError(null);
    setParsedRows([]);
    setColRoles([]);
    setPasteText("");
    setFileName(null);
  }

  function handlePasteChange(text: string) {
    setPasteText(text);
    setError(null);
    applyParsed(parseRawText(text));
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      applyParsed(parseRawText(ev.target?.result as string));
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }

  function handleRoleChange(idx: number, role: ColRole) {
    setColRoles((prev) => {
      const next = [...prev];
      if (role !== "skip") {
        const existing = next.indexOf(role);
        if (existing >= 0 && existing !== idx) next[existing] = "skip";
      }
      next[idx] = role;
      return next;
    });
  }

  const members = buildMembers(parsedRows, colRoles, skipHeader);

  function handleImport() {
    if (!colRoles.includes("name")) {
      setError("氏名の列を指定してください。");
      return;
    }
    if (members.length === 0) {
      setError("メンバーが見つかりませんでした。");
      return;
    }
    setMembers(members);
    onClose();
  }

  return (
    <div className="memberDialogBackdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="memberDialog" role="dialog" aria-modal="true" aria-label="メンバーを取り込む">
        <h2 className="memberDialogTitle">メンバーを取り込む</h2>

        <div className="memberDialogTabs">
          <button
            type="button"
            className={"memberDialogTab" + (tab === "paste" ? " active" : "")}
            onClick={() => switchTab("paste")}
          >
            スプレッドシートからコピペ
          </button>
          <button
            type="button"
            className={"memberDialogTab" + (tab === "file" ? " active" : "")}
            onClick={() => switchTab("file")}
          >
            CSVファイル
          </button>
        </div>

        {tab === "paste" ? (
          <textarea
            className="memberPasteArea"
            placeholder={"Sop\t1st\t田中 花子\nAlt\t2nd\t鈴木 美咲\n\n※ 列の割り当ては貼り付け後に設定できます"}
            value={pasteText}
            onChange={(e) => handlePasteChange(e.target.value)}
            rows={4}
            spellCheck={false}
          />
        ) : (
          <>
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

        {parsedRows.length > 0 && (
          <ColMapping
            parsedRows={parsedRows}
            colRoles={colRoles}
            skipHeader={skipHeader}
            onRoleChange={handleRoleChange}
            onSkipHeaderChange={setSkipHeader}
          />
        )}

        {error && <p className="memberDialogError">{error}</p>}
        <div className="memberDialogBtns">
          <button type="button" className="btn" onClick={onClose}>キャンセル</button>
          <button
            type="button"
            className="btn primary"
            onClick={handleImport}
            disabled={members.length === 0}
          >
            取り込む
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Touch drag ────────────────────────────────────────────────

function useTouchDrag() {
  const dragRef = useRef<{ member: Member; ghost: HTMLDivElement; offsetX: number; offsetY: number } | null>(null);
  const highlightRef = useRef<Element | null>(null);

  function clearHighlight() {
    highlightRef.current?.classList.remove("touch-drag-over");
    highlightRef.current = null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>, m: Member) {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "memberDragGhost";
    ghost.textContent = m.name;
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.appendChild(ghost);
    dragRef.current = { member: m, ghost, offsetX, offsetY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    drag.ghost.style.left = `${e.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${e.clientY - drag.offsetY}px`;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el?.closest(".cell") ?? null;
    if (cell !== highlightRef.current) {
      clearHighlight();
      if (cell) { cell.classList.add("touch-drag-over"); highlightRef.current = cell; }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    drag?.ghost.remove();
    clearHighlight();
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    el?.closest(".cell")?.dispatchEvent(
      new CustomEvent("memberdrop", { bubbles: false, detail: { name: drag.member.name, memberId: drag.member.id } })
    );
  }

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}

// ── Member pool ────────────────────────────────────────────────

export function MemberPool() {
  const { members, clearMembers } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { handlePointerDown, handlePointerMove, handlePointerUp } = useTouchDrag();

  return (
    <>
      <div className="memberPool">
        <button type="button" className="poolImportTrigger" onClick={() => setDialogOpen(true)}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" aria-hidden="true">
            <path d="M12 3v13M12 16l-4-4m4 4l4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 20h16" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          メンバーを取り込む
        </button>
        {members.length > 0 && (
          <>
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
                  onPointerDown={(e) => handlePointerDown(e, m)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <span className="chipName">{m.name}</span>
                  <div className="chipParts">
                    {m.part1 && <span className="chipPart chipPart1">{m.part1}</span>}
                    {m.part2 && <span className="chipPart chipPart2">{m.part2}</span>}
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="poolClearBtn" onClick={clearMembers}>メンバーをクリア</button>
          </>
        )}
      </div>

      {dialogOpen && <ImportDialog onClose={() => setDialogOpen(false)} />}
    </>
  );
}
