// src/db/firebase.ts
import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  persistentLocalCache,
  type FirestoreSettings,
} from 'firebase/firestore'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// Configure Firestore with IndexedDB local cache using the new persistentLocalCache API.
// This replaces the deprecated enableIndexedDbPersistence() call.
// persistentLocalCache() enables offline data persistence, allowing the app to work
// offline and sync automatically when the network is available again.
const firestoreSettings = {
  cache: persistentLocalCache(),
} as FirestoreSettings

export const firestore = initializeFirestore(app, firestoreSettings)
export const auth    = getAuth(app)

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(firestore, 'localhost', 8080)
}

// ── User profile stored in Firestore ──────────────────────
// Path: /users/{uid}/profile (separate from data collections)

export interface UserProfile {
  uid: string
  name: string
  email: string
  createdAt: string
}

export async function createUserProfile(user: User, name: string): Promise<void> {
  const profile: UserProfile = {
    uid:       user.uid,
    name,
    email:     user.email ?? '',
    createdAt: new Date().toISOString(),
  }
  await setDoc(doc(firestore, 'users', user.uid, 'meta', 'profile'), profile)
  // Also store in localStorage for fast offline reads
  localStorage.setItem('userProfile', JSON.stringify(profile))
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  // Try localStorage first (fast, works offline)
  const cached = localStorage.getItem('userProfile')
  if (cached) {
    const p = JSON.parse(cached) as UserProfile
    if (p.uid === uid) return p
  }
  // Fall back to Firestore
  try {
    const snap = await getDoc(doc(firestore, 'users', uid, 'meta', 'profile'))
    if (snap.exists()) {
      const p = snap.data() as UserProfile
      localStorage.setItem('userProfile', JSON.stringify(p))
      return p
    }
  } catch {
    // Offline — return null, caller handles gracefully
  }
  return null
}

// ── Auth actions ──────────────────────────────────────────

export async function signUp(name: string, email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  // Set display name on Firebase Auth profile
  await updateProfile(cred.user, { displayName: name })
  // Create Firestore profile document
  await createUserProfile(cred.user, name)
  return cred.user
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  // Refresh cached profile
  await getUserProfile(cred.user.uid)
  return cred.user
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
  localStorage.removeItem('userProfile')
  localStorage.removeItem('activeWorkout')
}

// ── Auth state observer ───────────────────────────────────
// Returns current user synchronously if already signed in,
// or waits for Firebase to restore the session.

export function getCurrentUser(): Promise<User | null> {
  return new Promise(resolve => {
    // onAuthStateChanged fires immediately if session is cached
    const unsub = onAuthStateChanged(auth, user => {
      unsub()
      resolve(user)
    })
  })
}

export { onAuthStateChanged }
