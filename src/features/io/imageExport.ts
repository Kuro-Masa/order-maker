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
import { cellCenterOffsets, curveExtraDrop, curvePoint, curveRadii, riserHalfAngles, RISER_BAND_HALF } from "../../state/curve";

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
  if (text.includes("\n")) return text.split("\n");
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

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxWidth: number, maxHeight: number) {
  if (!text) return;
  ctx.fillStyle = CELL_TEXT_COLOR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 13;
  let lines = splitIntoLines(ctx, text, maxWidth, fontSize);

  // Shrink only if even 2-line split overflows
  while (fontSize > 8) {
    ctx.font = fontSize + "px sans-serif";
    const fits = lines.length * fontSize * 1.3 <= maxHeight && lines.every((l) => ctx.measureText(l).width <= maxWidth);
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
  const padding = 24;
  const titleH = 40;
  const markH = 44;
  const markGapY = 14;
  const withConductor = showsConductor(pattern);

  const rowWidths = pattern.rows.map(rowContentWidthPx);
  const maxRowWidth = maxRowWidthPx(pattern);

  // Compute row positions (needed for riserCenter too)
  let minLeft = Infinity;
  let maxRight = -Infinity;
  pattern.rows.forEach((_row, r) => {
    const rowBaseX = padding + (maxRowWidth - rowWidths[r]) / 2 + rowShiftPx(pattern.rows[r]);
    minLeft = Math.min(minLeft, rowBaseX);
    maxRight = Math.max(maxRight, rowBaseX + rowWidths[r]);
  });
  if (!isFinite(minLeft)) { minLeft = padding; maxRight = padding + maxRowWidth; }

  const riserCenter = (minLeft + maxRight) / 2;
  let drawnMinX = minLeft - RISER_PAD;
  let drawnMaxX = maxRight + RISER_PAD;

  // Custom riserWidth rows can extend beyond the auto span
  pattern.rows.forEach((row) => {
    if (!rowOnRiser(row) || row.riserWidth === undefined) return;
    const rW = row.riserWidth * (CELL_W + GAP_X) - GAP_X + RISER_PAD * 2;
    drawnMinX = Math.min(drawnMinX, riserCenter - rW / 2);
    drawnMaxX = Math.max(drawnMaxX, riserCenter + rW / 2);
  });

  // Lines (縦線) are drawn at linesCenter + line.pos
  const linesLastRowForBounds = pattern.rows[pattern.rows.length - 1];
  const linesCenterForBounds = padding + maxRowWidth / 2 + (linesLastRowForBounds ? rowShiftPx(linesLastRowForBounds) : 0);
  const linesLengthForBounds = pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY;
  (pattern.lines || []).forEach((line) => {
    const x = linesCenterForBounds + line.pos;
    const topX = x + linesLengthForBounds * Math.sin(((line.angle ?? 0) * Math.PI) / 180);
    drawnMinX = Math.min(drawnMinX, x - 1, topX - 1);
    drawnMaxX = Math.max(drawnMaxX, x + 1, topX + 1);
  });

  // Also check conductor/marker bounds
  const boundsMarkers = pattern.specialMarkers ?? [];
  const frontRowMarkersForBounds = withConductor
    ? [...boundsMarkers.filter((m) => m.side === "left"), { id: "_conductor", label: "指揮", side: "left" as const, isConductor: true }, ...boundsMarkers.filter((m) => m.side === "right")]
    : boundsMarkers;
  if (frontRowMarkersForBounds.length > 0) {
    const lastRow = pattern.rows[pattern.rows.length - 1];
    const centerX = padding + maxRowWidth / 2 + (lastRow ? rowShiftPx(lastRow) : 0);
    const totalMarkW = frontRowMarkersForBounds.length * markH + (frontRowMarkersForBounds.length - 1) * 10;
    drawnMinX = Math.min(drawnMinX, centerX - totalMarkW / 2 - 2);
    drawnMaxX = Math.max(drawnMaxX, centerX + totalMarkW / 2 + 2);
  }

  // Curved rows: risers become arc bands around a common center
  const radii = curveRadii(pattern);
  const riserAngles = radii ? riserHalfAngles(pattern, radii) : null;
  const extraDrop = curveExtraDrop(pattern);
  const axisX = padding + maxRowWidth / 2;
  const rowCy = (r: number) => padding + titleH + r * (cellH + gapY) + cellH / 2;
  if (radii && riserAngles) {
    pattern.rows.forEach((row, r) => {
      if (!rowOnRiser(row)) return;
      const outer = radii[r] + RISER_BAND_HALF;
      const reach = riserAngles[r] >= Math.PI / 2 ? outer : outer * Math.sin(riserAngles[r]);
      drawnMinX = Math.min(drawnMinX, axisX - reach);
      drawnMaxX = Math.max(drawnMaxX, axisX + reach);
    });
  }

  // If content bleeds left of padding, shift all drawing right by xOffset
  const xOffset = Math.max(0, padding - drawnMinX);
  const dpr = 2;
  const logicalW = drawnMaxX + xOffset + padding;
  const logicalH =
    padding * 2 + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY +
    (withConductor ? markGapY + markH : 0) + extraDrop;

  const canvas = document.createElement("canvas");
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  // Fill background before translate so the entire canvas is covered
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, logicalW, logicalH);

  if (xOffset > 0) ctx.translate(xOffset, 0);

  ctx.fillStyle = CELL_TEXT_COLOR;
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(pattern.name || "並び順", padding, padding);

  // Draw each riser row individually to match the grid view (supports custom riserWidth per row)
  pattern.rows.forEach((row, r) => {
    if (!rowOnRiser(row)) return;
    if (radii && riserAngles) {
      const R = radii[r];
      const cy = rowCy(r) + R;
      const half = riserAngles[r];
      const inner = Math.max(1, R - RISER_BAND_HALF);
      const outer = R + RISER_BAND_HALF;
      // canvas angles start at +x; "up" is -PI/2
      ctx.beginPath();
      ctx.arc(axisX, cy, outer, -Math.PI / 2 - half, -Math.PI / 2 + half);
      ctx.arc(axisX, cy, inner, -Math.PI / 2 + half, -Math.PI / 2 - half, true);
      ctx.closePath();
      ctx.fillStyle = RISER_COLOR;
      ctx.strokeStyle = RISER_BORDER;
      ctx.lineWidth = 1;
      ctx.lineJoin = "round";
      ctx.fill();
      ctx.stroke();
      return;
    }
    const rTop = padding + titleH + r * (cellH + gapY) - RISER_PAD;
    const rBottom = padding + titleH + r * (cellH + gapY) + cellH + RISER_PAD;
    let rLeft = minLeft - RISER_PAD;
    let rW = maxRight - minLeft + RISER_PAD * 2;
    if (row.riserWidth !== undefined) {
      rW = row.riserWidth * (CELL_W + GAP_X) - GAP_X + RISER_PAD * 2;
      rLeft = riserCenter - rW / 2;
    }
    ctx.fillStyle = RISER_COLOR;
    ctx.strokeStyle = RISER_BORDER;
    ctx.lineWidth = 1;
    roundRect(ctx, rLeft, rTop, rW, rBottom - rTop, 8);
    ctx.fill();
    ctx.stroke();
  });

  pattern.rows.forEach((row, r) => {
    if (!radii) return;
    const R = radii[r];
    cellCenterOffsets(row).forEach((sx, i) => {
      const cellData = row.cells[i];
      const { dx, dy, angle } = curvePoint(sx, R);
      ctx.save();
      ctx.translate(axisX + sx + dx, rowCy(r) + dy);
      ctx.rotate(angle);
      ctx.fillStyle = cellData.color || "#ffffff";
      ctx.strokeStyle = "#333844";
      ctx.lineWidth = 2;
      roundRect(ctx, -cellW / 2, -cellH / 2, cellW, cellH, 10);
      ctx.fill();
      ctx.stroke();
      drawFittedText(ctx, cellData.name || "", 0, 0, cellW - 8, cellH - 4);
      ctx.restore();
    });
  });

  pattern.rows.forEach((row, r) => {
    if (radii) return;
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

        drawFittedText(ctx, cellData.name || "", x + cellW / 2, y + cellH / 2, cellW - 8, cellH - 4);

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
    // Tilted lines pivot on their front (bottom) end
    const x = linesCenter + line.pos;
    const rad = ((line.angle ?? 0) * Math.PI) / 180;
    const len = linesBottom - linesTop;
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + len * Math.sin(rad), linesBottom - len * Math.cos(rad));
    ctx.lineTo(x, linesBottom);
    ctx.stroke();
  });

  const specialMarkers = pattern.specialMarkers ?? [];
  const frontRowMarkers = withConductor
    ? [
        ...specialMarkers.filter((m) => m.side === "left"),
        { id: "_conductor", label: "指揮", side: "left" as const, isConductor: true },
        ...specialMarkers.filter((m) => m.side === "right"),
      ]
    : specialMarkers;

  if (frontRowMarkers.length > 0) {
    const markY =
      padding + titleH + pattern.rows.length * cellH + Math.max(0, pattern.rows.length - 1) * gapY + markGapY + extraDrop;
    const lastRow = pattern.rows[pattern.rows.length - 1];
    const centerX = padding + maxRowWidth / 2 + (lastRow ? rowShiftPx(lastRow) : 0);
    const markCy = markY + markH / 2;
    const markSpacing = markH + 10;
    const totalW = frontRowMarkers.length * markH + (frontRowMarkers.length - 1) * 10;
    const startX = centerX - totalW / 2 + markH / 2;

    frontRowMarkers.forEach((m, i) => {
      const isConductor = "isConductor" in m && m.isConductor;
      const cx = startX + i * markSpacing;
      if (isConductor) {
        ctx.fillStyle = CELL_TEXT_COLOR;
        ctx.beginPath();
        ctx.arc(cx, markCy, markH / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = CELL_TEXT_COLOR;
        ctx.lineWidth = 2;
        roundRect(ctx, cx - markH / 2, markY, markH, markH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = CELL_TEXT_COLOR;
      }
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(m.label, cx, markCy);
    });
  }

  canvas.toBlob((blob) => {
    if (!blob) {
      alert("画像の生成に失敗しました");
      return;
    }
    downloadBlob(blob, fileBaseName(pattern.name) + ".png");
  }, "image/png");
}
