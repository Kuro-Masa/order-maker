import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { firebaseReady, getDb } from "../firebase";

// Background images are stored once, by content hash, outside the layout data, so layouts,
// share sync and edit history only carry a small reference.

const MAX_SIDE = 2000;
// Firestore documents are capped at 1 MiB; leave room for the other fields
const MAX_DATA_URL = 700_000;

export interface LoadedImage {
  id: string;
  dataUrl: string;
  aspect: number;
}

// ---- local cache (IndexedDB) ----

const DB_NAME = "narabi_backgrounds";
const STORE = "images";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheGet(id: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function cachePut(id: string, dataUrl: string) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // private mode etc.: the image just isn't cached
  }
}

// ---- server copy ----

function imageDoc(id: string) {
  return doc(getDb(), "backgrounds", id);
}

const uploaded = new Set<string>();

// Puts the image on the server so other devices and collaborators can see it.
// Only called for layouts that are shared or saved to an account.
export async function ensureImageUploaded(id: string) {
  if (uploaded.has(id) || !firebaseReady()) return;
  const dataUrl = await cacheGet(id);
  if (!dataUrl) return;
  const snap = await getDoc(imageDoc(id));
  if (!snap.exists()) await setDoc(imageDoc(id), { data: dataUrl, createdAt: serverTimestamp() });
  uploaded.add(id);
}

const memory = new Map<string, Promise<string | null>>();

export function loadImage(id: string): Promise<string | null> {
  let p = memory.get(id);
  if (!p) {
    p = (async () => {
      const cached = await cacheGet(id);
      if (cached) return cached;
      if (!firebaseReady()) return null;
      const snap = await getDoc(imageDoc(id));
      const data = snap.exists() ? snap.get("data") : null;
      if (typeof data !== "string") return null;
      uploaded.add(id);
      await cachePut(id, data);
      return data;
    })().catch((e) => {
      console.error(e);
      memory.delete(id); // allow a retry later
      return null;
    });
    memory.set(id, p);
  }
  return p;
}

// ---- file → image ----

async function hashId(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

function encode(source: CanvasImageSource, w: number, h: number): string {
  let scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  for (;;) {
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // PDFs and PNGs may be transparent; JPEG would turn that black
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(source, 0, 0, cw, ch);
    for (const q of [0.8, 0.65, 0.5]) {
      const url = canvas.toDataURL("image/jpeg", q);
      if (url.length <= MAX_DATA_URL) return url;
    }
    scale *= 0.75;
  }
}

async function openPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  return { task, pdf: await task.promise };
}

async function renderPdfPage(file: File, pageNumber: number): Promise<HTMLCanvasElement> {
  const { task, pdf } = await openPdf(file);
  try {
    const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages));
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: MAX_SIDE / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas;
  } finally {
    await task.destroy();
  }
}

export function isPdf(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function pdfPageCount(file: File): Promise<number> {
  const { task, pdf } = await openPdf(file);
  const n = pdf.numPages;
  await task.destroy();
  return n;
}

export async function importBackgroundFile(file: File, pdfPage = 1): Promise<LoadedImage> {
  let dataUrl: string;
  let aspect: number;
  if (isPdf(file)) {
    const canvas = await renderPdfPage(file, pdfPage);
    dataUrl = encode(canvas, canvas.width, canvas.height);
    aspect = canvas.height / canvas.width;
  } else {
    const bitmap = await createImageBitmap(file);
    dataUrl = encode(bitmap, bitmap.width, bitmap.height);
    aspect = bitmap.height / bitmap.width;
    bitmap.close();
  }
  const id = await hashId(dataUrl);
  await cachePut(id, dataUrl);
  memory.set(id, Promise.resolve(dataUrl));
  return { id, dataUrl, aspect };
}
