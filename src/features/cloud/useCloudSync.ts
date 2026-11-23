import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { getDb } from "../firebase";
import type { AppUser } from "../auth/auth";
import type { AppState, Pattern } from "../../types";
import { createDefaultPattern } from "../../state/patternHelpers";
import { STORAGE_KEY } from "../../constants";

// Which account the layouts in localStorage belong to, so another account never merges them in
const SYNCED_UID_KEY = STORAGE_KEY + "_cloud_uid";

function loadSyncedUid(): string | null {
  try {
    return localStorage.getItem(SYNCED_UID_KEY);
  } catch {
    return null;
  }
}

function saveSyncedUid(uid: string | null) {
  try {
    if (uid) localStorage.setItem(SYNCED_UID_KEY, uid);
    else localStorage.removeItem(SYNCED_UID_KEY);
  } catch {
    // ignore
  }
}

function layoutsCol(uid: string) {
  return collection(getDb(), "users", uid, "layouts");
}

function layoutDoc(uid: string, patternId: string) {
  return doc(getDb(), "users", uid, "layouts", patternId);
}

// An untouched starter layout: not worth uploading next to a real cloud library
function isPristine(p: Pattern): boolean {
  return (
    !p.shareId &&
    (p.lines ?? []).length === 0 &&
    (p.members ?? []).length === 0 &&
    p.rows.every((r) => r.cells.every((c) => !c.name && !c.color))
  );
}

export type CloudStatus = "off" | "loading" | "synced" | "error";

