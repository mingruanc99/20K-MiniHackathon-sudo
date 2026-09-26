// src/lib/firebase.ts
/**
 * Firebase Client Initialization with Hybrid Cloud/Local Fallback
 * Allows production Firebase Auth/Firestore while ensuring zero-breakage in local demo mode.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';

const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || 'AIzaSyDemoKeyMockForLocalDevOnly',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || 'clsg-ir-demo.firebaseapp.com',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || 'clsg-ir-demo',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || 'clsg-ir-demo.appspot.com',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '1234567890',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '1:1234567890:web:abcdef123456'
};

const envApiKey = getEnvVar('VITE_FIREBASE_API_KEY');
const envProjId = getEnvVar('VITE_FIREBASE_PROJECT_ID');

export const isFirebaseConfigured = Boolean(
  envApiKey &&
  envProjId &&
  !envApiKey.includes('Demo')
);

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
};
export type { FirebaseUser };
