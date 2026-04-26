import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Habit, HabitLog } from '../db/database'
import Modal from '../components/Modal'
import { IconPlus, IconTrash, IconCheck } from '../components/Icons'
import { toDateKey } from '../utils'

const COLORS = [
  '#aa3bff','#3b82f6','#22c55e','#f59e0b',
  '#ef4444','#ec4899','#14b8a6','#8b5cf6',
]

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Create / Edit habit modal ─────────────────────────────

function HabitModal({
  initial, onSave, onClose
}: {
  initial?: Habit
  onSave: (h: Habit) => void
  onClose: () => void
}) {
  const [name,       setName]       = useState(initial?.name ?? '')
  const [color,      setColor]      = useState(initial?.color ?? COLORS[0])
  const [frequency,  setFrequency]  = useState<Habit['frequency']>(initial?.frequency ?? 'daily')
  const [targetDays, setTargetDays] = useState<number[]>(initial?.targetDays ?? [0,1,2,3,4,5,6])

  function toggleDay(d: number) {
    setTargetDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
  }

  function submit() {
    if (!name.trim()) return
    onSave({
      id:         initial?.id ?? generateId(),
      name:       name.trim(),
      color,
      icon:       '',
      frequency,
      targetDays: frequency === 'daily' ? [0,1,2,3,4,5,6] : targetDays,
      createdAt:  initial?.createdAt ?? new Date().toISOString(),
      archivedAt: initial?.archivedAt,
    })
    onClose()
  }

  return (
    <Modal title={initial ? 'Edit habit' : 'New habit'} onClose={onClose} width={440}>
      <div className="form-stack">
        <label className="form-label">Name *
          <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning run" autoFocus />
        </label>

        <div className="form-label">
          Color
          <div className="color-row">
            {COLORS.map(c => (
              <button
                key={c}
                className={`color-dot ${color === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="form-label">
          Frequency
          <div className="seg-group">
            {(['daily','weekly','custom'] as const).map(f => (
              <button
                key={f}
                className={`seg-btn ${frequency === f ? 'active' : ''}`}
                onClick={() => setFrequency(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {frequency === 'custom' && (
          <div className="form-label">
            Days
            <div className="day-picker">
              {DAYS.map((d, i) => (
                <button
                  key={d}
                  className={`day-btn ${targetDays.includes(i) ? 'active' : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {d.slice(0,1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Habit row ─────────────────────────────────────────────

function HabitRow({
  habit, logs, onToggle, onEdit, onDelete
}: {
  habit: Habit
  logs: HabitLog[]
  onToggle: (habitId: string, date: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const today     = toDateKey(new Date().toISOString())
  const doneToday = logs.some(l => l.habitId === habit.id && toDateKey(l.completedAt) === today)

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return toDateKey(d.toISOString())
  })

  return (
    <div className="habit-row-card">
      <button
        className={`habit-check ${doneToday ? 'done' : ''}`}
        style={{ borderColor: habit.color, background: doneToday ? habit.color : 'transparent' }}
        onClick={() => onToggle(habit.id, today)}
        title={doneToday ? 'Mark undone' : 'Mark done'}
      >
        {doneToday && <IconCheck />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="item-name">{habit.name}</p>
        <p className="item-sub">{habit.frequency}</p>
      </div>

      <div className="habit-dots">
        {last7.map(d => {
          const done = logs.some(l => l.habitId === habit.id && toDateKey(l.completedAt) === d)
          return (
            <div
              key={d}
              className={`habit-dot ${done ? 'done' : ''}`}
              style={done ? { background: habit.color } : {}}
              title={d}
            />
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-ghost" onClick={onEdit}>Edit</button>
        <button className="btn btn-ghost danger" onClick={onDelete}><IconTrash /></button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function Habits() {
  const [habits,  setHabits]  = useState<Habit[]>([])
  const [logs,    setLogs]    = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'new' | Habit | null>(null)

  async function reload() {
    const [h, l] = await Promise.all([
      db.habits.filter(h => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
    ])
    setHabits(h)
    setLogs(l)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  // ── Writes go through sync ──────────────────────────────

  async function saveHabit(habit: Habit) {
    await sync.put('habits', habit as unknown as Record<string, unknown>)
    reload()
  }

  async function deleteHabit(id: string) {
    // Delete habit
    await sync.delete('habits', id)
    // Delete all associated logs
    const logs = await db.habitLogs.where('habitId').equals(id).toArray()
    await Promise.all(logs.map(l => sync.delete('habitLogs', l.id)))
    reload()
  }

  async function toggleHabit(habitId: string, date: string) {
    const existing = await db.habitLogs
      .where('habitId').equals(habitId)
      .filter(l => toDateKey(l.completedAt) === date)
      .first()

    if (existing) {
      await sync.delete('habitLogs', existing.id)
    } else {
      const log: HabitLog = {
        id:          generateId(),
        habitId,
        completedAt: new Date().toISOString(),
      }
      await sync.put('habitLogs', log as unknown as Record<string, unknown>)
    }
    reload()
  }

  if (loading) return <div className="page-loading">Loading…</div>

  const today     = toDateKey(new Date().toISOString())
  const todayLogs = logs.filter(l => toDateKey(l.completedAt) === today)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Habits</h1>
        <p className="page-sub">{todayLogs.length}/{habits.length} done today</p>
      </div>

      <div className="section-header">
        <span />
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <IconPlus /> New habit
        </button>
      </div>

      {habits.length === 0
        ? <div className="card"><p className="empty-hint">No habits yet. Add your first one!</p></div>
        : habits.map(h => (
          <HabitRow
            key={h.id}
            habit={h}
            logs={logs}
            onToggle={toggleHabit}
            onEdit={() => setModal(h)}
            onDelete={() => deleteHabit(h.id)}
          />
        ))
      }

      {modal && (
        <HabitModal
          initial={modal === 'new' ? undefined : modal}
          onSave={saveHabit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}