// Keeps the signed-in user's layouts in Firestore (users/{uid}/layouts/{patternId}) in step
// with local state, across devices. Newer `updatedAt` wins per layout.
export function useCloudSync(
  user: AppUser | null,
  state: AppState,
  setState: Dispatch<SetStateAction<AppState>>
) {
  const [status, setStatus] = useState<CloudStatus>("off");
  const uidRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  // JSON of each layout as last written to / read from the cloud, to skip echoes and no-op writes
  const cloudJsonRef = useRef(new Map<string, string>());
  const prevIdsRef = useRef<Set<string> | null>(null);
  const timersRef = useRef(new Map<string, number>());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const uid = user?.uid ?? null;
    uidRef.current = uid;
    readyRef.current = false;
    cloudJsonRef.current = new Map();
    prevIdsRef.current = null;
    if (!uid) {
      setStatus("off");
      return;
    }
    setStatus("loading");
    let first = true;

    const unsub = onSnapshot(
      layoutsCol(uid),
      (snap) => {
        if (uidRef.current !== uid) return;
        const cloud = cloudJsonRef.current;

        if (first) {
          first = false;
          const remote = new Map<string, Pattern>();
          snap.forEach((d) => {
            const json = d.get("json");
            if (typeof json !== "string") return;
            try {
              remote.set(d.id, JSON.parse(json));
              cloud.set(d.id, json);
            } catch {
              // skip broken entry
            }
          });
          const sameAccount = loadSyncedUid() === uid;
          const otherAccount = loadSyncedUid() !== null && !sameAccount;
          saveSyncedUid(uid);
          setState((prev) => {
            // Layouts on this device that belong to a different account stay out of this one
            let local = otherAccount ? [] : prev.patterns;
            if (remote.size > 0 && !sameAccount) local = local.filter((p) => !isPristine(p));
            const byId = new Map<string, Pattern>();
            for (const p of remote.values()) byId.set(p.id, p);
            for (const p of local) {
              const r = byId.get(p.id);
              if (!r || (p.updatedAt ?? 0) > (r.updatedAt ?? 0)) byId.set(p.id, p);
            }
            // Keep the local order first, then cloud-only layouts
            const order = [...local.map((p) => p.id), ...[...remote.keys()].filter((id) => !local.some((p) => p.id === id))];
            let patterns = order.map((id) => byId.get(id)!).filter(Boolean);
            if (patterns.length === 0) patterns = [createDefaultPattern("パターン1")];
            const activeId = patterns.some((p) => p.id === prev.activeId) ? prev.activeId : patterns[0].id;
            return { ...prev, patterns, activeId, members: otherAccount ? [] : prev.members };
          });
          readyRef.current = true;
          setStatus("synced");
          return;
        }

        if (snap.metadata.hasPendingWrites) return;
        const upserts: Pattern[] = [];
        const removed: string[] = [];
        for (const ch of snap.docChanges()) {
          if (ch.type === "removed") {
            cloud.delete(ch.doc.id);
            removed.push(ch.doc.id);
            continue;
          }
          const json = ch.doc.get("json");
          if (typeof json !== "string" || cloud.get(ch.doc.id) === json) continue;
          try {
            const p: Pattern = JSON.parse(json);
            cloud.set(ch.doc.id, json);
            upserts.push(p);
          } catch {
            // skip
          }
        }
        if (upserts.length === 0 && removed.length === 0) return;
        setState((prev) => {
          let patterns = prev.patterns.filter((p) => !removed.includes(p.id));
          for (const r of upserts) {
            const i = patterns.findIndex((p) => p.id === r.id);
            if (i < 0) patterns = [...patterns, r];
            else if ((r.updatedAt ?? 0) >= (patterns[i].updatedAt ?? 0)) {
              patterns = patterns.slice();
              patterns[i] = r;
            }
          }
          if (patterns.length === 0) patterns = [createDefaultPattern("パターン1")];
          const activeId = patterns.some((p) => p.id === prev.activeId) ? prev.activeId : patterns[0].id;
          return { ...prev, patterns, activeId };
        });
        setStatus("synced");
      },
      (e) => {
        console.error(e);
        setStatus("error");
      }
    );

    return () => {
      unsub();
      for (const t of timersRef.current.values()) window.clearTimeout(t);
      timersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  function writeLayout(uid: string, patternId: string) {
    if (uidRef.current !== uid) return;
    const latest = stateRef.current.patterns.find((q) => q.id === patternId);
    if (!latest) return;
    const json = JSON.stringify(latest);
    if (cloudJsonRef.current.get(patternId) === json) return;
    cloudJsonRef.current.set(patternId, json);
    setDoc(layoutDoc(uid, patternId), { json, name: latest.name, updatedAt: latest.updatedAt ?? Date.now() })
      .then(() => setStatus("synced"))
      .catch((e) => {
        console.error(e);
        cloudJsonRef.current.delete(patternId);
        setStatus("error");
      });
  }

  // Upload changed layouts and delete removed ones
  useEffect(() => {
    const uid = uidRef.current;
    const ids = new Set(state.patterns.map((p) => p.id));
    const prevIds = prevIdsRef.current;
    prevIdsRef.current = ids;
    if (!uid || !readyRef.current) return;

    for (const p of state.patterns) {
      const json = JSON.stringify(p);
      if (cloudJsonRef.current.get(p.id) === json) continue;
      const timers = timersRef.current;
      const pending = timers.get(p.id);
      if (pending) window.clearTimeout(pending);
      timers.set(
        p.id,
        window.setTimeout(() => {
          timers.delete(p.id);
          writeLayout(uid, p.id);
        }, 1000)
      );
    }

    if (prevIds) {
      for (const id of prevIds) {
        if (ids.has(id) || !cloudJsonRef.current.has(id)) continue;
        cloudJsonRef.current.delete(id);
        deleteDoc(layoutDoc(uid, id)).catch((e) => console.error(e));
      }
    }
  }, [state.patterns]);

  // Stop syncing before local data is cleared on sign-out, so the clear isn't mirrored as deletes
  function detach() {
    const uid = uidRef.current;
    for (const [id, t] of timersRef.current) {
      window.clearTimeout(t);
      if (uid) writeLayout(uid, id); // send edits still waiting in the debounce
    }
    timersRef.current.clear();
    uidRef.current = null;
    readyRef.current = false;
    saveSyncedUid(null);
  }

  return { cloudStatus: status, detachCloud: detach };
}
