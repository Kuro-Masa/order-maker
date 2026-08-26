import { useEffect, useRef, type CSSProperties, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { CELL_MAX_LENGTH, CELL_TEXT_COLOR } from "../../constants";
import { useApp } from "../../state/AppStoreContext";
import type { RowData } from "../../types";

export function Cell({ row, r, c }: { row: RowData; r: number; c: number }) {
  const { mode, selected, setCellName, onCellSwapClick, paintCell, currentColor } = useApp();
  const cellData = row.cells[c];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== cellData.name) {
      el.textContent = cellData.name;
    }
  }, [cellData.name]);

  const style: CSSProperties = {};
  if (cellData.color) {
    style.background = cellData.color;
    style.color = CELL_TEXT_COLOR;
  }

  let className = "cell";
  if (mode !== "edit") className += " readonly-mode";
  if (mode === "swap" && selected && selected.r === r && selected.c === c) className += " selected";

  function handleInput(e: FormEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    let text = el.textContent || "";
    if (text.length > CELL_MAX_LENGTH) {
      text = text.slice(0, CELL_MAX_LENGTH);
      el.textContent = text;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setCellName(r, c, text);
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter") e.preventDefault();
  }

  function handleClick() {
    if (mode === "swap") onCellSwapClick(r, c);
    else if (mode === "paint") paintCell(r, c, currentColor);
  }

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      spellCheck={false}
      contentEditable={mode === "edit"}
      suppressContentEditableWarning
      onInput={mode === "edit" ? handleInput : undefined}
      onPaste={mode === "edit" ? handlePaste : undefined}
      onKeyDown={mode === "edit" ? handleKeyDown : undefined}
      onClick={mode === "swap" || mode === "paint" ? handleClick : undefined}
    />
  );
}
