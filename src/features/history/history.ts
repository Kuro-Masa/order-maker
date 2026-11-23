import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type CollectionReference,
} from "firebase/firestore";
import { getDb } from "../firebase";
import { currentEditor, type Editor } from "../auth/auth";
import { canonicalFromPattern, type SyncData } from "../share/merge";
import type { Pattern } from "../../types";

export interface HistoryEntry {
  id: string;
  editor: Editor;
  data: SyncData;
  startedAt: number;
  endedAt: number;
}

// Edits by the same tab within this window are folded into one history entry
const SESSION_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;

// Shared layouts keep their history next to the shared document so every collaborator sees it;
// private layouts keep it in the owner's account.
export function historyCol(pattern: Pattern, uid: string | null): CollectionReference | null {
  if (pattern.shareId) return collection(getDb(), "patterns", pattern.shareId, "history");
  if (uid) return collection(getDb(), "users", uid, "layouts", pattern.id, "history");
  return null;
}

const sessions = new Map<string, { id: string; startedAt: number; uid: string | null }>();

export async function recordHistory(pattern: Pattern, uid: string | null) {
  const col = historyCol(pattern, uid);
  if (!col) return;
  const editor = currentEditor();
  const key = col.path;
  const now = Date.now();
  let session = sessions.get(key);
  if (!session || session.uid !== editor.uid || now - session.startedAt > SESSION_MS) {
    session = { id: doc(col).id, startedAt: now, uid: editor.uid };
    sessions.set(key, session);
  }
  await setDoc(doc(col, session.id), {
    uid: editor.uid,
    name: editor.name,
    data: canonicalFromPattern(pattern),
    startedAt: session.startedAt,
    endedAt: now,
    at: serverTimestamp(),
  });
}

export async function fetchHistory(pattern: Pattern, uid: string | null): Promise<HistoryEntry[]> {
  const col = historyCol(pattern, uid);
  if (!col) return [];
  const snap = await getDocs(query(col, orderBy("endedAt", "desc"), limit(MAX_ENTRIES)));
  return snap.docs.map((d) => {
    const v = d.data();
    return {
      id: d.id,
      editor: { uid: v.uid ?? null, name: v.name || "ゲスト" },
      data: v.data,
      startedAt: v.startedAt ?? v.endedAt,
      endedAt: v.endedAt,
    };
  });
}
