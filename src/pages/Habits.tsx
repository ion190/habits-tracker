import React, { useEffect, useState, useMemo } from 'react'

import {
  HABIT_SORT_KEY,
  HABIT_SORT_OPTIONS,
  sortHabits,
} from './habits/sortHabits.ts'

import { db, generateId } from '../db/database'

import { sync } from '../db/sync'
import type { Habit, HabitLog } from '../db/database'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import HabitValueModal from '../components/HabitValueModal'
import HabitHeatmap from '../components/HabitHeatmap'
import LogHabitModal from '../components/LogHabitModal'

import { IconPlus, IconTrash, IconCheck, IconArchive } from '../components/Icons'
import { toDateKey, getPastTags } from '../utils'
import TagSuggestions from '../components/TagSuggestions'

const COLORS = [
  '#aa3bff','#3b82f6','#22c55e','#f59e0b',
  '#ef4444','#ec4899','#14b8a6','#8b5cf6',
]

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ── Create / Edit habit modal ─────────────────────────────

function HabitModal({
  initial, onSave, onClose, onArchive
}: {
  initial?: Habit
  onSave: (h: Habit) => void
  onClose: () => void
  onArchive?: (h: Habit) => void
}) {
  const [name,       setName]       = useState(initial?.name ?? '')
  const [color,      setColor]      = useState(initial?.color ?? COLORS[0])
  const [frequency,  setFrequency]  = useState<Habit['frequency']>(initial?.frequency ?? 'daily')
  const [targetDays, setTargetDays] = useState<number[]>(initial?.targetDays ?? [1,2,3,4,5])
  const [tags,       setTags]       = useState<string[]>(initial?.tags ?? [])
  const [tagInput,   setTagInput]   = useState('')
  const [pastTags, setPastTags] = useState<string[]>([])

  const [hasQuota,   setHasQuota]   = useState(!!initial?.quota)

  useEffect(() => {
    getPastTags('habit').then(setPastTags)
  }, [])
  const [quotaType,  setQuotaType]  = useState<'quantity' | 'time'>(initial?.quota?.type ?? 'quantity')
  const [quotaTarget, setQuotaTarget] = useState<number>(initial?.quota?.target ?? 1)
  const [quotaUnit,  setQuotaUnit]  = useState(initial?.quota?.unit ?? '')

  function toggleDay(d: number) {
    setTargetDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
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
          
          <TagSuggestions
            pastTags={pastTags}
            currentTags={tags}
            onChange={setTags}
            inputValue={tagInput}
            onInputChange={setTagInput}
          />
        </div>

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {initial && onArchive && (
              <button
                className="btn btn-ghost"
                style={{ color: 'var(--text-dim)' }}
                onClick={() => { onArchive(initial); onClose() }}
                title="Archive this habit"
              >
                <IconArchive /> Archive
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>Save</button>
          </div>
        </div>
        </div>
    </Modal>
  )
}

// ── Habit row ─────────────────────────────────────────────

function HabitRow({
  habit,
  logs,
  selectedDateKey,
  onToggle,
  onEdit,
  onArchive,
  showStreak,
  periodDoneCount,
}: {
  habit: Habit
  logs: HabitLog[]
  selectedDateKey: string
  onToggle: (habitId: string, date: string) => void
  onEdit: () => void
  onArchive: () => void
  showStreak: boolean
  periodDoneCount: number
}) {
  const selectedLog = logs.find(
    (l) => l.habitId === habit.id && toDateKey(l.completedAt) === selectedDateKey,
  )

  const last7 = showStreak


    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        return toDateKey(d.toISOString())
      })
    : null


  return (
    <div className="habit-row-card" onClick={onEdit} role="button" tabIndex={0}>
      <button
        className={`habit-check ${selectedLog ? 'done' : ''}`}
        style={{ borderColor: habit.color, background: selectedLog ? habit.color : 'transparent' }}
        onClick={(e) => { e.stopPropagation(); onToggle(habit.id, selectedDateKey) }}
        title={selectedLog ? 'Mark undone' : 'Mark done'}
      >
        {selectedLog && <IconCheck />}
      </button>


      <div className="habit-row-main">
        <div className="habit-row-header">

          <p className="item-name">{habit.name}</p>
          <div className="habit-meta">
            {habit.quota && (
              <span className="meta-chip">
                {habit.quota.target}{habit.quota.unit ? ` ${habit.quota.unit}` : ''}
              </span>
            )}
            {selectedLog?.value !== undefined && (
              <span className="meta-chip done-chip">
                Done: {selectedLog.value}{habit.quota?.unit ? ` ${habit.quota.unit}` : ''}
              </span>
            )}
            {periodDoneCount > 0 && (
              <span
                className="meta-chip"
                title={
                  habit.frequency === 'daily'
                    ? `Done ${periodDoneCount}× today`
                    : `Done ${periodDoneCount}× this ${habit.frequency === 'weekly' ? 'week' : 'period'}`
                }
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success)',
                  border: '1px solid var(--success-border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                ✓{periodDoneCount > 1 ? ` ×${periodDoneCount}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {last7 && (
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
      )}


    </div>
  )
}


