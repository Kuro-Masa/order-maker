import { createRow } from "../../state/patternHelpers";
import type { Pattern, RowData } from "../../types";
import { downloadBlob, fileBaseName } from "./download";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function exportCsv(pattern: Pattern) {
  const lines = pattern.rows.map((row) =>
    row.cells.map((c) => csvEscape(c.name || "")).join(",")
  );
  const csvContent = lines.join("\r\n");
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, fileBaseName(pattern.name) + ".csv");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim().length > 0));
}

export function rowsFromCsv(text: string): RowData[] {
  const parsedRows = parseCsv(text);
  return parsedRows.map((r) => {
    const row = createRow([r.length]);
    row.cells.forEach((cell, i) => {
      cell.name = (r[i] || "").trim();
    });
    return row;
  });
}
