import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

export interface CustomFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

// Check for custom config in localStorage
export function getStoredFirebaseConfig(): CustomFirebaseConfig | null {
  try {
    const raw = localStorage.getItem('custom_firebase_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.projectId && parsed.apiKey) {
        return parsed;
      }
    }
  } catch (_) {}
  return null;
}

export async function saveCustomFirebaseConfig(config: CustomFirebaseConfig): Promise<void> {
  try {
    // 1. Immediately terminate and disconnect from old project auth
    try {
      await auth.signOut();
    } catch (_) {}

    // 2. Clear old session tokens and caches
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('firebase:') || k.includes('authUser') || k === 'app_device_session_token' || k.startsWith('cached_exams_'))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 3. Clear IndexedDB caches from old project if supported
    if (typeof window !== 'undefined' && window.indexedDB && typeof window.indexedDB.databases === 'function') {
      try {
        const dbs = await window.indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name && (dbInfo.name.includes('firebase') || dbInfo.name.includes('firestore'))) {
            window.indexedDB.deleteDatabase(dbInfo.name);
          }
        }
      } catch (_) {}
    }

    // 4. Save new project config
    localStorage.setItem('custom_firebase_config', JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save custom firebase config to localStorage:', e);
  }
}

export async function clearCustomFirebaseConfig(): Promise<void> {
  try {
    try {
      await auth.signOut();
    } catch (_) {}

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('firebase:') || k.includes('authUser') || k === 'app_device_session_token')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    if (typeof window !== 'undefined' && window.indexedDB && typeof window.indexedDB.databases === 'function') {
      try {
        const dbs = await window.indexedDB.databases();
        for (const dbInfo of dbs) {
          if (dbInfo.name && (dbInfo.name.includes('firebase') || dbInfo.name.includes('firestore'))) {
            window.indexedDB.deleteDatabase(dbInfo.name);
          }
        }
      } catch (_) {}
    }

    localStorage.removeItem('custom_firebase_config');
  } catch (e) {
    console.error('Failed to clear custom firebase config:', e);
  }
}

const customConfig = getStoredFirebaseConfig();
export const effectiveFirebaseConfig = customConfig 
  ? { ...defaultFirebaseConfig, ...customConfig } 
  : defaultFirebaseConfig;

const app = getApps().length === 0 ? initializeApp(effectiveFirebaseConfig) : getApp();
export const db = getFirestore(app, effectiveFirebaseConfig.firestoreDatabaseId || (defaultFirebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

