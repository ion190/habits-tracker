// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ensureAuth } from './db/firebase'
import { sync } from './db/sync'

async function bootstrap() {
  try {
    // Sign in anonymously (or reuse existing session) then init sync
    const uid = await ensureAuth()
    sync.init(uid)
  } catch (e) {
    // If Firebase is unreachable (offline on first ever load),
    // still mount the app — it will work offline via Dexie
    console.warn('[Bootstrap] Firebase auth failed, running offline:', e)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

bootstrap()