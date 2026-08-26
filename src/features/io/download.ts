export function downloadBlob(blob: Blob, filename: string) {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (nav.canShare && typeof File !== "undefined") {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (nav.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(() => {});
        return;
      }
    } catch {
      // fall through to anchor download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function dateStampShort(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return String(d.getFullYear() % 100).padStart(2, "0") + pad(d.getMonth() + 1) + pad(d.getDate());
}

export function fileBaseName(name: string): string {
  let safe = String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .slice(0, 40);
  if (!safe) safe = "パターン";
  return safe + "_" + dateStampShort();
}
