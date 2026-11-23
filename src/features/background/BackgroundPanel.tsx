import { useRef, useState } from "react";
import { useApp } from "../../state/AppStoreContext";
import { importBackgroundFile, isPdf, pdfPageCount } from "./backgroundImage";
import { useBackgroundImage } from "./BackgroundLayer";
import { CurveControl } from "../settings/RowLayoutSettings";

const DEFAULT_WIDTH = 900;

export function BackgroundPanel() {
  const { activePattern, setBackground, updateBackground } = useApp();
  const bg = activePattern.background ?? null;
  const { missing } = useBackgroundImage(bg?.imageId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<{ file: File; pages: number } | null>(null);
  const [page, setPage] = useState(1);

  async function apply(file: File, pdfPage = 1) {
    setBusy(true);
    try {
      const img = await importBackgroundFile(file, pdfPage);
      // Replacing keeps the current placement; a first background starts centered
      const width = bg?.width ?? DEFAULT_WIDTH;
      setBackground({
        imageId: img.id,
        aspect: img.aspect,
        width,
        x: bg?.x ?? -Math.round(width / 2),
        y: bg?.y ?? 0,
        opacity: bg?.opacity ?? 0.5,
      });
      setPdf(null);
    } catch (e) {
      console.error(e);
      alert("ファイルを読み込めませんでした: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (isPdf(file)) {
      setBusy(true);
      let pages = 1;
      try {
        pages = await pdfPageCount(file);
      } catch (e) {
        console.error(e);
        alert("PDFを読み込めませんでした: " + (e as Error).message);
        setBusy(false);
        return;
      }
      setBusy(false);
      if (pages > 1) {
        setPage(1);
        setPdf({ file, pages });
        return;
      }
    }
    await apply(file);
  }

  function handleRemove() {
    if (!confirm("背景を削除しますか？")) return;
    setBackground(null);
  }

  return (
    <div className="panelContent bgPanel">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/*"
        hidden
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {pdf ? (
        <div className="bgPdfPage">
          <p className="panelHint">このPDFは{pdf.pages}ページあります。背景にするページを選んでください。</p>
          <div className="bgPdfPageRow">
            <select value={page} onChange={(e) => setPage(Number(e.target.value))} aria-label="ページ">
              {Array.from({ length: pdf.pages }, (_, i) => (
                <option key={i} value={i + 1}>{i + 1}ページ目</option>
              ))}
            </select>
            <button type="button" className="btn" disabled={busy} onClick={() => apply(pdf.file, page)}>
              {busy ? "読み込み中…" : "このページを使う"}
            </button>
            <button type="button" className="btn" onClick={() => setPdf(null)}>やめる</button>
          </div>
        </div>
      ) : !bg ? (
        <>
          <p className="panelHint">会場図などのPDFや画像を、並びの下に背景として表示できます。</p>
          <button type="button" className="poolImportTrigger" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "読み込み中…" : "＋ PDF・画像を読み込む"}
          </button>
        </>
      ) : (
        <>
          <p className="panelHint">
            {missing
              ? "背景画像をこの端末で読み込めませんでした。追加した端末で共有またはログインすると、ほかの端末でも表示されます。"
              : "グリッドをドラッグすると背景を動かせます。大きさと濃さはスライダーで調整してください。"}
          </p>
          <div className="bgSliderRow">
            <span className="lineTypeLabel">大きさ</span>
            <input
              type="range"
              className="lineAngleSlider"
              aria-label="背景の大きさ"
              min={200}
              max={4000}
              step={10}
              value={bg.width}
              onChange={(e) => {
                // Scale around the image's center so it doesn't drift while resizing
                const width = Number(e.target.value);
                const cx = bg.x + bg.width / 2;
                const cy = bg.y + (bg.width * bg.aspect) / 2;
                updateBackground({
                  width,
                  x: Math.round(cx - width / 2),
                  y: Math.round(cy - (width * bg.aspect) / 2),
                });
              }}
            />
            <span className="bgSliderValue">{bg.width}px</span>
          </div>
          <div className="bgSliderRow">
            <span className="lineTypeLabel">濃さ</span>
            <input
              type="range"
              className="lineAngleSlider"
              aria-label="背景の濃さ"
              min={5}
              max={100}
              step={5}
              value={Math.round(bg.opacity * 100)}
              onChange={(e) => updateBackground({ opacity: Number(e.target.value) / 100 })}
            />
            <span className="bgSliderValue">{Math.round(bg.opacity * 100)}%</span>
          </div>
          <div className="bgCurve">
            <CurveControl />
          </div>
          <div className="bgButtons">
            <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? "読み込み中…" : "差し替え"}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => updateBackground({ x: -Math.round(bg.width / 2), y: 0 })}
            >
              中央に戻す
            </button>
            <button type="button" className="btn danger" onClick={handleRemove}>
              削除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
