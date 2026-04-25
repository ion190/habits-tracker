import { useRef, useState } from 'react'
import { exportDatabase, importDatabase } from '../db/database'
import { IconDownload, IconUpload, IconTrash } from '../components/Icons'
import { db } from '../db/database'

export default function Settings() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
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
      await importDatabase(file)
      flash('ok', 'Data imported successfully. All previous data was replaced.')
    } catch (e) {
      flash('err', `Import failed: ${(e as Error).message}`)
    } finally {
      setImporting(false)
      // Reset file input so same file can be re-imported
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleClearAll() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    await Promise.all([
      db.habits.clear(),
      db.habitLogs.clear(),
      db.tasks.clear(),
      db.exercises.clear(),
      db.workoutPlans.clear(),
      db.completedWorkouts.clear(),
    ])
    setConfirming(false)
    flash('ok', 'All data cleared.')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p className="page-sub">Manage your data</p>
      </div>

      {/* Status banner */}
      {status && (
        <div className={`banner ${status.type}`}>
          {status.msg}
        </div>
      )}

      {/* Export */}
      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Export data</h2>
            <p className="settings-desc">
              Downloads a <code>.json</code> backup of all your habits, logs,
              tasks, exercises and workouts.
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleExport}>
            <IconDownload />
            Export
          </button>
        </div>
      </section>

      {/* Import */}
      <section className="card settings-section">
        <div className="settings-row">
          <div>
            <h2 className="card-title">Import data</h2>
            <p className="settings-desc">
              Load a previously exported <code>.json</code> file.{' '}
              <strong>This overwrites all current data.</strong>
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <IconUpload />
            {importing ? 'Importing…' : 'Import'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </div>
      </section>

      {/* Danger zone */}
      <section className="card settings-section danger-zone">
        <div className="settings-row">
          <div>
            <h2 className="card-title danger-title">Clear all data</h2>
            <p className="settings-desc">
              Permanently deletes everything from this device.
              {confirming && <strong> Are you sure? Click again to confirm.</strong>}
            </p>
          </div>
          <button
            className={`btn ${confirming ? 'btn-danger-confirm' : 'btn-danger'}`}
            onClick={handleClearAll}
          >
            <IconTrash />
            {confirming ? 'Confirm clear' : 'Clear all'}
          </button>
        </div>
      </section>
    </div>
  )
}