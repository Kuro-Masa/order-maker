import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ClipboardEvent, type DragEvent } from "react";
import { CELL_MAX_LENGTH, CELL_TEXT_COLOR } from "../../constants";
import { useApp } from "../../state/AppStoreContext";
import type { RowData } from "../../types";

export function Cell({ row, r, c }: { row: RowData; r: number; c: number }) {
  const { mode, selected, setCellName, onCellSwapClick, paintCell, currentColor, removeMember, toolbarMode } = useApp();
  const rowsMode = toolbarMode === "rows";
  const cellData = row.cells[c];
  const ref = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== cellData.name) {
      el.textContent = cellData.name;
    }
  }, [cellData.name]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMemberDrop(e: Event) {
      const { name, memberId } = (e as CustomEvent<{ name: string; memberId: string }>).detail;
      setCellName(r, c, name);
      if (ref.current) ref.current.textContent = name;
      removeMember(memberId);
    }
    el.addEventListener("memberdrop", onMemberDrop);
    return () => el.removeEventListener("memberdrop", onMemberDrop);
  }, [r, c, setCellName, removeMember]);

  const style: CSSProperties = {};
  if (cellData.color) {
    style.background = cellData.color;
    style.color = CELL_TEXT_COLOR;
  }

  const editable = mode === "edit" && !rowsMode;

  let className = "cell";
  if (!editable && mode !== "paint") className += " readonly-mode";
  if (mode === "swap" && selected && selected.r === r && selected.c === c) className += " selected";
  if (dragOver) className += " drag-over";

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

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes("application/x-member")) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const name = e.dataTransfer.getData("application/x-member");
    if (!name) return;
    setCellName(r, c, name);
    if (ref.current) ref.current.textContent = name;
    const memberId = e.dataTransfer.getData("application/x-member-id");
    if (memberId) removeMember(memberId);
  }

  return (
    <div
      ref={ref}
      className={className}
      style={style}
      spellCheck={false}
      contentEditable={editable}
      suppressContentEditableWarning
      onInput={editable ? handleInput : undefined}
      onPaste={editable ? handlePaste : undefined}
      onKeyDown={editable ? handleKeyDown : undefined}
      onClick={mode === "swap" || mode === "paint" ? handleClick : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    />
  );
}
