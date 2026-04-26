import { useRef, useState } from 'react'
import { exportDatabase, importDatabase } from '../db/database'
import { sync } from '../db/sync'
import { IconDownload, IconUpload, IconTrash } from '../components/Icons'
import { db } from '../db/database'

export default function Settings() {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [status, setStatus]     = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function flash(type: 'ok' | 'err', msg: string) {
    setStatus({ type, msg })
    setTimeout(() => setStatus(null), 4000)
  }

  async function handleExport() {
    try {
      await exportDatabase()
      flash('ok', 'Backup downloaded successfully.')
    } catch (e) {
      flash('err', `Export failed: ${(e as Error).message}`)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      // 1. Write to Dexie
      await importDatabase(file)

      // 2. Push everything to Firestore via sync
      const [habits, habitLogs, tasks, exercises, workoutPlans, completedWorkouts] = await Promise.all([
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.tasks.toArray(),
        db.exercises.toArray(),
        db.workoutPlans.toArray(),
        db.completedWorkouts.toArray(),
      ])

      const allWrites = [
        ...habits.map(r           => sync.put('habits',            r as unknown as Record<string, unknown>)),
        ...habitLogs.map(r        => sync.put('habitLogs',         r as unknown as Record<string, unknown>)),
        ...tasks.map(r            => sync.put('tasks',             r as unknown as Record<string, unknown>)),
        ...exercises.map(r        => sync.put('exercises',         r as unknown as Record<string, unknown>)),
        ...workoutPlans.map(r     => sync.put('workoutPlans',      r as unknown as Record<string, unknown>)),
        ...completedWorkouts.map(r=> sync.put('completedWorkouts', r as unknown as Record<string, unknown>)),
      ]

      await Promise.all(allWrites)
      flash('ok', 'Data imported and synced successfully.')
    } catch (e) {
      flash('err', `Import failed: ${(e as Error).message}`)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClearAll() {
    if (!confirming) { setConfirming(true); return }

    const tables  = ['habits', 'habitLogs', 'tasks', 'exercises', 'workoutPlans', 'completedWorkouts'] as const
    const records = await Promise.all([
      db.habits.toArray(), db.habitLogs.toArray(), db.tasks.toArray(),
      db.exercises.toArray(), db.workoutPlans.toArray(), db.completedWorkouts.toArray(),
    ])

    // Delete each record through sync so Firestore is also cleared
    await Promise.all(
      tables.flatMap((table, i) =>
        records[i].map(r => sync.delete(table, (r as { id: string }).id))
      )
    )

    setConfirming(false)
    flash('ok', 'All data cleared.')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="page-sub">Manage your data</p>
      </div>

      {status && <div className={`banner ${status.type}`}>{status.msg}</div>}

      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Export data</h2>
            <p className="settings-desc">Downloads a <code>.json</code> backup of all your data.</p>
          </div>
          <button className="btn btn-primary" onClick={handleExport}><IconDownload /> Export</button>
        </div>
      </section>

      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Import data</h2>
            <p className="settings-desc">
              Load a previously exported <code>.json</code> file.{' '}
              <strong>This overwrites all current data.</strong>
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            <IconUpload /> {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json"
            style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </section>

      <section className="card settings-section danger-zone">
        <div className="settings-row">
          <div>
            <h2 className="card-title danger-title">Clear all data</h2>
            <p className="settings-desc">
              Permanently deletes everything from this device and the cloud.
              {confirming && <strong> Are you sure? Click again to confirm.</strong>}
            </p>
          </div>
          <button
            className={`btn ${confirming ? 'btn-danger-confirm' : 'btn-danger'}`}
            onClick={handleClearAll}
          >
            <IconTrash /> {confirming ? 'Confirm clear' : 'Clear all'}
          </button>
        </div>
      </section>
    </div>
  )
}