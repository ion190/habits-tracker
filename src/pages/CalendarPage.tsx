import { useEffect, useState, useRef, useCallback } from 'react'
import { db, generateId } from '../db/database'
import type { CalendarActivity, CalendarActivityRecurrence, Task, JournalEntry } from '../db/database'
import { sync } from '../db/sync'
import { generateRecurrenceDates } from '../utils/recurrence'

// ── Helpers ───────────────────────────────────────────────
function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToTime(m: number) {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}
function fmtTime(t: string) {
  return t.padStart(5, '0')
}

// generateRecurrenceDates is now imported from '../utils/recurrence'

// Check if two time ranges overlap
function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1)
  const e1 = timeToMinutes(end1)
  const s2 = timeToMinutes(start2)
  const e2 = timeToMinutes(end2)
  return s2 < e1 && e2 > s1
}

// Subtract the new time range from an existing activity time range.
// Treats both ranges as [start, end) (end is exclusive).
// Returns 0..2 direct segments that remain after removing the overlap.
function subtractTimeRange(
  existing: CalendarActivity,
  newActivity: CalendarActivity
): CalendarActivity[] {
  const oldStart = existing.startTime
  const oldEnd = existing.endTime
  const newStart = newActivity.startTime
  const newEnd = newActivity.endTime

  const result: CalendarActivity[] = []

  // Left remaining segment: [oldStart, min(oldEnd, newStart))
  if (oldStart < newStart) {
    const leftEnd = newStart < oldEnd ? newStart : oldEnd
    if (leftEnd > oldStart) {
      result.push({
        ...existing,
        id: generateId(),
        startTime: oldStart,
        endTime: leftEnd,
      })
    }
  }

  // Right remaining segment: [max(oldStart, newEnd), oldEnd)
  if (newEnd < oldEnd) {
    const rightStart = newEnd > oldStart ? newEnd : oldStart
    if (oldEnd > rightStart) {
      result.push({
        ...existing,
        id: generateId(),
        startTime: rightStart,
        endTime: oldEnd,
      })
    }
  }

  return result
}


const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SLOT_H = 56   // px per hour
const TASK_SLOT_H = 28 // px per task bar in all-day strip
const COLORS = ['#aa3bff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316']
const TASK_COLORS = ['#a855f7', '#7c3aed', '#6366f1', '#8b5cf6']

// ── Mini month calendar ────────────────────────────────────
function MiniCalendar({ selected, onChange, isMobile }: { selected: string; onChange: (d: string) => void; isMobile: boolean }) {
  const [viewDate, setViewDate] = useState(() => new Date(selected + 'T00:00:00'))
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const today = toDateKey(new Date())

  // Mobile: show current week only (Mon–Sun)
  if (isMobile) {
    const selectedDateObj = new Date(selected + 'T00:00:00')
    const dayOfWeek = selectedDateObj.getDay() // 0=Sun
    const mondayOffset = (dayOfWeek + 6) % 7
    const monday = new Date(selectedDateObj)
    monday.setDate(selectedDateObj.getDate() - mondayOffset)

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      const key = toDateKey(d)
      return {
        key,
        dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: d.getDate(),
      }
    })

    return (
      <div style={{ userSelect: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 13 }}
            onClick={() => {
              const d = new Date(selected + 'T00:00:00')
              d.setDate(d.getDate() - 7)
              onChange(toDateKey(d))
            }}
          >‹</button>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Week of {new Date(days[0].key + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
          <button
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 13 }}
            onClick={() => {
              const d = new Date(selected + 'T00:00:00')
              d.setDate(d.getDate() + 7)
              onChange(toDateKey(d))
            }}
          >›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
          {days.map(({ key, dayLabel, dayNum }) => {
            const isSel = key === selected
            const isTod = key === today
            return (
              <div
                key={key}
                onClick={() => onChange(key)}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  fontSize: 12,
                  background: isSel ? 'var(--accent)' : isTod ? 'var(--accent-bg)' : 'var(--code-bg)',
                  color: isSel ? '#fff' : isTod ? 'var(--accent)' : 'var(--text)',
                  fontWeight: isSel || isTod ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  border: isSel ? '2px solid var(--accent)' : '2px solid transparent',
                  boxShadow: isSel ? '0 0 8px rgba(var(--accent-rgb), 0.3)' : 'none',
                }}
                title={key}
              >
                <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 2 }}>{dayLabel}</div>
                <div style={{ fontWeight: isSel ? 700 : 600 }}>{dayNum}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const firstDay = new Date(year, month, 1).getDay()
  const pad      = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 13 }}
          onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 13 }}
          onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
          <div key={d} style={{ fontSize: 10, opacity: 0.5, padding: '2px 0', fontWeight: 600 }}>{d}</div>
        ))}
        {Array(pad).fill(null).map((_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day  = i + 1
          const key  = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSel = key === selected
          const isTod = key === today
          return (
            <div key={key} onClick={() => onChange(key)} style={{
              padding: '4px 2px', borderRadius: 6, fontSize: 12,
              background: isSel ? 'var(--accent)' : isTod ? 'var(--accent-bg)' : 'transparent',
              color: isSel ? '#fff' : isTod ? 'var(--accent)' : 'var(--text)',
              fontWeight: isSel || isTod ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>{day}</div>
          )
        })}
      </div>
    </div>
  )
}

