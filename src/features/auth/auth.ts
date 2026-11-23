import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "../firebase";

export interface AppUser {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
}

// Who is recorded as the editor of shared patterns and history entries
export interface Editor {
  uid: string | null;
  name: string;
}

let current: AppUser | null = null;

export function currentEditor(): Editor {
  return current ? { uid: current.uid, name: current.name } : { uid: null, name: "ゲスト" };
}

function toAppUser(u: User): AppUser {
  return {
    uid: u.uid,
    name: u.displayName || u.email || "ユーザー",
    email: u.email,
    photoURL: u.photoURL,
  };
}

export function watchAuth(cb: (user: AppUser | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (u) => {
    current = u ? toAppUser(u) : null;
    cb(current);
  });
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("ログイン機能が設定されていません");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Popups don't work in some in-app browsers and home-screen apps: fall back to a full-page redirect
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(auth, provider);
      return;
    }
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    throw e;
  }
}

export async function signOutUser() {
  const auth = getFirebaseAuth();
  if (auth) await fbSignOut(auth);
}
