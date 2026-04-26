// src/db/firebase.ts
// Replace the config values with your own from:
// Firebase Console → Project Settings → Your apps → SDK setup

import { initializeApp } from 'firebase/app'
import {
  getFirestore,
  enableIndexedDbPersistence,
  connectFirestoreEmulator,
} from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app  = initializeApp(firebaseConfig)
export const firestore = getFirestore(app)
export const auth      = getAuth(app)

// Enable Firestore's own offline cache as a secondary safety net.
// Our Dexie layer is the primary read source.
enableIndexedDbPersistence(firestore).catch(err => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open — offline persistence works in one tab only
    console.warn('[Firebase] Offline persistence disabled (multiple tabs)')
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] This browser does not support offline persistence')
  }
})

// Use emulator in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(firestore, 'localhost', 8080)
}

/**
 * Sign the user in anonymously on first visit.
 * Returns a stable uid stored by Firebase in localStorage.
 * Later you can replace this with Google/email auth.
 */
export async function ensureAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub()
      if (user) {
        resolve(user.uid)
      } else {
        try {
          const cred = await signInAnonymously(auth)
          resolve(cred.user.uid)
        } catch (e) {
          reject(e)
        }
      }
    })
  })
}