// ── Activity form ─────────────────────────────────────────
function ActivityForm({ date, activity, originalRecurringActivity, editingInstanceOfRecurring, onSave, onCancel, onDelete }: {
  date: string
  activity?: CalendarActivity
  originalRecurringActivity?: CalendarActivity
  editingInstanceOfRecurring?: boolean
  onSave: (a: CalendarActivity, scope: 'none' | 'instance' | 'forward' | 'series', originalRecurring?: CalendarActivity) => void
  onCancel: () => void
  onDelete?: (scope?: 'instance') => void
}) {
  const [title,     setTitle]     = useState(activity?.title ?? '')
  const [startTime, setStartTime] = useState(activity?.startTime ?? '09:00')
  const [endTime,   setEndTime]   = useState(activity?.endTime ?? '10:00')
  const [color,     setColor]     = useState(activity?.color ?? COLORS[0])
  const [notes,     setNotes]     = useState(activity?.notes ?? '')
  const [category,  setCategory]  = useState(activity?.category ?? '')
  
  // Recurrence fields
  // - If editing a recurring series: use the original activity's recurrence
  // - If editing an instance: do not enable recurrence; we save it as a direct override (non-recurring)
  const isEditingRecurring = !!originalRecurringActivity
  const isEditingInstance = isEditingRecurring && editingInstanceOfRecurring
  
  // Recurrence toggle: OFF when editing a single instance (it should be non-recurring)
  // When editing a recurring series, recurrence is always on.
  // For new/standalone activities, reflect the saved state.
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(
    isEditingInstance ? false : (isEditingRecurring || !!activity?.recurrence)
  )
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'>(
    originalRecurringActivity?.recurrence?.pattern ?? activity?.recurrence?.pattern ?? 'weekly'
  )
  const [recurrenceTargetDays, setRecurrenceTargetDays] = useState<number[]>(
    originalRecurringActivity?.recurrence?.targetDays ??
    activity?.recurrence?.targetDays ??
    [new Date(date + 'T00:00:00').getDay()] // default to the currently selected day of week
  )
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(originalRecurringActivity?.recurrence?.endDate ?? activity?.recurrence?.endDate ?? '')

  const toggleDay = (day: number) => {
    setRecurrenceTargetDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const save = (scopeOverride?: 'instance' | 'forward' | 'series') => {
    if (!title.trim()) return

    // scope: how broadly this save applies (only relevant when editing a recurring activity)
    // - 'instance':  save only this occurrence (non-recurring override on this date)
    // - 'forward':   truncate the series before this date, save a new series from this date forward
    // - 'series':    update the series anchor in place (changes all occurrences)
    // For new activities, scope is irrelevant — just save with recurrence if enabled.
    const scope = scopeOverride ?? (isEditingRecurring ? 'series' : undefined)

    const isNewActivity = !activity?.id

    // For 'series' edits, anchor stays at original date. Otherwise, use current date.
    const targetDate =
      scope === 'series' && originalRecurringActivity
        ? originalRecurringActivity.date
        : date

    // Recurrence is kept when: (a) enabled and (b) not saving a single-instance override
    // For series edits, recurrence must always be preserved (the checkbox controls instance vs series scope, not whether to remove recurrence).
    const shouldBeRecurring = scope === 'series' ? true : (recurrenceEnabled && scope !== 'instance')

    const a: CalendarActivity = {
      // Instance overrides must always get a fresh id so they don't overwrite the series anchor.
      // Series edits reuse the anchor id (upsert in place).
      // New activities always get a fresh id.
      id: scope === 'series' && originalRecurringActivity
        ? originalRecurringActivity.id
        : scope === 'instance'
          ? generateId()
          : (isNewActivity ? generateId() : (activity?.id ?? generateId())),
      title:     title.trim(),
      date:      targetDate,
      startTime,
      endTime:   endTime > startTime ? endTime : minutesToTime(timeToMinutes(startTime) + 60),
      color,
      notes:     notes.trim() || undefined,
      category:  category.trim() || undefined,
      createdAt: originalRecurringActivity?.createdAt ?? activity?.createdAt ?? new Date().toISOString(),
      // CRITICAL: Instance edits must NEVER have recurrence, period.
      recurrence: scope === 'instance' ? undefined : (shouldBeRecurring ? {
        pattern: recurrencePattern,
        targetDays: recurrencePattern === 'weekly' || recurrencePattern === 'custom' ? recurrenceTargetDays : undefined,
        endDate: recurrenceEndDate || undefined,
      } : undefined),
    }
    onSave(a, scope ?? 'none', originalRecurringActivity)
  }

  // When editing a recurring activity, user can toggle "this occurrence only" inline.
  // Default to true (edit this occurrence only) when editing any recurring activity.
  // This is mutually exclusive with 'edit series' via radio buttons.
  // NOTE: For instance edits, this is FORCED to true and cannot be changed
  const [editThisOccurrenceOnly, setEditThisOccurrenceOnly] = useState(isEditingRecurring)

  const handleSaveClick = () => {
    if (!title.trim()) return
    if (isEditingRecurring) {
      // When editing an instance, ALWAYS use 'instance' scope, never 'series'
      // When editing a series, use the radio button selection
      const finalScope = isEditingInstance ? 'instance' : (editThisOccurrenceOnly ? 'instance' : 'series')
      save(finalScope)
    } else {
      save()
    }
  }

  // Days of week starting with Sunday (0=Sun)
  // Display order: Sun, Mon, Tue, Wed, Thu, Fri, Sat
  // But we'll show Mon first, then Tue-Sun for visual preference
  const DAYS_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const DAYS_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon, Tue, Wed, Thu, Fri, Sat, Sun

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input autoFocus type="text" className="field" placeholder="Activity title"
        value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && save()}
        style={{ fontSize: 15, fontWeight: 600 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <label className="form-label">Start
          <input type="time" className="field" value={startTime}
            onChange={e => setStartTime(e.target.value)} />
        </label>
        <label className="form-label">End
          <input type="time" className="field" value={endTime}
            onChange={e => setEndTime(e.target.value)} />
        </label>
      </div>

      <label className="form-label">Category (optional)
        <input type="text" className="field" value={category}
          onChange={e => setCategory(e.target.value)} placeholder="Work, Personal, Health…" />
      </label>

      <div>
        <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Color</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)} style={{
              width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? '2px solid var(--text-h)' : '2px solid transparent',
              transition: 'all 0.15s',
            }} />
          ))}
        </div>
      </div>

      <textarea className="field" placeholder="Notes (optional)" value={notes}
        onChange={e => setNotes(e.target.value)} rows={2} style={{ resize: 'none' }} />

      {/* Recurrence Section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: isEditingInstance ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: isEditingInstance ? 0.6 : 1 }}>
          <input type="checkbox" checked={recurrenceEnabled}
            onChange={e => setRecurrenceEnabled(e.target.checked)}
            disabled={isEditingInstance} />
          Recurring activity
        </label>
        
        {isEditingRecurring && (
          <p style={{ fontSize: 11, opacity: 0.6, marginTop: 6, marginBottom: 0 }}>
            {editingInstanceOfRecurring
              ? '📌 Editing this occurrence only (standalone activity - no recurrence)'
              : '📌 Editing recurring series (changes apply to all instances)'}

          </p>
        )}


        {recurrenceEnabled && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>Repeat pattern
              <select className="field" value={recurrencePattern}
                onChange={e => setRecurrencePattern(e.target.value as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom')}
                style={{ fontSize: 13 }}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </label>

            {(recurrencePattern === 'weekly' || recurrencePattern === 'custom') && (
              <div>
                <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Days of week</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {DAYS_DISPLAY_ORDER.map((dayValue) => (
                    <button key={dayValue} onClick={() => toggleDay(dayValue)} style={{
                      padding: '6px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: recurrenceTargetDays.includes(dayValue) ? 'var(--accent)' : 'var(--code-bg)',
                      color: recurrenceTargetDays.includes(dayValue) ? '#fff' : 'var(--text)',
                      border: '1px solid var(--border)', cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>
                      {DAYS_OF_WEEK_LABELS[dayValue]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="form-label" style={{ fontSize: 12 }}>End date (optional)
              <input type="date" className="field" value={recurrenceEndDate}
                onChange={e => setRecurrenceEndDate(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      {/* Scope selector — mutually exclusive radio buttons, shown when editing an existing recurring activity */}
      {isEditingRecurring && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, margin: '0 0 4px' }}>EDIT SCOPE</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="radio"
              name="editScope"
              checked={editThisOccurrenceOnly}
              onChange={() => setEditThisOccurrenceOnly(true)}
            />
            <span><strong>This occurrence only</strong> <span style={{ opacity: 0.6, fontSize: 11 }}>— only {date}</span></span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="radio"
              name="editScope"
              checked={!editThisOccurrenceOnly}
              onChange={() => setEditThisOccurrenceOnly(false)}
            />
            <span><strong>All occurrences</strong> <span style={{ opacity: 0.6, fontSize: 11 }}>— changes the whole series</span></span>
          </label>
        </div>
      )}

      <div className="form-actions">
        {/* Delete button — always shown for existing activities */}
        {onDelete && !editThisOccurrenceOnly && (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }}
            onClick={() => onDelete()}>
            🛑 Stop from here
          </button>
        )}
        {onDelete && editThisOccurrenceOnly && (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }}
            onClick={() => onDelete('instance')}>
            🗑 Delete this occurrence
          </button>
        )}
        {!onDelete && !isEditingRecurring && (
          <span />
        )}
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSaveClick} disabled={!title.trim()}>
          {activity?.id ? 'Update' : 'Add Activity'}
        </button>
      </div>
    </div>
  )
}

