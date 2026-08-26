import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { firebaseConfig } from "../../constants";
import { buildPatternData } from "../io/json";
import type { Pattern } from "../../types";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

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
  await setDoc(shareDocRef(pattern.shareId), { ...data, updatedAt: serverTimestamp() });
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
