import { useEffect, useState, useRef, useCallback } from 'react'
import { db, generateId } from '../db/database'
import type { CalendarActivity, Task, JournalEntry } from '../db/database'
import { sync } from '../db/sync'

// ── Helpers ───────────────────────────────────────────────
function toDateKey(d: Date) { return d.toISOString().slice(0, 10) }
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

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SLOT_H = 56   // px per hour
const COLORS = ['#aa3bff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316']

// ── Mini month calendar ────────────────────────────────────
function MiniCalendar({ selected, onChange }: { selected: string; onChange: (d: string) => void }) {
  const [viewDate, setViewDate] = useState(() => new Date(selected + 'T00:00:00'))
  const year  = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const pad      = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today    = toDateKey(new Date())

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
function ActivityForm({ date, activity, onSave, onCancel, onDelete }: {
  date: string
  activity?: CalendarActivity
  onSave: (a: CalendarActivity) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [title,     setTitle]     = useState(activity?.title ?? '')
  const [startTime, setStartTime] = useState(activity?.startTime ?? '09:00')
  const [endTime,   setEndTime]   = useState(activity?.endTime ?? '10:00')
  const [color,     setColor]     = useState(activity?.color ?? COLORS[0])
  const [notes,     setNotes]     = useState(activity?.notes ?? '')
  const [category,  setCategory]  = useState(activity?.category ?? '')

  const save = () => {
    if (!title.trim()) return
    const a: CalendarActivity = {
      id:        activity?.id ?? generateId(),
      title:     title.trim(),
      date,
      startTime,
      endTime:   endTime > startTime ? endTime : minutesToTime(timeToMinutes(startTime) + 60),
      color,
      notes:     notes.trim() || undefined,
      category:  category.trim() || undefined,
      createdAt: activity?.createdAt ?? new Date().toISOString(),
    }
    onSave(a)
  }

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

      <div className="form-actions">
        {onDelete && (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }}
            onClick={onDelete}>🗑 Delete</button>
        )}
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={!title.trim()}>
          {activity ? 'Update' : 'Add Activity'}
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
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 16, width: 260,
      boxShadow: 'var(--shadow)',
    }}>
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
  const scrollRef   = useRef<HTMLDivElement>(null)
  const dragRef     = useRef<{ id: string; offsetMin: number } | null>(null)
  const resizeRef   = useRef<{ id: string; field: 'start' | 'end' } | null>(null)

  const load = useCallback(async () => {
    const [acts, ts, js] = await Promise.all([
      db.calendarActivities.where('date').equals(selectedDate).toArray(),
      db.tasks.toArray(),
      db.journalEntries.where('period').equals('daily').toArray(),
    ])
    setActivities(acts.sort((a, b) => a.startTime.localeCompare(b.startTime)))
    setTasks(ts)
    const map = new Map<string, JournalEntry>()
    js.forEach(j => map.set(j.dateKey, j))
    setJournals(map)
  }, [selectedDate])

  useEffect(() => {
    load()
  }, [selectedDate])

  useEffect(() => {
    // Scroll to 7am on mount
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: 7 * SLOT_H, behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timeout)
  }, [])

    const saveActivity = async (a: CalendarActivity) => {
    const record = { ...a, id: a.id || generateId() }
    await sync.put('calendarActivities', record as unknown as Record<string, unknown>)
    setActivities(prev => {
      const idx = prev.findIndex(x => x.id === record.id)
      return idx >= 0 ? prev.map(x => x.id === record.id ? record : x) : [...prev, record]
    })
    setShowForm(false); setEditActivity(undefined)
  }

    const deleteActivity = async (id: string) => {
    await sync.delete('calendarActivities', id)
    setActivities(prev => prev.filter(a => a.id !== id))
    setShowForm(false); setEditActivity(undefined)
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

  // ── Drag rectangle selection ──────────────────────────────
  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current || resizeRef.current || e.button !== 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    const startY = e.clientY - rect.top
    setTempStartMin(Math.round((startY / SLOT_H) * 4) * 15) // snap 15min
    setSelection({ startY, currentY: startY })
    setIsSelecting(true)
    e.preventDefault()
  }

  const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selection || tempStartMin === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const currentY = e.clientY - rect.top
    setSelection({ ...selection, currentY })
    const rawEndMin = Math.round((currentY / SLOT_H) * 4) * 15
    setTempEndMin(Math.max(tempStartMin + 15, Math.min(24*60 - 15, rawEndMin)))
  }

    const handleGridMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selection || tempStartMin === null) return

    setIsSelecting(false)
    setSelection(null)
    setTempStartMin(null)
    setTempEndMin(null)

    const startMin = tempStartMin!
    const endMin = tempEndMin ?? Math.max(startMin + 15, Math.min(24*60 - 15, Math.round((e.clientY - e.currentTarget.getBoundingClientRect().top) / SLOT_H * 4) * 15))

    setNewStartTime(minutesToTime(startMin))
    setNewEndTime(minutesToTime(endMin))
    setEditActivity(undefined)
    setShowForm(true)
  }

  // ── Single click fallback (right-click or modifier?) - keep old logic as fallback if needed

  // ── Drag to move ─────────────────────────────────────────
  const startDrag = (e: React.MouseEvent, a: CalendarActivity) => {
    e.stopPropagation()
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
      padding: '16px 20px' 
    }}>

      {/* Left panel */}
      <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <div style={{ position: 'relative' }}>
          <MiniCalendar selected={selectedDate} onChange={d => { setSelectedDate(d); setShowDayTip(false) }} />

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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Day header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
          <button className="btn btn-ghost" style={{ padding: '4px 10px' }}
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00')
              d.setDate(d.getDate() - 1)
              setSelectedDate(toDateKey(d))
            }}>←</button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })}
          </h2>
          <button className="btn btn-ghost" style={{ padding: '4px 10px' }}
            onClick={() => {
              const d = new Date(selectedDate + 'T00:00:00')
              d.setDate(d.getDate() + 1)
              setSelectedDate(toDateKey(d))
            }}>→</button>
          {selectedDate !== toDateKey(new Date()) && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }}
              onClick={() => setSelectedDate(toDateKey(new Date()))}>Today</button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.5 }}>
            {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div
            className="cal-grid"
            onMouseDown={handleGridMouseDown}
            onMouseMove={handleGridMouseMove}
            onMouseUp={handleGridMouseUp}
            onMouseLeave={(e) => {
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
                  onClick={e => { e.stopPropagation(); setEditActivity(a); setShowForm(true) }}
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
                  title={`${a.title}\n${fmtTime(a.startTime)} - ${fmtTime(a.endTime)} (${Math.round(dur/60)}h)`}
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
        <div style={{
          position: 'fixed', top: 80, right: 20, zIndex: 1000,
          width: 320, maxHeight: 'calc(100vh - 120px)',
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, 
          padding: 20, boxShadow: 'var(--shadow-xl)', overflowY: 'auto',
        }}>
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
            onSave={saveActivity}
            onCancel={() => { setShowForm(false); setEditActivity(undefined) }}
            onDelete={editActivity ? () => deleteActivity(editActivity.id) : undefined}
          />
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
            Duration: {Math.round((timeToMinutes(newEndTime || '10:00') - timeToMinutes(newStartTime)) / 60)}h
          </p>
        </div>
      )}
    </div>
  )
}

