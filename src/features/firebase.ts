import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "../constants";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

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

export function getDb(): Firestore {
  if (!firebaseReady() || !db) throw new Error("Firestore is not initialized");
  return db;
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  if (!firebaseReady() || !app) return null;
  auth = getAuth(app);
  return auth;
}
