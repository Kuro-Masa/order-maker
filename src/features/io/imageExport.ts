import {
  CELL_H,
  CELL_TEXT_COLOR,
  CELL_W,
  CENTER_LINE_COLOR,
  GAP_X,
  GAP_Y,
  LINE_COLOR,
  RISER_BORDER,
  RISER_COLOR,
  RISER_PAD,
} from "../../constants";
import { getGapPx, maxRowWidthPx, rowContentWidthPx, rowOnRiser, rowShiftPx, showsCenterLine, showsConductor } from "../../state/patternHelpers";
import type { Pattern } from "../../types";
import { downloadBlob, fileBaseName } from "./download";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function splitIntoLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
  ctx.font = fontSize + "px sans-serif";
  if (ctx.measureText(text).width <= maxWidth) return [text];
  // Try splitting at every possible position to find the best 2-line split
  let bestSplit = Math.ceil(text.length / 2);
  let bestDiff = Infinity;
  for (let i = 1; i < text.length; i++) {
    const w1 = ctx.measureText(text.slice(0, i)).width;
    const w2 = ctx.measureText(text.slice(i)).width;
    const diff = Math.abs(w1 - w2);
    if (diff < bestDiff && w1 <= maxWidth && w2 <= maxWidth) {
      bestDiff = diff;
      bestSplit = i;
    }
  }
  return [text.slice(0, bestSplit), text.slice(bestSplit)];
}

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number) {
  if (!text) return;
  ctx.fillStyle = CELL_TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 13;
  let lines = splitIntoLines(ctx, text, maxWidth, fontSize);

  // Shrink only if even 2-line split overflows
  while (fontSize > 8) {
    const fits = lines.every((l) => {
      ctx.font = fontSize + "px sans-serif";
      return ctx.measureText(l).width <= maxWidth;
    });
    if (fits) break;
    fontSize -= 1;
    lines = splitIntoLines(ctx, text, maxWidth, fontSize);
  }

  ctx.font = fontSize + "px sans-serif";
  const lineH = fontSize * 1.3;
  const totalH = lines.length * lineH;
  const startY = cy - totalH / 2 + lineH / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, startY + i * lineH);
  });
}

export function exportImage(pattern: Pattern) {
  const cellW = CELL_W;
  const cellH = CELL_H;
  const gapX = GAP_X;
  const gapY = GAP_Y;
  const offsetShift = CELL_W / 2;
  const padding = 24;
  const titleH = 40;
  const markH = 44;
  const markGapY = 14;
  const withConductor = showsConductor(pattern);

  const rowWidths = pattern.rows.map(rowContentWidthPx);
  const maxRowWidth = maxRowWidthPx(pattern);

  const dpr = 2;
  const logicalW = padding * 2 + maxRowWidth + offsetShift + RISER_PAD;
  const logicalH =
    padding * 2 + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY +
    (withConductor ? markGapY + markH : 0);

  const canvas = document.createElement("canvas");
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.fillStyle = CELL_TEXT_COLOR;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(pattern.name || "並び順", padding, padding);

  // Every riser shares one common span wide enough to contain every row
  // (including staggered ones), so all platforms line up and match width.
  let minLeft = Infinity;
  let maxRight = -Infinity;
  pattern.rows.forEach((_row, r) => {
    const rowBaseX = padding + (maxRowWidth - rowWidths[r]) / 2 + rowShiftPx(pattern.rows[r]);
    minLeft = Math.min(minLeft, rowBaseX);
    maxRight = Math.max(maxRight, rowBaseX + rowWidths[r]);
  });
  const riserLeft = minLeft - RISER_PAD;
  const riserWidth = maxRight - minLeft + RISER_PAD * 2;
  let ri = 0;
  while (ri < pattern.rows.length) {
    if (!rowOnRiser(pattern.rows[ri])) {
      ri++;
      continue;
    }
    const riStart = ri;
    while (ri < pattern.rows.length && rowOnRiser(pattern.rows[ri])) ri++;
    const riEnd = ri - 1;
    const riTop = padding + titleH + riStart * (cellH + gapY) - RISER_PAD;
    const riBottom = padding + titleH + riEnd * (cellH + gapY) + cellH + RISER_PAD;

    ctx.fillStyle = RISER_COLOR;
    ctx.strokeStyle = RISER_BORDER;
    ctx.lineWidth = 1;
    roundRect(ctx, riserLeft, riTop, riserWidth, riBottom - riTop, 8);
    ctx.fill();
    ctx.stroke();
  }

  pattern.rows.forEach((row, r) => {
    const y = padding + titleH + r * (cellH + gapY);
    const baseX = padding + (maxRowWidth - rowWidths[r]) / 2 + rowShiftPx(pattern.rows[r]);
    let x = baseX;

    let cellIdx = 0;
    row.segments.forEach((segLen, segIdx) => {
      if (segIdx > 0) x += getGapPx(row, segIdx - 1);
      for (let i = 0; i < segLen; i++) {
        const cellData = row.cells[cellIdx];
        ctx.fillStyle = cellData.color || "#ffffff";
        ctx.strokeStyle = "#333844";
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, cellW, cellH, 10);
        ctx.fill();
        ctx.stroke();

        drawFittedText(ctx, cellData.name || "", x + cellW / 2, y + cellH / 2, cellW - 8);

        x += cellW + gapX;
        cellIdx++;
      }
    });
  });

  const linesTop = padding + titleH;
  const linesBottom =
    padding + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY;
  // Align to the same center the conductor mark uses (row 0's unshifted
  // center, shifted to match the last row's parity), not the riser
  // background's full-extent span, so the two visually coincide.
  const linesLastRow = pattern.rows[pattern.rows.length - 1];
  const linesCenter = padding + maxRowWidth / 2 + (linesLastRow ? rowShiftPx(linesLastRow) : 0);

  if (showsCenterLine(pattern)) {
    ctx.strokeStyle = CENTER_LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(linesCenter, linesTop);
    ctx.lineTo(linesCenter, linesBottom);
    ctx.stroke();
  }

  (pattern.lines || []).forEach((line) => {
    const x = linesCenter + line.pos;
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, linesTop);
    ctx.lineTo(x, linesBottom);
    ctx.stroke();
  });

  if (withConductor) {
    const markY =
      padding + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY + markGapY;
    const lastRow = pattern.rows[pattern.rows.length - 1];
    const markCx = padding + maxRowWidth / 2 + (lastRow ? rowShiftPx(lastRow) : 0);
    const markCy = markY + markH / 2;
    ctx.fillStyle = CELL_TEXT_COLOR;
    ctx.beginPath();
    ctx.arc(markCx, markCy, markH / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("指揮", markCx, markCy);
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("画像の生成に失敗しました");
      return;
    }
    downloadBlob(blob, fileBaseName(pattern.name) + ".png");
  }, "image/png");
}
