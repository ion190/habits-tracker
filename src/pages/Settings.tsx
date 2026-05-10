// src/pages/Settings.tsx
import { useRef, useState, useEffect } from 'react'
import { exportDatabase, importDatabase, db } from '../db/database'
import { sync } from '../db/sync'
import { signOut } from '../db/firebase'
import { useAuth } from '../components/AuthContext'
import { IconDownload, IconUpload, IconTrash } from '../components/Icons'
import { getTheme, setTheme, type Theme } from '../utils'
import {
  initAuth, getApiBase, setApiBase, clearApiConfig,
  isAuthenticated, getToken, type Role,
} from '../lib/api'

export default function Settings() {
  const { user, profile } = useAuth()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [status,     setStatus]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [importing,  setImporting]  = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [theme,      setThemeState] = useState<Theme>(getTheme())
  const [signingOut, setSigningOut] = useState(false)

  const [apiUrl,        setApiUrl]        = useState(() => getApiBase())
const [apiRole,       setApiRole]       = useState<Role>(
  () => (localStorage.getItem('rituals_api_role') as Role) ?? 'VISITOR'
)
const [apiConnected,  setApiConnected]  = useState(() => isAuthenticated())
const [apiConnecting, setApiConnecting] = useState(false)
const [apiError,      setApiError]      = useState<string | null>(null)

  function flash(type: 'ok' | 'err', msg: string) {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 4000)
  }

  async function handleApiConnect() {
  setApiConnecting(true)
  setApiError(null)
  try {
    setApiBase(apiUrl)
    // Quick health check first
    const health = await fetch(`${apiUrl}/health`)
    if (!health.ok) throw new Error(`Server responded with ${health.status}`)
    await initAuth(apiRole)
    setApiConnected(true)
    flash('ok', `Connected to API as ${apiRole}`)
  } catch (e) {
    setApiConnected(false)
    setApiError((e as Error).message)
  } finally {
    setApiConnecting(false)
  }
}