// ── Main page ─────────────────────────────────────────────

export default function Habits() {
  const getTags = (habit: Habit): string[] => (habit.tags ?? []).filter(Boolean)

  const TAG_ORDER_KEY = 'habitsTagOrder'
  const HABIT_ORDER_KEY = 'habitsHabitOrderByTag'

  type HabitOrderByTag = Record<string, string[]>

  const [tagOrder] = useState<string[]>(() => {

    try {
      const raw = localStorage.getItem(TAG_ORDER_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : []
    } catch {
      return []
    }
  })

  const [habitOrderByTag] = useState<HabitOrderByTag>(() => {
    try {
      const raw = localStorage.getItem(HABIT_ORDER_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      return (parsed && typeof parsed === 'object') ? (parsed as HabitOrderByTag) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem(TAG_ORDER_KEY, JSON.stringify(tagOrder))
  }, [tagOrder])

  // Persisted for future UI ordering; currently not used.
  useEffect(() => {
    localStorage.setItem(HABIT_ORDER_KEY, JSON.stringify(habitOrderByTag))
  }, [habitOrderByTag])




  const [habits,  setHabits]  = useState<Habit[]>([])
  const [habitSort, setHabitSort] = useState(() => {
    return localStorage.getItem(HABIT_SORT_KEY) || 'name'
  })


  // Warn about missing tags during development
  useEffect(() => {
    const missing = habits.filter(h => h.tags === undefined || h.tags === null)
    if (missing.length > 0) {
      // TODO: Handle missing tags
    }
  }, [habits])

  const [archivedHabits, setArchivedHabits] = useState<Habit[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [logs,    setLogs]    = useState<HabitLog[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'new' | Habit | null>(null)
  const [logHabitOpen, setLogHabitOpen] = useState(false)
  const [selectedPastDateKey, setSelectedPastDateKey] = useState<string>(() => new Date().toISOString().slice(0, 10))

  const [deleteHabitId, setDeleteHabitId] = useState<string | null>(null)

  const [deleteHabitName, setDeleteHabitName] = useState<string>('')

  const [valueModalTarget, setValueModalTarget] = useState<{ habit: Habit; dateKey: string } | null>(null)



  // Tag filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedFreqs, setSelectedFreqs] = useState<string[]>([])

  const allTags = useMemo(() => {
    return Array.from(new Set(habits.flatMap(getTags)))
  }, [habits])

  // All distinct frequencies that exist among active habits
  const allFreqs = useMemo(() => {
    const order: Record<string, number> = { daily: 0, weekly: 1, custom: 2 }
    return Array.from(new Set(habits.map(h => h.frequency)))
      .sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9))
  }, [habits])

  // function toggleTag(tag: string) {
  //   setSelectedTags(prev => 
  //     prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  //   )
  // }

  const displayedHabits = useMemo(() => {
    let filtered = habits
    if (selectedTags.length > 0)
      filtered = filtered.filter(h => selectedTags.every(tag => getTags(h).includes(tag)))
    if (selectedFreqs.length > 0)
      filtered = filtered.filter(h => selectedFreqs.includes(h.frequency))
    return sortHabits(filtered, habitSort)
  }, [habits, selectedTags, selectedFreqs, habitSort])

  const filteredLogs = useMemo(() => {
    if (selectedTags.length === 0 && selectedFreqs.length === 0) return logs
    return logs.filter(l => displayedHabits.some(h => h.id === l.habitId))
  }, [logs, displayedHabits, selectedTags, selectedFreqs])

  // Heatmap filter state
  const [filterMode, setFilterMode] = useState<'all' | 'none' | string>('all')
const effectiveFilterHabitIds =
    filterMode === 'all'
      ? displayedHabits.map((h: Habit) => h.id)
      : filterMode === 'none'
        ? []
        : [filterMode as string].filter(id =>
            displayedHabits.some((h: Habit) => h.id === id),
          )

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Avoid eslint warnings about setState-in-effect by explicitly running after mount
  async function reload() {

    const [h, l] = await Promise.all([
      db.habits.toArray(),
      db.habitLogs.toArray(),
    ])
    setHabits(h.filter(hb => !hb.archivedAt))
    setArchivedHabits(h.filter(hb => hb.archivedAt !== undefined))

    setLogs(l)
    setLoading(false)
  }

  useEffect(() => {
    // run after mount to avoid react-hooks/set-state-in-effect lint issues
    ;(async () => { await reload() })()
  }, [])



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
    // Drop archivedAt field while keeping the rest of the habit.
    const rest = { ...habit } as Omit<Habit, 'archivedAt'>
    delete (rest as unknown as { archivedAt?: unknown }).archivedAt
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
      if (value === undefined) {
        await sync.delete('habitLogs', existing.id)
      } else {
        await sync.put('habitLogs', { ...existing, value } as unknown as Record<string, unknown>)
      }
    } else {
      // Store a completedAt at midday to avoid timezone-caused date shifts
      const completedAt = new Date(date + 'T12:00:00').toISOString()
      const log: HabitLog = {
        id:          generateId(),
        habitId,
        completedAt,
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
      setValueModalTarget({ habit, dateKey: date })
    } else {
      toggleHabit(habitId, date)
    }
  }



  function handleSelectDateFromHeatmap(dateKey: string) {
    setSelectedPastDateKey(dateKey)
  }

  function handleHeatmapEdit(habitId: string, dateKey: string) {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    // Editing a historical day should open the same “log” UX as the row toggle.
    // - quota habits: open LogHabitQuotaModal / HabitValueModal
    // - non-quota habits: toggle immediately
    if (habit.quota) {
      setSelectedPastDateKey(dateKey)
      setValueModalTarget({ habit, dateKey })
    } else {
      setSelectedPastDateKey(dateKey)
      handleToggle(habitId, dateKey)
    }
  }

  async function handleValueSave(value: number) {
    if (!valueModalTarget) return
    await toggleHabit(valueModalTarget.habit.id, valueModalTarget.dateKey, value)
    setValueModalTarget(null)
  }



  if (loading) return <div className="page-loading">Loading…</div>

  const today = toDateKey(new Date().toISOString())

  // Period boundaries for "done this period" badge
  const weekStart = (() => {
    const d = new Date()
    const day = d.getDay() // 0=Sun
    const diff = day === 0 ? 6 : day - 1 // make Mon=0
    d.setDate(d.getDate() - diff)
    return toDateKey(d.toISOString())
  })()

  // How many times a habit was completed in its relevant period (today for daily, this week for weekly/custom)
  function getPeriodDoneCount(habit: Habit): number {
    return logs.filter(l => {
      if (l.habitId !== habit.id) return false
      const dk = toDateKey(l.completedAt)
      if (habit.frequency === 'daily') return dk === today
      // weekly / custom: count completions since start of this week
      return dk >= weekStart && dk <= today
    }).length
  }


  return (
    <div className="page">
      <div className="page-header">
        <h1>Habits</h1>
<p className="page-sub">{logs.filter(l => toDateKey(l.completedAt) === today && displayedHabits.some((h: Habit) => h.id === l.habitId)).length}/{displayedHabits.length} done today</p>
      </div>

      <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span />
        <div style={{ flex: 1 }} />
        <button
          className="sort-icon-btn"
          title="Cycle sort order"
          onClick={() => {
            const opts = HABIT_SORT_OPTIONS.map(o => o.value) as ReadonlyArray<(typeof HABIT_SORT_OPTIONS)[number]['value']>
            const safeCurrent = (opts.includes(habitSort as (typeof HABIT_SORT_OPTIONS)[number]['value']) ? habitSort : 'name') as (typeof HABIT_SORT_OPTIONS)[number]['value']
            const next = opts[(opts.indexOf(safeCurrent) + 1) % opts.length]
            setHabitSort(next)
            localStorage.setItem(HABIT_SORT_KEY, next)
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4h8M2 8h5M2 12h3M11 6l2-2 2 2M13 4v8" />
          </svg>
          {HABIT_SORT_OPTIONS.find(o => o.value === habitSort)?.label ?? 'Sort'}
        </button>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          <IconPlus /> New habit
        </button>

        {/* <button
          className="btn btn-secondary"
          onClick={() => setLogHabitOpen(true)}
          style={{ whiteSpace: 'nowrap' }}
        >
          + Log for a past day
        </button> */}

      </div>


      {/* Filter bar — frequency chips + tag chips in one unified row */}
      {(allFreqs.length > 1 || allTags.length > 0) && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

            {/* Frequency chips */}
            {allFreqs.map(freq => {
              const active = selectedFreqs.includes(freq)
              const label = freq.charAt(0).toUpperCase() + freq.slice(1)
              const count = habits.filter(h => h.frequency === freq).length
              return (
                <span
                  key={`freq-${freq}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    background: active ? 'var(--accent-bg)' : 'var(--bg)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    color: active ? 'var(--accent)' : 'var(--text)',
                    fontStyle: 'italic',
                  }}
                  onClick={() => setSelectedFreqs(prev =>
                    prev.includes(freq) ? prev.filter(f => f !== freq) : [...prev, freq]
                  )}
                >
                  {label}
                  <span style={{ opacity: 0.55 }}>{count}</span>
                  {active && <span style={{ opacity: 0.7 }}>✕</span>}
                </span>
              )
            })}

            {/* Divider between freq and tag chips — only when both exist */}
            {allFreqs.length > 1 && allTags.length > 0 && (
              <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0, alignSelf: 'center' }} />
            )}

            {/* Tag chips */}
            {allTags.map(tag => {
              const active = selectedTags.includes(tag)
              return (
                <span
                  key={`tag-${tag}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px',
                    background: active ? 'var(--accent-bg)' : 'var(--bg)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    color: active ? 'var(--accent)' : 'var(--text)',
                  }}
                  onClick={() => setSelectedTags(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  )}
                >
                  {tag}
                  <span style={{ opacity: 0.55 }}>{habits.filter(h => getTags(h).includes(tag)).length}</span>
                  {active && <span style={{ opacity: 0.7 }}>✕</span>}
                </span>
              )
            })}

            {/* Clear all active filters */}
            {(selectedFreqs.length > 0 || selectedTags.length > 0) && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => { setSelectedFreqs([]); setSelectedTags([]) }}
                style={{ fontSize: 12, marginLeft: 2 }}
              >
                Clear all
              </button>
            )}

          </div>
        </div>
      )}

      {displayedHabits.length === 0 ? (
        <div className="card">
          <p className="empty-hint">No habits yet. Add your first one!</p>
        </div>
        ) : (() => {
          // Render with frequency group dividers (daily → weekly → custom)
          const elements: React.ReactNode[] = []
          let lastFreq: string | null = null
          const freqLabel: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', custom: 'Custom' }
          displayedHabits.forEach(h => {
            if (h.frequency !== lastFreq) {
              lastFreq = h.frequency
              elements.push(
                <div
                  key={`divider-${h.frequency}`}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--text-dim)',
                    padding: '4px 2px 2px',
                    marginTop: elements.length > 0 ? 8 : 0,
                  }}
                >
                  {freqLabel[h.frequency] ?? h.frequency}
                </div>
              )
            }
            elements.push(
              <HabitRow
                key={h.id}
                habit={h}
                logs={logs}
                selectedDateKey={selectedPastDateKey}
                onToggle={handleToggle}
                onEdit={() => setModal(h)}
                onArchive={() => archiveHabit(h)}
                showStreak={!isMobile}
                periodDoneCount={getPeriodDoneCount(h)}
              />
            )
          })
          return elements
        })()
      }


      {/* Habit Heatmap Section */}
      {habits.length > 0 && (
        <section className="card heatmap-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
            <h2 className="card-title">Habit heatmap</h2>
            <select 
              value={filterMode}

              onChange={(e) => setFilterMode(e.target.value as 'all' | 'none' | string)}
              className="field"
              style={{ fontSize: 13, padding: '6px 10px' }}
            >
              <option value="all">All habits ({displayedHabits.length})</option>
              <option value="none">No filter</option>
            {displayedHabits.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          </div>

          <HabitHeatmap
            habits={displayedHabits}
            logs={filteredLogs}
            filterHabitIds={effectiveFilterHabitIds}
            selectedDateKey={selectedPastDateKey}
            onSelectDate={handleSelectDateFromHeatmap}
            onToggle={handleHeatmapEdit}
          />
        </section>
      )}

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
          onArchive={modal !== 'new' ? (h) => { archiveHabit(h); setModal(null) } : undefined}
        />
      )}

      {valueModalTarget && (
        <HabitValueModal
          habitName={valueModalTarget.habit.name}
          quotaType={valueModalTarget.habit.quota!.type}
          unit={valueModalTarget.habit.quota!.unit}
          onSave={handleValueSave}
          onClose={() => setValueModalTarget(null)}
        />
      )}


      {logHabitOpen && (
        <LogHabitModal
          habits={displayedHabits}
            initialDateKey={selectedPastDateKey}

          onClose={() => setLogHabitOpen(false)}
          onSave={async ({ habitId, dateKey, value }) => {
            await toggleHabit(habitId, dateKey, value)
          }}
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