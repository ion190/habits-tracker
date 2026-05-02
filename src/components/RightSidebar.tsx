import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, generateId } from '../db/database'
import StartWorkoutModal from './StartWorkoutModal'
import StartWorkSessionModal from './StartWorkSessionModal'
import type { Habit, HabitLog, Task, CalendarActivity, JournalEntry } from '../db/database'
import { toDateKey, startOfWeek, formatDuration } from '../utils'
import { dateKeyForPeriod } from '../db/database'
import { sync } from '../db/sync'
import ModalPortal from './ModalPortal'

interface Props {
  onDataChange?: () => void
}

// ── Tiny mini-calendar ────────────────────────────────────
function SidebarCalendar({ onDayClick }: { onDayClick: (date: string) => void }) {
  const [viewDate, setViewDate] = useState(new Date())
  const today   = toDateKey(new Date().toISOString())
  const year    = viewDate.getFullYear()
  const month   = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const pad      = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }}
          onClick={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {viewDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 12 }}
          onClick={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
        {['M','T','W','T','F','S','S'].map((d, i) => (
          <div key={i} style={{ fontSize: 9, opacity: 0.45, padding: '1px 0', fontWeight: 600 }}>{d}</div>
        ))}
        {Array(pad).fill(null).map((_, i) => <div key={`p${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isToday = key === today
          return (
            <div key={key} onClick={() => onDayClick(key)} style={{
              padding: '3px 1px', borderRadius: 5, fontSize: 11,
              background: isToday ? 'var(--accent)' : 'transparent',
              color: isToday ? '#fff' : 'var(--text)',
              fontWeight: isToday ? 700 : 400,
              cursor: 'pointer',
            }}>{day}</div>
          )
        })}
      </div>
    </div>
  )
}

// ── Day detail popup ──────────────────────────────────────
function DayPopup({ date, activities, tasks, journal, onClose, onNavigate }: {
  date: string
  activities: CalendarActivity[]
  tasks: Task[]
  journal?: JournalEntry
  onClose: () => void
  onNavigate: (path: string) => void
}) {
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const dayActs = activities.filter(a => a.date === date)
  const dayTasks = tasks.filter(t => t.dueDate?.slice(0, 10) === date && !t.completedAt)

  return (
    <div style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 300, marginTop: 4,
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 14, width: 240,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 16 }} onClick={onClose}>×</button>
      </div>

      {/* Activities */}
      {dayActs.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {dayActs.map(a => (
            <div key={a.id} style={{ display: 'flex', gap: 6, padding: '3px 0', fontSize: 12, alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
              <span style={{ opacity: 0.5, fontSize: 10, flexShrink: 0 }}>{a.startTime}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      {dayTasks.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {dayTasks.map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 12 }}>
              <span style={{ opacity: 0.4, flexShrink: 0 }}>✅</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Journal */}
      {journal && (
        <div style={{ marginBottom: 8, padding: '5px 7px', background: 'var(--accent-bg)', borderRadius: 6, fontSize: 11 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>📅 Journal written</span>
        </div>
      )}

      {dayActs.length === 0 && dayTasks.length === 0 && !journal && (
        <p style={{ fontSize: 12, opacity: 0.5, margin: '0 0 8px' }}>Nothing scheduled</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, justifyContent: 'flex-start' }}
          onClick={() => onNavigate(`/calendar`)}>📅 Open in calendar</button>
        <button className="btn btn-ghost" style={{ fontSize: 11, justifyContent: 'flex-start' }}
          onClick={() => onNavigate(`/journal?period=daily&key=${date}`)}>📝 Journal this day</button>
      </div>
    </div>
  )
}

export default function RightSidebar({ onDataChange }: Props) {
  const navigate = useNavigate()
  const [habits,              setHabits]              = useState<Habit[]>([])
  const [logs,                setLogs]                = useState<HabitLog[]>([])
  const [tasks,               setTasks]               = useState<Task[]>([])
  const [weeklyTime,          setWeeklyTime]          = useState(0)
  const [showStart,           setShowStart]           = useState(false)
  const [showStartSession,    setShowStartSession]    = useState(false)
  const [activeExists,        setActiveExists]        = useState(false)
  const [activeSessionExists, setActiveSessionExists] = useState(false)
  const [activities,          setActivities]          = useState<CalendarActivity[]>([])
  const [journals,            setJournals]            = useState<Map<string, JournalEntry>>(new Map())
  const [popupDate,           setPopupDate]           = useState<string | null>(null)

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  async function load() {
    const weekStart = startOfWeek()
    const [h, l, t, cw, acts, js] = await Promise.all([
      db.habits.filter(h => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
      db.tasks.filter(t => !t.completedAt).toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
      db.calendarActivities.toArray(),
      db.journalEntries.where('period').equals('daily').toArray(),
    ])
    setHabits(h)
    setLogs(l)
    setTasks(t.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 5))
    setWeeklyTime(cw.filter(w => new Date(w.startedAt) >= weekStart).reduce((s, w) => s + w.totalDurationSeconds, 0))
    setActiveExists(!!localStorage.getItem('activeWorkout'))
    setActiveSessionExists(!!localStorage.getItem('activeWorkSession'))
    setActivities(acts)
    const map = new Map<string, JournalEntry>()
    js.forEach(j => map.set(j.dateKey, j))
    setJournals(map)
  }

  useEffect(() => {
    load()
    const handler = () => load()
    window.addEventListener('workSessionStatusChange', handler)
    window.addEventListener('journalUpdated', handler)
    return () => {
      window.removeEventListener('workSessionStatusChange', handler)
      window.removeEventListener('journalUpdated', handler)
    }
  }, [])

  const today = toDateKey(new Date().toISOString())
  const todayLogs = logs.filter(l => toDateKey(l.completedAt) === today)

  async function toggleHabit(habitId: string) {
    const existing = logs.find(l => l.habitId === habitId && toDateKey(l.completedAt) === today)
    if (existing) {
      await sync.delete('habitLogs', existing.id)
    } else {
      const log: HabitLog = { id: generateId(), habitId, completedAt: new Date().toISOString() }
      await sync.put('habitLogs', log as unknown as Record<string, unknown>)
    }
    load(); onDataChange?.()
  }

  const handleDayClick = (date: string) => {
    setPopupDate(prev => prev === date ? null : date)
  }

  return (
    <aside className="right-sidebar">
      {/* Today habits */}
      <div className="rs-card">
        <p className="rs-label">Today's habits</p>
        <p className="rs-big">{todayLogs.length}/{habits.length}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8 }}>
          {habits.map(h => {
            const done = logs.some(l => l.habitId === h.id && toDateKey(l.completedAt) === today)
            return (
              <div key={h.id}
                style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', padding:4, borderRadius:6, transition:'background 0.2s' }}
                onClick={() => toggleHabit(h.id)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <span style={{ width:8, height:8, borderRadius:'50%', background:h.color, flexShrink:0 }} />
                <span style={{ fontSize:12.5, color: done ? 'var(--text)' : 'var(--text-h)', textDecoration: done ? 'line-through' : 'none', flex:1 }}>{h.name}</span>
                <span style={{ fontSize:11, color: done ? '#22c55e' : 'var(--border)' }}>{done ? '✓' : '○'}</span>
              </div>
            )
          })}
          {habits.length === 0 && <p className="item-sub" style={{ textAlign:'center', padding:8 }}>No habits yet</p>}
        </div>
      </div>

      {/* Mini calendar */}
      <div className="rs-card" style={{ position: 'relative' }}>
        <p className="rs-label" style={{ marginBottom: 8 }}>Calendar</p>
        <SidebarCalendar onDayClick={handleDayClick} />
        {popupDate && (
          <DayPopup
            date={popupDate}
            activities={activities}
            tasks={tasks}
            journal={journals.get(popupDate)}
            onClose={() => setPopupDate(null)}
            onNavigate={path => { navigate(path); setPopupDate(null) }}
          />
        )}
      </div>

      {/* Upcoming tasks */}
      {tasks.length > 0 && (
        <div className="rs-card">
          <p className="rs-label">Upcoming tasks</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
            {tasks.map(t => (
              <div key={t.id}
                style={{ display:'flex', alignItems:'center', gap:8, padding:6, borderRadius:6, cursor:'pointer', transition:'all 0.2s' }}
                onClick={() => navigate(`/tasks?taskId=${t.id}`)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:12.5, color:'var(--text-h)', margin:0 }}>{t.title}</p>
                  {t.dueDate && <p className="item-sub" style={{ fontSize:11 }}>{new Date(t.dueDate).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workout button */}
      {activeExists ? (
        <div className="rs-card active-banner" onClick={() => window.location.href = '/workouts'}>
          <p className="rs-label" style={{ color:'#22c55e' }}>🏋️ Workout in progress</p>
          <p className="rs-sub">Tap to continue</p>
        </div>
      ) : (
        <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center' }} onClick={() => setShowStart(true)}>
          🏋️ Start workout
        </button>
      )}

      {/* Work session button */}
      {activeSessionExists ? (
        <div className="rs-card" style={{ borderColor:'rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.06)', cursor:'pointer' }}
          onClick={() => navigate('/work-sessions')}>
          <p className="rs-label" style={{ color:'#ef4444' }}>⏱️ Session in progress</p>
          <p className="rs-sub">Tap to continue</p>
        </div>
      ) : (
        <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'center' }}
          onClick={() => setShowStartSession(true)}>
          ⏱️ Start work session
        </button>
      )}

      {/* Work session modal */}
      {showStartSession && (
        <ModalPortal title="Start Work Session" onClose={() => setShowStartSession(false)}>
          <StartWorkSessionModal
            onClose={() => setShowStartSession(false)}
            onStarted={() => { setShowStartSession(false); navigate('/work-sessions') }}
          />
        </ModalPortal>
      )}

      {/* Weekly goal */}
      <div className="rs-card">
        <p className="rs-label">Weekly goal</p>
        <div className="quota-bar-track" style={{ marginTop:6 }}>
          <div className="quota-bar-fill" style={{
            width: `${Math.min(100, Math.round((weeklyTime > 0 ? 1 : 0) / weeklyTarget * 100))}%`,
          }} />
        </div>
        <p className="rs-sub" style={{ marginTop:4 }}>{formatDuration(weeklyTime)} this week</p>
      </div>

      {showStart && (
        <StartWorkoutModal
          onClose={() => setShowStart(false)}
          onStarted={() => { setShowStart(false); navigate('/workouts', { replace: true }) }}
        />
      )}
    </aside>
  )
}