function handleApiDisconnect() {
  clearApiConfig()
  setApiConnected(false)
  setApiUrl(getApiBase())
  setApiRole('VISITOR')
  setApiError(null)
  flash('ok', 'Disconnected from API backend.')
}

  function handleThemeChange(t: Theme) {
    setThemeState(t); setTheme(t)
    flash('ok', `Theme changed to ${t}`)
  }

  async function handleExport() {
    try { await exportDatabase(); flash('ok', 'Backup downloaded.') }
    catch (e) { flash('err', `Export failed: ${(e as Error).message}`) }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setImporting(true)
    try {
      await importDatabase(file)
      const [habits, habitLogs, tasks, exercises, workoutPlans, completedWorkouts] = await Promise.all([
        db.habits.toArray(), db.habitLogs.toArray(), db.tasks.toArray(),
        db.exercises.toArray(), db.workoutPlans.toArray(), db.completedWorkouts.toArray(),
      ])
      await Promise.all([
        ...habits.map(r           => sync.put('habits',            r as unknown as Record<string, unknown>)),
        ...habitLogs.map(r        => sync.put('habitLogs',         r as unknown as Record<string, unknown>)),
        ...tasks.map(r            => sync.put('tasks',             r as unknown as Record<string, unknown>)),
        ...exercises.map(r        => sync.put('exercises',         r as unknown as Record<string, unknown>)),
        ...workoutPlans.map(r     => sync.put('workoutPlans',      r as unknown as Record<string, unknown>)),
        ...completedWorkouts.map(r=> sync.put('completedWorkouts', r as unknown as Record<string, unknown>)),
      ])
      flash('ok', 'Data imported and synced.')
    } catch (e) {
      flash('err', `Import failed: ${(e as Error).message}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClearAll() {
    if (!confirming) { setConfirming(true); return }
    const tables = ['habits', 'habitLogs', 'tasks', 'exercises', 'workoutPlans', 'completedWorkouts'] as const
    const records = await Promise.all([
      db.habits.toArray(), db.habitLogs.toArray(), db.tasks.toArray(),
      db.exercises.toArray(), db.workoutPlans.toArray(), db.completedWorkouts.toArray(),
    ])
    await Promise.all(
      tables.flatMap((table, i) =>
        records[i].map(r => sync.delete(table, (r as { id: string }).id))
      )
    )
    setConfirming(false)
    flash('ok', 'All data cleared.')
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      sync.reset()
      await signOut()
      // Clear local db so next user starts fresh
      await Promise.all([
        db.habits.clear(), db.habitLogs.clear(), db.tasks.clear(),
        db.exercises.clear(), db.workoutPlans.clear(), db.completedWorkouts.clear(),
      ])
    } catch (e) {
      flash('err', `Sign out failed: ${(e as Error).message}`)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="page-sub">Manage your account and data</p>
      </div>

      {status && <div className={`banner ${status.type}`}>{status.msg}</div>}

      {/* Account info */}
      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Account</h2>
            <p className="settings-desc">
              Signed in as <strong>{profile?.name ?? user?.displayName ?? 'User'}</strong>
            </p>
            <p className="settings-desc" style={{ marginTop: 2 }}>{user?.email}</p>
          </div>
          <button className="btn btn-secondary" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </section>

      {/* Theme */}
      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Theme</h2>
            <p className="settings-desc">Choose your preferred color scheme.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark', 'auto'] as Theme[]).map(t => (
              <button key={t} className={`btn ${theme === t ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleThemeChange(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Export */}
      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Export data</h2>
            <p className="settings-desc">Download a <code>.json</code> backup of all your data.</p>
          </div>
          <button className="btn btn-primary" onClick={handleExport}><IconDownload /> Export</button>
        </div>
      </section>

      {/* Import */}
      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Import data</h2>
            <p className="settings-desc">Load a previously exported <code>.json</code> file. <strong>Overwrites current data.</strong></p>
          </div>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            <IconUpload /> {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </section>

      {/* Danger zone */}
      <section className="card settings-section danger-zone">
        <div className="settings-row">
          <div>
            <h2 className="card-title danger-title">Clear all data</h2>
            <p className="settings-desc">
              Permanently deletes everything from this device and the cloud.
              {confirming && <strong> Are you sure? Click again to confirm.</strong>}
            </p>
          </div>
          <button className={`btn ${confirming ? 'btn-danger-confirm' : 'btn-danger'}`} onClick={handleClearAll}>
            <IconTrash /> {confirming ? 'Confirm clear' : 'Clear all'}
          </button>
        </div>
      </section>

      {/* ── API Backend ──────────────────────────────────────── */}
<section className="card settings-section">
  <h2 className="card-title" style={{ marginBottom: 4 }}>API Backend</h2>
  <p className="settings-desc" style={{ marginBottom: 12 }}>
    Connect to the <code>rituals-api</code> REST backend for server-side storage.
    {' '}<a href={`${apiUrl}/docs`} target="_blank" rel="noreferrer"
       style={{ color: 'var(--accent)' }}>Open Swagger docs ↗</a>
  </p>

  {/* Status badge */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
      background: apiConnected ? 'var(--green-bg, #dcfce7)' : 'var(--muted-bg, #f1f5f9)',
      color: apiConnected ? 'var(--green, #16a34a)' : 'var(--muted-fg, #64748b)',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: apiConnected ? '#16a34a' : '#94a3b8',
        display: 'inline-block',
      }} />
      {apiConnected ? `Connected · ${apiRole}` : 'Not connected'}
    </span>
    {apiConnected && getToken() && (
      <span style={{ fontSize: 11, color: 'var(--muted-fg, #94a3b8)' }}>
        Token: <code style={{ fontSize: 11 }}>{getToken()}</code>
      </span>
    )}
  </div>

  {/* URL input */}
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <label style={{ fontSize: 13, fontWeight: 500 }}>
      API URL
      <input
        type="url"
        value={apiUrl}
        onChange={e => { setApiUrl(e.target.value); setApiConnected(false) }}
        placeholder="http://localhost:3001"
        style={{
          display: 'block', marginTop: 4, width: '100%', maxWidth: 340,
          padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border, #e2e8f0)',
          background: 'var(--input-bg, #fff)', color: 'inherit', fontSize: 13,
        }}
      />
    </label>

    {/* Role selector */}
    <div>
      <span style={{ fontSize: 13, fontWeight: 500 }}>Role (JWT permissions)</span>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {(['ADMIN', 'WRITER', 'VISITOR'] as Role[]).map(r => (
          <button
            key={r}
            className={`btn btn-sm ${apiRole === r ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setApiRole(r); setApiConnected(false) }}
            style={{ fontSize: 12, padding: '4px 12px' }}
          >
            {r}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted-fg, #94a3b8)', marginTop: 4 }}>
        ADMIN = READ+WRITE+DELETE · WRITER = READ+WRITE · VISITOR = READ only
      </p>
    </div>

    {/* Error */}
    {apiError && (
      <p style={{ fontSize: 12, color: 'var(--red, #ef4444)', margin: 0 }}>
        ⚠ {apiError}
      </p>
    )}

    {/* Connect / Disconnect buttons */}
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button
        className="btn btn-primary"
        onClick={handleApiConnect}
        disabled={apiConnecting || !apiUrl}
        style={{ fontSize: 13 }}
      >
        {apiConnecting ? 'Connecting…' : apiConnected ? 'Reconnect' : 'Connect'}
      </button>
      {apiConnected && (
        <button className="btn btn-secondary" onClick={handleApiDisconnect} style={{ fontSize: 13 }}>
          Disconnect
        </button>
      )}
    </div>
  </div>
</section>
    </div>
  )
}