// ── Day tooltip (quick-add panel on mini-cal click) ────────
function DayTooltip({ date, tasks, journal, onClose, onAddActivity, onAddTask, onJournal }: {
  date: string
  tasks: Task[]
  journal?: JournalEntry
  onClose: () => void
  onAddActivity: () => void
  onAddTask: () => void
  onJournal: () => void
}) {
  const dayTasks = tasks.filter(t => t.dueDate?.slice(0, 10) === date)
  const label    = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        margin: '4px auto 0',
        zIndex: 200,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        width: 'min(92vw, 280px)',
        boxShadow: 'var(--shadow)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 16 }}
          onClick={onClose}>×</button>
      </div>

      {/* Tasks for day */}
      {dayTasks.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>TASKS</p>
          {dayTasks.map(t => (
            <div key={t.id} style={{ fontSize: 12, padding: '3px 0', display: 'flex', gap: 6 }}>
              <span style={{ opacity: 0.5 }}>{t.completedAt ? '✓' : '○'}</span>
              <span style={{ textDecoration: t.completedAt ? 'line-through' : 'none', opacity: t.completedAt ? 0.5 : 1 }}>
                {t.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Journal indicator */}
      {journal && (
        <div style={{ marginBottom: 10, padding: '6px 8px', background: 'var(--accent-bg)', borderRadius: 6 }}>
          <p style={{ fontSize: 11, color: 'var(--accent)', margin: 0, fontWeight: 600 }}>📅 Journal entry written</p>
          {journal.title && <p style={{ fontSize: 11, margin: '2px 0 0', opacity: 0.7 }}>{journal.title}</p>}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: 12 }}
          onClick={onAddActivity}>⏰ Add activity</button>
        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: 12 }}
          onClick={onAddTask}>✅ Add task for this day</button>
        <button className="btn btn-secondary" style={{ justifyContent: 'flex-start', fontSize: 12 }}
          onClick={onJournal}>📝 Write journal note</button>
      </div>
    </div>
  )
}

// ── Main CalendarPage ──────────────────────────────────────
export default function CalendarPage() {
  const [selectedDate, setSelectedDate]         = useState(toDateKey(new Date()))
  const [activities,   setActivities]           = useState<CalendarActivity[]>([])
  const [tasks,        setTasks]                = useState<Task[]>([])
  const [journals,     setJournals]             = useState<Map<string, JournalEntry>>(new Map())
  const [showForm,     setShowForm]             = useState(false)
  const [editActivity, setEditActivity]         = useState<CalendarActivity | undefined>()
  const [originalRecurringActivity, setOriginalRecurringActivity] = useState<CalendarActivity | undefined>() // Track original recurring activity
  const [editingInstanceOfRecurring, setEditingInstanceOfRecurring] = useState(false)

  const [newStartTime, setNewStartTime]         = useState('09:00')
  const [newEndTime, setNewEndTime] = useState('10:00')
  const [showDayTip,   setShowDayTip]           = useState(false)
  const [quickTaskDate, setQuickTaskDate]       = useState<string | null>(null)
  const [quickTaskTitle, setQuickTaskTitle]     = useState('')
  const [isSelecting, setIsSelecting] = useState(false)
  const [selection, setSelection] = useState<{startY: number, currentY: number} | null>(null)
  const [tempStartMin, setTempStartMin] = useState<number | null>(null)
  const [tempEndMin, setTempEndMin] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [splitNotification, setSplitNotification] = useState<{ title: string; details: string[] } | null>(null)

  // Track selection without relying on async state updates for touch-action.
  const isSelectingRef = useRef(false)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const dragRef     = useRef<{ id: string; offsetMin: number } | null>(null)
  const resizeRef   = useRef<{ id: string; field: 'start' | 'end' } | null>(null)

  const load = useCallback(async () => {
    // Load activities directly for this date
    const allActivitiesOnDate = await db.calendarActivities.where('date').equals(selectedDate).toArray()
    
    // Filter out exclusion entries (they're just markers)
    const directActivities = allActivitiesOnDate.filter(a => !a.notes?.startsWith('__EXCLUSION_FOR:'))
    
    // Collect exclusion IDs for this date to suppress their corresponding recurring instances
    const exclusions = new Set<string>()
    for (const exc of allActivitiesOnDate) {
      if (exc.notes?.startsWith('__EXCLUSION_FOR:') && exc.notes?.endsWith('__')) {
        const seriesId = exc.notes.substring('__EXCLUSION_FOR:'.length, exc.notes.length - 2)
        exclusions.add(seriesId)
      }
    }

    // Also load all recurring activities and check which ones apply to this date
    const allActivities = await db.calendarActivities.toArray()
    const recurringActivities = allActivities.filter(a => a.recurrence && a.date !== selectedDate)

    const applicableRecurring: CalendarActivity[] = []
    for (const activity of recurringActivities) {
      if (!activity.recurrence) continue
      
      // Skip if this occurrence was explicitly deleted
      if (exclusions.has(activity.id)) continue

      const dates = generateRecurrenceDates(activity.date, activity.recurrence)
      if (dates.includes(selectedDate)) {
        // Allow both to coexist (recurrence + direct activities can overlap).
        
        applicableRecurring.push({
          ...activity,
          date: selectedDate,
          anchorDate: activity.date,
          isRecurrenceInstance: true,
        } as CalendarActivity & { anchorDate: string; isRecurrenceInstance: boolean })
      }
    }
    
    const acts = [...directActivities, ...applicableRecurring].sort((a, b) => a.startTime.localeCompare(b.startTime))
    
    const [ts, js] = await Promise.all([
      db.tasks.toArray(),
      db.journalEntries.where('period').equals('daily').toArray(),
    ])
    setActivities(acts)
    setTasks(ts)
    const map = new Map<string, JournalEntry>()
    js.forEach(j => map.set(j.dateKey, j))
    setJournals(map)
  }, [selectedDate])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await load()
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDate, load])


  useEffect(() => {
    // Scroll to 7am on mount
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 7 * SLOT_H, behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timeout)
  }, [])

  const saveActivity = async (a: CalendarActivity, scope: 'none' | 'instance' | 'forward' | 'series' = 'none', originalRecurring?: CalendarActivity) => {
    const splitDetails: string[] = []
    const toSync: { op: 'put' | 'delete'; record?: CalendarActivity; id?: string }[] = []

    // ── All Dexie writes inside a transaction so sync cannot interleave ──────
    await db.transaction('rw', db.calendarActivities, async () => {

      if (scope === 'series' || (scope === 'none' && a.recurrence)) {
        // ── Update entire recurring series (upsert) ─────────────────────────
        const rec = { ...a, id: a.id || generateId() }
        await db.calendarActivities.put(rec)
        toSync.push({ op: 'put', record: rec })

      } else if (scope === 'instance' && originalRecurring) {
        // ── Edit a single occurrence of a recurring series ───────────────────
        // IMPORTANT: The series is NEVER modified. We only create a direct override for this date.
        // The original series remains completely untouched and will continue to generate occurrences.
        
        // Remove any stale direct override on this date+time to prevent duplicates
        const existingOverrides = await db.calendarActivities
          .where('date').equals(a.date)
          .filter(act => !act.recurrence && act.startTime === a.startTime && act.id !== a.id)
          .toArray()
        for (const ov of existingOverrides) {
          await db.calendarActivities.delete(ov.id)
          toSync.push({ op: 'delete', id: ov.id })
        }

        // Create an exclusion entry to hide the original recurring instance on this date
        // This prevents the recurring instance from appearing alongside the override
        const exclusionId = generateId()
        const exclusion: CalendarActivity = {
          id: exclusionId,
          title: `[EXCLUSION: ${originalRecurring.id}]`,
          date: a.date,
          startTime: originalRecurring.startTime,
          endTime: originalRecurring.endTime,
          color: originalRecurring.color,
          createdAt: new Date().toISOString(),
          notes: `__EXCLUSION_FOR:${originalRecurring.id}__`,
          recurrence: undefined,
        }
        await db.calendarActivities.put(exclusion)
        toSync.push({ op: 'put', record: exclusion })

        // Overlap handling — only for direct (non-recurring) activities.
        // Recurring activities always coexist; never block or split them.
        if (!a.recurrence) {
          const directActivitiesOnDate = await db.calendarActivities
            .where('date').equals(a.date)
            .filter(act => !act.recurrence)
            .toArray()
          const overlapping = directActivitiesOnDate.filter(
            ex => ex.id !== a.id && timesOverlap(ex.startTime, ex.endTime, a.startTime, a.endTime)
          )
          for (const overlappingAct of overlapping) {
            const splitParts = subtractTimeRange(overlappingAct, a)
            await db.calendarActivities.delete(overlappingAct.id)
            toSync.push({ op: 'delete', id: overlappingAct.id })
            for (const part of splitParts) {
              await db.calendarActivities.put(part)
              toSync.push({ op: 'put', record: part })
            }
            splitDetails.push(`"${overlappingAct.title}" (${fmtTime(overlappingAct.startTime)}-${fmtTime(overlappingAct.endTime)})`)
          }
        }

        // Create the override with a fresh ID (never use the series ID)
        const overrideActivity: CalendarActivity = { ...a, id: generateId(), recurrence: undefined }
        await db.calendarActivities.put(overrideActivity)
        toSync.push({ op: 'put', record: overrideActivity })

      } else if (scope === 'forward' && originalRecurring) {
        // ── Edit this and all future occurrences ────────────────────────────
        const dayBefore = new Date(selectedDate + 'T00:00:00')
        dayBefore.setDate(dayBefore.getDate() - 1)
        const truncatedEndDate = toDateKey(dayBefore)

        const truncatedSeries: CalendarActivity = {
          ...originalRecurring,
          recurrence: originalRecurring.recurrence
            ? { ...originalRecurring.recurrence, endDate: truncatedEndDate }
            : undefined,
        }
        await db.calendarActivities.put(truncatedSeries)
        toSync.push({ op: 'put', record: truncatedSeries })

        const forwardRec = { ...a, id: generateId() }
        await db.calendarActivities.put(forwardRec)
        toSync.push({ op: 'put', record: forwardRec })

      } else {
        // ── Direct activity (standalone, non-recurring) ─────────────────────

        // Overlap handling — only for direct (non-recurring) activities.
        // Recurring activities always coexist; never block or split them.
        if (!a.recurrence) {
          const directActivitiesOnDate = await db.calendarActivities
            .where('date').equals(a.date)
            .filter(act => !act.recurrence)
            .toArray()
          const overlapping = directActivitiesOnDate.filter(
            ex => ex.id !== a.id && timesOverlap(ex.startTime, ex.endTime, a.startTime, a.endTime)
          )
          for (const overlappingAct of overlapping) {
            const splitParts = subtractTimeRange(overlappingAct, a)
            await db.calendarActivities.delete(overlappingAct.id)
            toSync.push({ op: 'delete', id: overlappingAct.id })
            for (const part of splitParts) {
              await db.calendarActivities.put(part)
              toSync.push({ op: 'put', record: part })
            }
            splitDetails.push(`"${overlappingAct.title}" (${fmtTime(overlappingAct.startTime)}-${fmtTime(overlappingAct.endTime)})`)
          }
        }

        const directRec = { ...a, id: a.id || generateId() }
        await db.calendarActivities.put(directRec)
        toSync.push({ op: 'put', record: directRec })
      }
    })

    if (splitDetails.length > 0) {
      setSplitNotification({
        title: `${splitDetails.length} activit${splitDetails.length !== 1 ? 'ies were' : 'y was'} adjusted to make room`,
        details: splitDetails,
      })
      setTimeout(() => setSplitNotification(null), 5000)
    }

    // Reflect local Dexie state in UI first.
    await load()
    setShowForm(false)
    setEditActivity(undefined)
    setOriginalRecurringActivity(undefined)

    // Fire-and-forget remote sync after UI is updated.
    for (const s of toSync) {
      if (s.op === 'delete' && s.id) sync.delete('calendarActivities', s.id)
      else if (s.op === 'put' && s.record) sync.put('calendarActivities', s.record as unknown as Record<string, unknown>)
    }
  }

  // ── Delete a single occurrence by creating an exclusion entry ─────────────
  const deleteSingleOccurrence = async (seriesId: string, instanceDate: string, knownRecurrence?: CalendarActivityRecurrence) => {
    try {
      await db.transaction('rw', db.calendarActivities, async () => {
        const series = await db.calendarActivities.get(seriesId)
        if (!series) {
          console.error('Series not found:', seriesId)
          return
        }

        // Use knownRecurrence as fallback — the stored record may have lost its recurrence
        // field due to a prior buggy save, but we still know what it should be.
        const recurrence = series.recurrence ?? knownRecurrence
        if (!recurrence) {
          // No recurrence info at all — just delete the standalone record.
          await db.calendarActivities.delete(seriesId)
          return
        }

        // Create a tombstone/exclusion entry for this date.
        // This prevents this series from appearing on this specific date.
        const exclusionId = generateId()
        const exclusion: CalendarActivity = {
          id: exclusionId,
          title: `[EXCLUSION: ${series.id}]`,
          date: instanceDate,
          startTime: series.startTime,
          endTime: series.endTime,
          color: series.color,
          createdAt: new Date().toISOString(),
          notes: `__EXCLUSION_FOR:${series.id}__`,
          recurrence: undefined,
        }

        await db.calendarActivities.put(exclusion)
      })

      // After transaction, sync the exclusion entry
      const exclusions = await db.calendarActivities
        .where('date').equals(instanceDate)
        .filter(a => (a.notes?.includes(`__EXCLUSION_FOR:${seriesId}__`) ?? false))
        .toArray()
      for (const exc of exclusions) {
        sync.put('calendarActivities', exc as unknown as Record<string, unknown>)
      }

      await load()
      setShowForm(false)
      setEditActivity(undefined)
      setOriginalRecurringActivity(undefined)
      setEditingInstanceOfRecurring(false)
    } catch (error) {
      console.error('Error deleting single occurrence:', error)
    }
  }

  const deleteActivity = async (id: string, isRecurring: boolean = false, stopFromDate?: string) => {
    if (isRecurring && stopFromDate) {
      // ── Stop from here — truncate the series ─────────────
      const existing = await db.calendarActivities.get(id)
      if (existing?.recurrence) {
        const dayBefore = new Date(stopFromDate + 'T00:00:00')
        dayBefore.setDate(dayBefore.getDate() - 1)
        const endDate = toDateKey(dayBefore)

        if (endDate < existing.date) {
          // Stop point is before the series start — delete entire series.
          await db.calendarActivities.delete(id)
          await sync.delete('calendarActivities', id)
        } else {
          const updated: CalendarActivity = {
            ...existing,
            recurrence: { ...existing.recurrence!, endDate },
          }
          await db.calendarActivities.put(updated)
          await sync.put('calendarActivities', updated as unknown as Record<string, unknown>)
        }
      } else {
        await db.calendarActivities.delete(id)
        await sync.delete('calendarActivities', id)
      }
    } else {
      await db.calendarActivities.delete(id)
      await sync.delete('calendarActivities', id)
    }

    await load()
    setShowForm(false)
    setEditActivity(undefined)
    setOriginalRecurringActivity(undefined)
  }

  const addQuickTask = async () => {
    if (!quickTaskTitle.trim() || !quickTaskDate) return
    const task: Task = {
      id: generateId(), title: quickTaskTitle.trim(),
      dueDate: quickTaskDate, createdAt: new Date().toISOString(),
      tags: [], urgency: 'medium', importance: 'medium',
    }
    await sync.put('tasks', task as unknown as Record<string, unknown>)
    setTasks(prev => [...prev, task])
    setQuickTaskTitle(''); setQuickTaskDate(null)
  }

  // ── Drag rectangle selection (mouse + touch) ─────────────
  const autoScrollRef = useRef<number | null>(null)
  const touchLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPointerDownRef = useRef(false)
  const selectionStartedRef = useRef(false)
  const selectionStartedFnRef = selectionStartedRef
  const longPressActivatedRef = useRef(false)


  const clearAutoScroll = () => {
    if (autoScrollRef.current) {
      window.clearInterval(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }

  const maybeStartAutoScroll = (clientY: number, container: HTMLDivElement) => {
    if (!isMobile) return
    const rect = container.getBoundingClientRect()
    const topGap = clientY - rect.top
    const bottomGap = rect.bottom - clientY

    clearAutoScroll()

    const threshold = 90
    let delta = 0
    if (topGap < threshold) delta = -1
    else if (bottomGap < threshold) delta = 1
    else return

    autoScrollRef.current = window.setInterval(() => {
      if (!scrollRef.current) return
      scrollRef.current.scrollTop += delta * 10
    }, 16)
  }

  const clientYToMin = (clientY: number, container: HTMLDivElement) => {
    const rect = container.getBoundingClientRect()
    const y = clientY - rect.top
    // getBoundingClientRect() already accounts for scroll position in the DOM tree.
    // No need to add scrollTop - snap to 15 minutes
    return Math.round(((y / SLOT_H) * 4)) * 15
  }

  const beginSelection = (clientY: number, container: HTMLDivElement) => {
    if (dragRef.current || resizeRef.current) return

    isPointerDownRef.current = true
    selectionStartedRef.current = true
    isSelectingRef.current = true
    const startMin = Math.max(0, Math.min(24 * 60 - 15, clientYToMin(clientY, container)))



    setTempStartMin(startMin)
    // For visual preview, use unscrolled coords (we re-render using min->px)
    const rect = container.getBoundingClientRect()
    const startY = clientY - rect.top
    setSelection({ startY, currentY: startY })
    setIsSelecting(true)
  }

  const updateSelection = (clientY: number, container: HTMLDivElement) => {
    if (!isPointerDownRef.current) return
    if (!isSelecting || tempStartMin === null) return

    const endRaw = clientYToMin(clientY, container)
    const endMin = Math.max(tempStartMin + 15, Math.min(24 * 60 - 15, endRaw))

    const rect = container.getBoundingClientRect()
    const currentY = clientY - rect.top
    setSelection(prev => (prev ? { ...prev, currentY } : prev))
    setTempEndMin(endMin)
  }

  const endSelection = (clientY: number, container: HTMLDivElement) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    selectionStartedRef.current = false
    isSelectingRef.current = false
    clearAutoScroll()



    if (!selection || tempStartMin === null) return

    const startMin = tempStartMin
    const endMin = tempEndMin ?? Math.max(startMin + 15, Math.min(24 * 60 - 15, clientYToMin(clientY, container)))

    setIsSelecting(false)
    setSelection(null)
    setTempStartMin(null)
    setTempEndMin(null)

    setNewStartTime(minutesToTime(startMin))
    setNewEndTime(minutesToTime(endMin))
    setEditActivity(undefined)
    setShowForm(true)
  }

  const handleGridPointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Mobile browsers fire synthetic mouse events after touch events — ignore them;
    // selection on mobile is handled entirely by the touch handlers below.
    if (isMobile) return
    if (e.button !== 0) return
    if (dragRef.current || resizeRef.current) return
    const container = e.currentTarget
    beginSelection(e.clientY, container)
    e.preventDefault()
  }

  const handleGridPointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return
    if (!isPointerDownRef.current) return
    if (!scrollRef.current) return
    const container = e.currentTarget
    maybeStartAutoScroll(e.clientY, scrollRef.current)
    updateSelection(e.clientY, container)
  }

  const handleGridPointerUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return
    if (!isPointerDownRef.current) return
    const container = e.currentTarget
    endSelection(e.clientY, container)
  }

  const handleGridTouchStart = (e: React.TouchEvent<HTMLDivElement>) => { // mobile long-press selection
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    const container = e.currentTarget

    selectionStartedRef.current = false
    longPressActivatedRef.current = false
    if (touchLongPressTimer.current) window.clearTimeout(touchLongPressTimer.current)
    
    // On mobile ONLY: require long-press (350ms)
    if (isMobile) {
      touchLongPressTimer.current = window.setTimeout(() => {
        // Start rectangle selection after long-press on mobile
        longPressActivatedRef.current = true
        beginSelection(touch.clientY, container)
        setTempEndMin(null)
      }, 350)
    } else {
      // Non-mobile devices (desktop with touch, tablets): start immediately
      longPressActivatedRef.current = true
      beginSelection(touch.clientY, container)
      setTempEndMin(null)
    }
  }

  const handleGridTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]

    // If the long-press hasn't fired yet, any movement means the user is scrolling —
    // cancel the timer so the selection never starts.
    if (!longPressActivatedRef.current) {
      if (touchLongPressTimer.current) {
        window.clearTimeout(touchLongPressTimer.current)
        touchLongPressTimer.current = null
      }
      return // let the browser handle the scroll naturally
    }

    // Long-press IS active — update the selection rectangle.
    if (!isPointerDownRef.current) return
    if (!scrollRef.current) return

    maybeStartAutoScroll(touch.clientY, scrollRef.current)
    updateSelection(touch.clientY, e.currentTarget)

    // Block scroll while actively drawing a selection.
    e.preventDefault()
  }

  const handleGridTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchLongPressTimer.current) window.clearTimeout(touchLongPressTimer.current)
    touchLongPressTimer.current = null

    // Only finalise if the long-press actually fired and a selection was drawn.
    if (!longPressActivatedRef.current || !isPointerDownRef.current || !selectionStartedRef.current) {
      longPressActivatedRef.current = false
      return
    }

    longPressActivatedRef.current = false

    // End selection using last known touch Y.
    const container = e.currentTarget
    const lastY = e.changedTouches[0]?.clientY ?? 0
    endSelection(lastY, container)
  }

  // ── Drag to move ─────────────────────────────────────────
  const startDrag = (e: React.MouseEvent, a: CalendarActivity) => {
    e.stopPropagation()
    // Prevent dragging pseudo-instances (recurring activities shown on non-anchor dates)
    // because their ID is the series ID, and moving them would corrupt the series
    if ((a as any).isRecurrenceInstance === true) {
      return
    }
    
    const rect    = (e.currentTarget.parentElement!).getBoundingClientRect()
    const clickY  = e.clientY - rect.top
    const actTop  = (timeToMinutes(a.startTime) / 60) * SLOT_H
    const offset  = clickY - actTop   // offset in px inside the card

    dragRef.current = { id: a.id, offsetMin: Math.floor((offset / SLOT_H) * 60) }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const gridRect = scrollRef.current!.querySelector('.cal-grid')!.getBoundingClientRect()
      const y = ev.clientY - gridRect.top
      const rawMin = Math.floor((y / SLOT_H) * 60)
      const snapped = Math.round((rawMin - dragRef.current.offsetMin) / 15) * 15
      const duration = timeToMinutes(a.endTime) - timeToMinutes(a.startTime)
      const newStart = Math.max(0, Math.min(23 * 60, snapped))
      const newEnd   = newStart + duration
      setActivities(prev => prev.map(x =>
        x.id === a.id
          ? { ...x, startTime: minutesToTime(newStart), endTime: minutesToTime(Math.min(24 * 60 - 15, newEnd)) }
          : x
      ))
    }

    const onUp = async () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // persist final position
      // Use latest from state via ref trick — just re-read from db and save back
      setActivities(prev => {
        const act = prev.find(x => x.id === a.id)
        if (act) sync.put('calendarActivities', act as unknown as Record<string, unknown>)
        return prev
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Resize bottom edge ────────────────────────────────────
  const startResize = (e: React.MouseEvent, a: CalendarActivity) => {
    e.stopPropagation()
    // Prevent resizing pseudo-instances (recurring activities shown on non-anchor dates)
    // because their ID is the series ID, and resizing them would corrupt the series
    if ((a as any).isRecurrenceInstance === true) {
      return
    }
    
    resizeRef.current = { id: a.id, field: 'end' }

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const gridRect = scrollRef.current!.querySelector('.cal-grid')!.getBoundingClientRect()
      const y = ev.clientY - gridRect.top
      const rawMin = Math.round((y / SLOT_H) * 60 / 15) * 15
      const min = Math.max(timeToMinutes(a.startTime) + 15, Math.min(24 * 60 - 15, rawMin))
      setActivities(prev => prev.map(x =>
        x.id === a.id ? { ...x, endTime: minutesToTime(min) } : x
      ))
    }

    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setActivities(prev => {
        const act = prev.find(x => x.id === a.id)
        if (act) sync.put('calendarActivities', act as unknown as Record<string, unknown>)
        return prev
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const todayJournal = journals.get(selectedDate)
  const todayTasks   = tasks.filter(t => t.dueDate?.slice(0, 10) === selectedDate)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 800)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div className="page" style={{ 
      display: 'flex', 
      flexDirection: isMobile ? 'column' : 'row',
      gap: 20, 
      height: 'calc(100vh - 60px)', 
      overflow: 'hidden', 
      padding: '16px 20px',
      position: 'relative',
    }}>

      {/* Split notification */}
      {splitNotification && (
        <div style={{
          position: 'absolute',
          top: 16,
          left: 20,
          right: 20,
          zIndex: 2000,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 16,
          boxShadow: 'var(--shadow-xl)',
          maxWidth: 400,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>✂️ {splitNotification.title}</strong>
            <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 16 }}
              onClick={() => setSplitNotification(null)}>×</button>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
            {splitNotification.details.map((detail, i) => (
              <div key={i} style={{ marginBottom: i < splitNotification.details.length - 1 ? 4 : 0 }}>
                • {detail}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left panel */}
      <div style={{ width: isMobile ? '100%' : 230, flexShrink: 0, maxHeight: isMobile ? '35vh' : undefined, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

        <div style={{ position: 'relative' }}>
          <MiniCalendar selected={selectedDate} isMobile={isMobile} onChange={d => { setSelectedDate(d); setShowDayTip(false) }} />

          {/* Day tooltip trigger */}
          <button
            className="btn btn-ghost"
            style={{ width: '100%', marginTop: 6, fontSize: 12, justifyContent: 'center' }}
            onClick={() => setShowDayTip(v => !v)}
          >
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} options ▾
          </button>
          {showDayTip && (
            <DayTooltip
              date={selectedDate}
              tasks={tasks}
              journal={todayJournal}
              onClose={() => setShowDayTip(false)}
              onAddActivity={() => { setShowDayTip(false); setEditActivity(undefined); setShowForm(true) }}
              onAddTask={() => { setShowDayTip(false); setQuickTaskDate(selectedDate) }}
              onJournal={() => {
                setShowDayTip(false)
                window.location.href = `/journal?period=daily&key=${selectedDate}`
              }}
            />
          )}
        </div>

        {/* Quick-add task */}
        {quickTaskDate && (
          <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Add task for {new Date(quickTaskDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <input className="field" placeholder="Task title" value={quickTaskTitle}
              onChange={e => setQuickTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuickTask()}
              style={{ fontSize: 13, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }}
                onClick={() => { setQuickTaskDate(null); setQuickTaskTitle('') }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: 12 }}
                onClick={addQuickTask} disabled={!quickTaskTitle.trim()}>Add</button>
            </div>
          </div>
        )}

        {/* Tasks for the day */}
        {todayTasks.length > 0 && (
          <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.5, marginBottom: 8 }}>
              Tasks today
            </p>
            {todayTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', gap: 6, padding: '4px 0', fontSize: 12, alignItems: 'flex-start' }}>
                <span style={{ opacity: 0.5, flexShrink: 0 }}>{t.completedAt ? '✓' : '○'}</span>
                <span style={{ textDecoration: t.completedAt ? 'line-through' : 'none', opacity: t.completedAt ? 0.5 : 1 }}>
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Journal indicator */}
        {todayJournal && (
          <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, margin: '0 0 4px' }}>📅 Journal entry</p>
            {todayJournal.title && <p style={{ fontSize: 12, margin: '0 0 4px' }}>{todayJournal.title}</p>}
            <p style={{ fontSize: 11, opacity: 0.6, margin: 0 }}>
              {todayJournal.content.slice(0, 80)}{todayJournal.content.length > 80 ? '…' : ''}
            </p>
            <a href={`/journal?period=daily&key=${selectedDate}`}
              style={{ fontSize: 11, color: 'var(--accent)', display: 'block', marginTop: 6 }}>
              Open →
            </a>
          </div>
        )}

        <button className="btn btn-primary" style={{ justifyContent: 'center' }}
          onClick={() => { setEditActivity(undefined); setShowForm(true) }}>
          + Add Activity
        </button>
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Day header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, minHeight: 32 }}>
          <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 13, minWidth: 0, height: 24 }}
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00')
              d.setDate(d.getDate() - 1)
              setSelectedDate(toDateKey(d))
            }}>←</button>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.2, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: '2-digit',
            })}
          </h2>
          <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 13, minWidth: 0, height: 24 }}
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00')
              d.setDate(d.getDate() + 1)
              setSelectedDate(toDateKey(d))
            }}>→</button>
          {selectedDate !== toDateKey(new Date()) && (
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px', height: 24 }}
              onClick={() => setSelectedDate(toDateKey(new Date()))}>Today</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5, minWidth: 40, textAlign: 'right' }}>
            {activities.length + todayTasks.length} item{activities.length + todayTasks.length !== 1 ? 's' : ''}
          </span>
          <button className="btn btn-primary" style={{ fontSize: 12, padding: '2px 8px', height: 28, marginLeft: 6 }}
            onClick={() => { setEditActivity(undefined); setShowForm(true) }}>
            +
          </button>
        </div>

        {/* Scrollable time grid */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', position: 'relative', WebkitOverflowScrolling: 'touch' }}
        >
          <div
            className="cal-grid"
            onMouseDown={handleGridPointerDown}
            onMouseMove={handleGridPointerMove}
            onMouseUp={handleGridPointerUp}

            onPointerDown={() => {
              // Pointer events handled by mouse/touch handlers below
            }}
            onPointerMove={() => {
              // Pointer events handled by mouse/touch handlers below
            }}

            onPointerUp={() => {
              // Pointer events handled by mouse/touch handlers below
            }}
            onPointerCancel={(e) => {
              if (e.pointerType === 'mouse') return
              if (!isPointerDownRef.current) return
              clearAutoScroll()
              isPointerDownRef.current = false
              longPressActivatedRef.current = false
              selectionStartedRef.current = false
              setIsSelecting(false)
              setSelection(null)
              setTempStartMin(null)
              setTempEndMin(null)
              try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
            }}


            // Keep touch long-press as fallback for cases where pointer events are not supported.
            onTouchStart={handleGridTouchStart}
            onTouchMove={handleGridTouchMove}
            onTouchEnd={handleGridTouchEnd}

            // Keep vertical scrolling working naturally when not selecting.
            // (Using React attribute form can be unreliable across browsers.)

            onMouseLeave={() => {




              if (isSelecting && tempStartMin !== null) {
                setIsSelecting(false)
                setSelection(null)
                setTempStartMin(null)
              }
            }}

            style={{
              position: 'relative',
              height: SLOT_H * 24,
              cursor: isSelecting ? 'grabbing' : 'crosshair',
              // Allow pan-y (scroll) by default; block it only when actively selecting
              touchAction: isSelecting ? 'none' : 'pan-y',
            }}
          >
            {/* Hour lines */}
            {HOURS.map(h => (
              <div key={h} style={{
                position: 'absolute', left: 0, right: 0,
                top: h * SLOT_H,
                borderTop: `1px solid ${h === 0 ? 'transparent' : 'var(--border)'}`,
                display: 'flex', alignItems: 'flex-start',
              }}>
                <span style={{
                  fontSize: 11, color: 'var(--text)', opacity: 0.4,
                  width: 44, flexShrink: 0, paddingTop: 2, paddingRight: 8,
                  textAlign: 'right', lineHeight: 1, userSelect: 'none',
                }}>
                  {h === 0 ? '' : `${String(h).padStart(2,'0')}:00`}
                </span>
                <div style={{ flex: 1, borderTop: '1px solid var(--border)', opacity: 0.4 }} />
              </div>
            ))}

            {/* Half-hour lines */}
            {HOURS.map(h => (
              <div key={`h${h}`} style={{
                position: 'absolute', left: 44, right: 0,
                top: h * SLOT_H + SLOT_H / 2,
                borderTop: '1px dashed var(--border)', opacity: 0.25,
                pointerEvents: 'none',
              }} />
            ))}

            {/* All-day task strip */}
            {todayTasks.filter(t => !t.notificationTime).length > 0 && (
              <div style={{
                position: 'absolute', left: 44, right: 0, top: 0,
                height: 0, overflow: 'visible',
                zIndex: 5,
              }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: 0,
                  height: todayTasks.filter(t => !t.notificationTime).length * TASK_SLOT_H + 4,
                  background: 'var(--accent-bg)',
                  borderBottom: '1px dashed var(--accent)',
                  opacity: 0.4,
                  pointerEvents: 'none',
                }} />
                {todayTasks.filter(t => !t.notificationTime).map((t, idx) => {
                  const color = TASK_COLORS[idx % TASK_COLORS.length]
                  return (
                    <div
                      key={t.id}
                      onClick={e => {
                        e.stopPropagation()
                        setEditActivity({
                          id: '', date: selectedDate, title: t.title,
                          startTime: '09:00', endTime: '10:00', color: color,
                          recurrence: undefined, notes: '', category: '',
                          createdAt: new Date().toISOString(),
                        })
                        setShowForm(true)
                      }}
                      style={{
                        position: 'absolute',
                        left: 4, right: 4,
                        top: idx * TASK_SLOT_H + 2,
                        height: TASK_SLOT_H - 4,
                        background: color,
                        borderRadius: 6,
                        padding: '0 8px',
                        display: 'flex', alignItems: 'center',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                      title={`${t.title}${t.completedAt ? ' ✓' : ''}`}
                    >
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: '#fff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.completedAt && <span style={{ opacity: 0.7, marginRight: 4 }}>✓</span>}
                        {t.title}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Timed tasks (with notificationTime) */}
            {todayTasks.filter(t => t.notificationTime).map((t, idx) => {
              const min = timeToMinutes(t.notificationTime!)
              const color = TASK_COLORS[idx % TASK_COLORS.length]
              return (
                <div
                  key={t.id}
                  onClick={e => {
                    e.stopPropagation()
                    setEditActivity({
                      id: '', date: selectedDate, title: t.title,
                      startTime: '09:00', endTime: '10:00', color: color,
                      recurrence: undefined, notes: '', category: '',
                      createdAt: new Date().toISOString(),
                    })
                    setShowForm(true)
                  }}
                  style={{
                    position: 'absolute', left: 52, right: 8,
                    top: (min / 60) * SLOT_H + 2,
                    height: 22,
                    background: color + 'cc',
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 8, padding: '2px 8px',
                    display: 'flex', alignItems: 'center',
                    cursor: 'pointer', overflow: 'hidden',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                    zIndex: 8 + idx,
                  }}
                  title={`${t.title}${t.completedAt ? ' ✓' : ''}`}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.completedAt && <span style={{ opacity: 0.7, marginRight: 4 }}>✓</span>}
                    {t.title}
                    <span style={{ opacity: 0.8, fontWeight: 400, marginLeft: 6, fontSize: 10 }}>
                      {fmtTime(t.notificationTime!)}
                    </span>
                  </span>
                </div>
              )
            })}

            {/* Selection rectangle */}
            {isSelecting && tempStartMin !== null && tempEndMin !== null && (
              <div style={{
                position: 'absolute', left: 44, right: 0,
                top: (tempStartMin / 60) * SLOT_H,
                height: ((tempEndMin - tempStartMin) / 60) * SLOT_H,
                background: 'var(--accent)22',
                border: '2px solid var(--accent)',
                borderLeft: '4px solid var(--accent)',
                borderRadius: 8,
                boxShadow: '0 4px 20px var(--accent)22',
                zIndex: 20,
                pointerEvents: 'none',
                transition: 'all 0.1s ease',
              }} />
            )}
            {/* Snap preview line */}
            {isSelecting && tempEndMin !== null && tempStartMin !== null && (
              <div style={{
                position: 'absolute', left: 44, right: 0,
                top: (tempEndMin / 60) * SLOT_H - 1,
                height: 2,
                background: 'var(--accent)',
                boxShadow: '0 0 8px var(--accent)44',
                zIndex: 21,
                pointerEvents: 'none',
              }} />
            )}

            {/* Current time indicator */}
            {selectedDate === toDateKey(new Date()) && (() => {
              const now = new Date()
              const min = now.getHours() * 60 + now.getMinutes()
              return (
                <div style={{
                  position: 'absolute', left: 44, right: 0, top: (min / 60) * SLOT_H,
                  borderTop: '2px solid var(--danger)', zIndex: 10, pointerEvents: 'none',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)',
                    position: 'absolute', left: -5, top: -5,
                  }} />
                </div>
              )
            })()}

            {/* Activities */}
            {activities.map((a, idx) => {
              const top      = (timeToMinutes(a.startTime) / 60) * SLOT_H
              const height   = Math.max(32, ((timeToMinutes(a.endTime) - timeToMinutes(a.startTime)) / 60) * SLOT_H)
              const dur      = timeToMinutes(a.endTime) - timeToMinutes(a.startTime)
              const color = a.color.replace('ff', 'ee') // lighter for gradient
              const gradient = `linear-gradient(135deg, ${a.color}dd 0%, ${color}88 100%)`
              return (
                <div
                  key={a.id}
                  onMouseDown={e => startDrag(e, a)}
                  onClick={e => { 
                    e.stopPropagation()
                    setEditActivity(a)
                    // Determine whether user clicked a recurring instance (this date) or the series anchor.
                    // Editing an instance should create a direct (non-recurring) override for selectedDate.
                    if (a.recurrence) {
                      // If this is a generated pseudo-instance, `anchorDate` holds the series' anchor date.
                      const isRecurrenceInstance = (a as any).isRecurrenceInstance === true
                      const anchorDate = (a as any).anchorDate as string | undefined

                      if (isRecurrenceInstance && anchorDate) {
                        // Treat as editing this occurrence only (non-recurring override).
                        // Point the form at the actual recurring series anchor.
                        setOriginalRecurringActivity({ ...(a as CalendarActivity), date: anchorDate } as CalendarActivity)
                        setEditingInstanceOfRecurring(true)
                      } else {
                        // Series anchor edit.
                        setOriginalRecurringActivity(a)
                        setEditingInstanceOfRecurring(false)
                      }
                    } else {
                      setOriginalRecurringActivity(undefined)
                      setEditingInstanceOfRecurring(false)
                    }

                    setShowForm(true) 
                  }}
                  style={{
                    position: 'absolute', left: 52, right: 8, top, height,
                    background: gradient,
                    borderLeft: `4px solid ${a.color}`,
                    borderRadius: 12, padding: '6px 10px',
                    cursor: 'grab', overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
                    zIndex: 10 + idx, userSelect: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  title={`${a.title}\n${fmtTime(a.startTime)} - ${fmtTime(a.endTime)} (${Math.round(dur/60)}h)${a.recurrence ? ' [Recurring]' : ''}`}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.title}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'rgba(255,255,255,0.9)', opacity: 0.9 }}>
                    {fmtTime(a.startTime)} – {fmtTime(a.endTime)}
                    <span style={{ opacity: 0.7, fontSize: 10 }}> ({Math.round(dur/60)}h)</span>
                  </p>
                  {a.category && (
                    <p style={{ margin: '2px 0 0 0', fontSize: 10, color: 'rgba(255,255,255,0.8)', opacity: 0.8 }}>
                      {a.category}
                    </p>
                  )}
                  {/* Resize handle */}
                  <div
                    onMouseDown={e => { e.stopPropagation(); startResize(e, a) }}
                    style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 6,
                      background: 'rgba(255,255,255,0.2)', cursor: 'ns-resize',
                      borderRadius: '0 0 10px 10px',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Activity form panel */}
{showForm && (
        <div
          style={{
            position: 'fixed',
            inset: isMobile ? 'auto 0 0 0' : '80px auto auto 0',
            right: isMobile ? 0 : 20,
            left: isMobile ? 0 : undefined,
            zIndex: 1000,
            width: isMobile ? '100%' : 320,
            maxHeight: isMobile ? 'calc(100vh - 80px)' : 'calc(100vh - 120px)',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: isMobile ? '14px 14px 0 0' : 14,
            padding: 20,
            boxShadow: 'var(--shadow-xl)',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{editActivity ? 'Edit Activity' : 'New Activity'}</h3>
            <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 18 }}
              onClick={() => { setShowForm(false); setEditActivity(undefined) }}>×</button>
          </div>
        <ActivityForm
            date={selectedDate}
            activity={editActivity
              ? editActivity
              : { id: '', title: '', date: selectedDate, startTime: newStartTime, endTime: newEndTime,
                  color: COLORS[0], createdAt: '' }
            }
            originalRecurringActivity={originalRecurringActivity}
            editingInstanceOfRecurring={editingInstanceOfRecurring}
            onSave={saveActivity}
            onCancel={() => { setShowForm(false); setEditActivity(undefined); setOriginalRecurringActivity(undefined); setEditingInstanceOfRecurring(false) }}
            onDelete={editActivity ? (scope?: 'instance') => {
              if (scope === 'instance') {
                // Pass the known recurrence as fallback in case the stored record lost it.
                const knownRecurrence = editActivity.recurrence
                  ?? (originalRecurringActivity as any)?.recurrence
                deleteSingleOccurrence(editActivity.id, selectedDate, knownRecurrence)
              } else {
                deleteActivity(editActivity.id, !!editActivity.recurrence, selectedDate)
              }
            } : undefined}
          />
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
            Duration: {Math.round((timeToMinutes(newEndTime || '10:00') - timeToMinutes(newStartTime)) / 60)}h
          </p>
        </div>
      )}
    </div>
  )
}