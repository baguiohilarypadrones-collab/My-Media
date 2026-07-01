// Firebase client SDK – works in browser & Next.js
// To enable cloud sync:
// 1. Create a Firebase project at https://console.firebase.google.com
// 2. Enable Firestore Database (start in test mode)
// 3. Enable Anonymous Authentication
// 4. Copy your web config into .env.local as NEXT_PUBLIC_FIREBASE_*
// 
// Example .env.local:
// NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
// NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-app
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
// NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc
//
// If env vars are missing, the app gracefully falls back to localStorage.

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged, Auth, User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCruSH9ICuKSnT_sYDqK5wmop68XVfJFmU",
  authDomain: "media-tracker-9c96d.firebaseapp.com",
  projectId: "media-tracker-9c96d",
  storageBucket: "media-tracker-9c96d.firebasestorage.app",
  messagingSenderId: "939264721067",
  appId: "1:939264721067:web:b6178fd243caee4c5bb7ee",
};

let app: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let auth: Auth | null = null;

export const isFirebaseConfigured = true;


try {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestoreDb = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase init failed, falling back to localStorage:", e);
  app = null;
  firestoreDb = null;
  auth = null;
}

export { app, firestoreDb, auth };

// Helper: ensure anonymous sign-in
export async function ensureAnonAuth(): Promise<User | null> {
  if (!auth || !isFirebaseConfigured) return null;
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    console.warn("Anonymous auth failed:", e);
    return null;
  }
}

// Helper: wait for auth state
export function waitForAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    if (!auth || !isFirebaseConfigured) {
      resolve(null);
      return;
    }
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
    // timeout fallback to localStorage after 2.5s
    setTimeout(() => {
      unsub();
      resolve(auth?.currentUser ?? null);
    }, 2500);
  });
}
