// src/main.tsx
// Auth is now handled inside AuthContext + AuthPage.
// main.tsx only initializes theme and mounts the app.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initializeTheme } from './utils'

initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)