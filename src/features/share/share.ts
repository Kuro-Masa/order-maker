import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseConfig } from "../../constants";
import { buildPatternData } from "../io/json";
import type { Pattern, PatternJson } from "../../types";
import { canonicalFromJson, canonicalFromPattern, merge3, type SyncData } from "./merge";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

// Identifies this tab's writes so their echoes from the listener can be ignored
export const CLIENT_ID = Math.random().toString(36).slice(2);

export function firebaseReady(): boolean {
  if (db) return true;
  if (!firebaseConfig || firebaseConfig.apiKey === "YOUR_API_KEY") return false;
  try {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

function shareDocRef(shareId: string) {
  if (!db) throw new Error("Firestore is not initialized");
  return doc(db, "patterns", shareId);
}

export function buildShareUrl(shareId: string): URL {
  const url = new URL(window.location.href);
  url.searchParams.set("share", shareId);
  url.searchParams.delete("layout");
  return url;
}

export async function pushPatternToFirestore(pattern: Pattern) {
  if (!pattern.shareId) return;
  const data = buildPatternData(pattern);
  await setDoc(shareDocRef(pattern.shareId), { ...data, writerId: CLIENT_ID, updatedAt: serverTimestamp() });
}

// Writes local changes on top of the latest server copy, so edits another member made
// since `base` (the last version this tab synced) are kept instead of overwritten.
export async function pushMergedPatternToFirestore(pattern: Pattern, base: SyncData | null): Promise<SyncData> {
  const ref = shareDocRef(pattern.shareId!);
  const local = canonicalFromPattern(pattern);
  return runTransaction(db!, async (tx) => {
    const snap = await tx.get(ref);
    const merged = snap.exists() && base ? merge3(base, local, canonicalFromJson(snap.data() as PatternJson)) : local;
    tx.set(ref, { ...merged, writerId: CLIENT_ID, updatedAt: serverTimestamp() });
    return merged;
  });
}

export async function fetchPatternFromFirestore(shareId: string): Promise<DocumentData | null> {
  const snap = await getDoc(shareDocRef(shareId));
  if (!snap.exists()) return null;
  return snap.data();
}

export function listenToPattern(
  shareId: string,
  onRemoteUpdate: (data: DocumentData) => void
): Unsubscribe {
  return onSnapshot(
    shareDocRef(shareId),
    (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      onRemoteUpdate(snap.data());
    },
    (e) => console.error(e)
  );
}
