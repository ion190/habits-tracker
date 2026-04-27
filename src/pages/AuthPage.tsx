// src/pages/AuthPage.tsx
import { useState } from 'react'
import { signIn, signUp } from '../db/firebase'
import { sync } from '../db/sync'

type Mode = 'login' | 'signup'

export default function AuthPage() {
  const [mode,     setMode]     = useState<Mode>('login')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!name.trim()) { setError('Please enter your name.'); setLoading(false); return }
        const user = await signUp(name.trim(), email, password)
        sync.init(user.uid)
      } else {
        const user = await signIn(email, password)
        sync.init(user.uid)
        // Hydrate local Dexie from Firestore after login
        await sync.hydrate()
      }
    } catch (err: unknown) {
      const msg = (err as { code?: string; message?: string }).code
      setError(friendlyError(msg ?? ''))
    } finally {
      setLoading(false)
    }
  }

  function friendlyError(code: string): string {
    switch (code) {
      case 'auth/email-already-in-use':   return 'An account with this email already exists.'
      case 'auth/invalid-email':           return 'Please enter a valid email address.'
      case 'auth/weak-password':           return 'Password must be at least 6 characters.'
      case 'auth/user-not-found':          return 'No account found with this email.'
      case 'auth/wrong-password':          return 'Incorrect password.'
      case 'auth/invalid-credential':      return 'Incorrect email or password.'
      case 'auth/too-many-requests':       return 'Too many attempts. Please try again later.'
      case 'auth/network-request-failed':  return 'Network error — check your connection.'
      default: return 'Something went wrong. Please try again.'
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 40 40">
            <rect width="40" height="40" rx="12" fill="var(--accent)" />
            <path d="M12 20h16M20 12v16" stroke="white" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="auth-logo-name">Journal</span>
        </div>

        <h1 className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        <p className="auth-sub">
          {mode === 'login'
            ? 'Sign in to sync your habits and workouts across devices.'
            : 'Start tracking your habits, tasks and workouts.'}
        </p>

        {error && <div className="banner err" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} className="form-stack">
          {mode === 'signup' && (
            <label className="form-label">
              Name
              <input
                className="field"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                autoFocus={mode === 'signup'}
                required
              />
            </label>
          )}

          <label className="form-label">
            Email
            <input
              className="field"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus={mode === 'login'}
              required
            />
          </label>

          <label className="form-label">
            Password
            <input
              className="field"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 6 characters' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>

          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button className="auth-link" onClick={() => { setMode('signup'); setError(null) }}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button className="auth-link" onClick={() => { setMode('login'); setError(null) }}>
                Sign in
              </button>
            </>
          )}
        </div>

        <p className="auth-offline-note">
          Works offline — your data is always saved locally first.
        </p>
      </div>
    </div>
  )
}