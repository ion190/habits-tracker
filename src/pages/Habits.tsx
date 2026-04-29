import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Habit, HabitLog } from '../db/database'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import HabitValueModal from '../components/HabitValueModal'
import { IconPlus, IconTrash, IconCheck } from '../components/Icons'
import { toDateKey } from '../utils'

const COLORS = [
  '#aa3bff','#3b82f6','#22c55e','#f59e0b',
  '#ef4444','#ec4899','#14b8a6','#8b5cf6',
]

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

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
  const [targetDays, setTargetDays] = useState<number[]>(initial?.targetDays ?? [1,2,3,4,5])
  const [tags,       setTags]       = useState<string[]>(initial?.tags ?? [])
  const [tagInput,   setTagInput]   = useState('')

  const [hasQuota,   setHasQuota]   = useState(!!initial?.quota)
  const [quotaType,  setQuotaType]  = useState<'quantity' | 'time'>(initial?.quota?.type ?? 'quantity')
  const [quotaTarget, setQuotaTarget] = useState<number>(initial?.quota?.target ?? 1)
  const [quotaUnit,  setQuotaUnit]  = useState(initial?.quota?.unit ?? '')

  function toggleDay(d: number) {
    setTargetDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  function submit() {
    if (!name.trim()) return
    const habit: Habit = {
      id:         initial?.id ?? generateId(),
      name:       name.trim(),
      color,
      icon:       '',
      frequency,
      targetDays: frequency === 'daily' ? [0,1,2,3,4,5,6] : targetDays,
      tags,
      quota: hasQuota ? { type: quotaType, target: quotaTarget, unit: quotaUnit.trim() || (quotaType === 'time' ? 'min' : 'units') } : undefined,
      createdAt:  initial?.createdAt ?? new Date().toISOString(),
      archivedAt: initial?.archivedAt,
    }
    onSave(habit)
    onClose()
  }

  return (
    <Modal title={initial ? 'Edit habit' : 'New habit'} onClose={onClose} width={440}>
      <div className="form-stack">
        <label className="form-label">Name *
          <input className="field" value={name} onChange={e => setName(e.target.value)} autoFocus />
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
</div>
        <div className="form-label">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <input
              type="checkbox"
              id="quota-check"
              checked={hasQuota}
              onChange={e => setHasQuota(e.target.checked)}
            />
            <label htmlFor="quota-check" style={{ cursor: 'pointer', fontWeight: 500, margin: 0 }}>Set a quota</label>
          </div>
        </div>

        {hasQuota && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12, background: 'var(--accent-bg)', borderRadius: 8, border: '1px solid var(--accent-border)' }}>
            <div className="form-label" style={{ margin: 0 }}>
              Type
              <div className="seg-group">
                {(['quantity','time'] as const).map(t => (
                  <button
                    key={t}
                    className={`seg-btn ${quotaType === t ? 'active' : ''}`}
                    onClick={() => setQuotaType(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <label className="form-label" style={{ flex: 1, margin: 0 }}>
                Target
                <input
                  className="field"
                  type="number"
                  min={1}
                  step={quotaType === 'time' ? '0.5' : '1'}
                  value={quotaTarget}
                  onChange={e => setQuotaTarget(Number(e.target.value) || 1)}
                />
              </label>
              <label className="form-label" style={{ flex: 2, margin: 0 }}>
                Unit (e.g. pages, min, hrs)
                <input
                  className="field"
                  type="text"
                  value={quotaUnit}
                  onChange={e => setQuotaUnit(e.target.value)}
                  placeholder={quotaType === 'time' ? 'min' : 'pages'}
                />
              </label>
            </div>
            </div>
        )}

        <div className="form-label">
          Tags
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              className="field"
              placeholder="Add tag..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={addTag}>Add</button>
          </div>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    background: 'var(--accent-bg)',
                    border: '1px solid var(--accent-border)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  {tag}
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}
                    onClick={() => removeTag(tag)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

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
  habit, logs, onToggle, onEdit, onArchive
}: {
  habit: Habit
  logs: HabitLog[]
  onToggle: (habitId: string, date: string) => void
  onEdit: () => void
  onArchive: () => void
}) {
  const today     = toDateKey(new Date().toISOString())
  const todayLog  = logs.find(l => l.habitId === habit.id && toDateKey(l.completedAt) === today)
  const doneToday = !!todayLog

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
        <p className="item-sub">
          {habit.frequency}
          {habit.quota && ` · ${habit.quota.target}${habit.quota.unit ? ` ${habit.quota.unit}` : ''}`}
          {todayLog?.value !== undefined && ` · Done: ${todayLog.value}${habit.quota?.unit ? ` ${habit.quota.unit}` : ''}`}
        </p>
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
        <button className="btn btn-ghost" onClick={onArchive} title="Archive">🗃</button>
      </div>
      </div>
  )
}

// ── Main page ─────────────────────────────────────────────

export default function Habits() {
  const [habits,  setHabits]  = useState<Habit[]>([])
  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [logs,    setLogs]    = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'new' | Habit | null>(null)
  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null)
  const [deleteHabitName, setDeleteHabitName] = useState<string>('')

  const [valueModalHabit, setValueModalHabit] = useState<Habit | null>(null)

  async function reload() {
    const [h, l] = await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
    ])
    setHabits(h.filter(x => !x.archivedAt))
    setArchivedHabits(h.filter(x => x.archivedAt))
    setLogs(l)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function saveHabit(habit: Habit) {
    await sync.put('habits', habit as unknown as Record<string, unknown>)
    reload()
  }

  async function archiveHabit(habit: Habit) {
    await sync.put('habits', {
      ...habit,
      archivedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>)
    reload()
  }

  async function unarchiveHabit(habit: Habit) {
    const { archivedAt, ...rest } = habit
    await sync.put('habits', rest as unknown as Record<string, unknown>)
    reload()
  }

  async function deleteHabit(id: string) {
    await sync.delete('habits', id)
    const habitLogs = await db.habitLogs.where('habitId').equals(id).toArray()
    await Promise.all(habitLogs.map(l => sync.delete('habitLogs', l.id)))
    setDeleteHabitId(null)
    reload()
  }

  async function toggleHabit(habitId: string, date: string, value?: number) {
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
        value,
      }
      await sync.put('habitLogs', log as unknown as Record<string, unknown>)
    }
    reload()
  }

  function handleToggle(habitId: string, date: string) {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const existing = logs.find(l => l.habitId === habitId && toDateKey(l.completedAt) === date)
    if (existing) {
      // Undo — no value needed
      toggleHabit(habitId, date)
      return
    }

    if (habit.quota) {
      // Prompt for value
      setValueModalHabit(habit)
    } else {
      // Simple toggle
      toggleHabit(habitId, date)
    }
  }

  function handleValueSave(value: number) {
    if (!valueModalHabit) return
    const today = toDateKey(new Date().toISOString())
    toggleHabit(valueModalHabit.id, today, value)
    setValueModalHabit(null)
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
            onToggle={handleToggle}
            onEdit={() => setModal(h)}
            onArchive={() => archiveHabit(h)}
          />
        ))
      }

      {archivedHabits.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowArchived(s => !s)}
          >
            {showArchived ? '▲ Hide archived' : `▼ Show archived (${archivedHabits.length})`}
          </button>
        </div>
      )}

      {showArchived && archivedHabits.length > 0 && (
        <section className="card" style={{ opacity: 0.7 }}>
          <h2 className="card-title">Archived habits</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archivedHabits.map(habit => (
              <div
                key={habit.id}
                className="habit-row-card"
                style={{ marginBottom: 0 }}
              >
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: habit.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="item-name">{habit.name}</p>
                  <p className="item-sub">{habit.frequency}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => unarchiveHabit(habit)}
                    title="Unarchive"
                  >
                    ↩
                  </button>
                  <button
                    className="btn btn-ghost danger"
                    onClick={() => {
                      setDeleteHabitId(habit.id)
                      setDeleteHabitName(habit.name)
                    }}
                    title="Delete permanently"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {modal && (
        <HabitModal
          initial={modal === 'new' ? undefined : modal}
          onSave={saveHabit}
          onClose={() => setModal(null)}
        />
      )}

      {valueModalHabit && (
        <HabitValueModal
          habitName={valueModalHabit.name}
          quotaType={valueModalHabit.quota!.type}
          unit={valueModalHabit.quota!.unit}
          onSave={handleValueSave}
          onClose={() => setValueModalHabit(null)}
        />
      )}

      {deleteHabitId && (
        <ConfirmDeleteModal
          title="Delete habit"
          message="Are you sure you want to permanently delete this habit? All habit logs will also be deleted."
          itemName={deleteHabitName}
          onConfirm={() => deleteHabit(deleteHabitId)}
          onCancel={() => {
            setDeleteHabitId(null)
            setDeleteHabitName('')
          }}
          isDangerous
        />
      )}
    </div>
  )
}
