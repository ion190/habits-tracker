// src/pages/Settings.tsx
import { useRef, useState } from 'react'
import { exportDatabase, importDatabase, db } from '../db/database'
import { sync } from '../db/sync'
import { signOut } from '../db/firebase'
import { useAuth } from '../components/AuthContext'
import { IconDownload, IconUpload, IconTrash } from '../components/Icons'
import { getTheme, setTheme, type Theme } from '../utils'

export default function Settings() {
  const { user, profile } = useAuth()
  const fileRef    = useRef<HTMLInputElement>(null)
  const [status,     setStatus]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [importing,  setImporting]  = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [theme,      setThemeState] = useState<Theme>(getTheme())
  const [signingOut, setSigningOut] = useState(false)

  function flash(type: 'ok' | 'err', msg: string) {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 4000)
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
    </div>
  )
}