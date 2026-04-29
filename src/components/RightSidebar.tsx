import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import type { Habit, HabitLog, Task } from '../db/database'
import { toDateKey, startOfWeek, formatDuration } from '../utils'
import { sync } from '../db/sync'
import StartWorkoutModal from './StartWorkoutModal'
import ActiveWorkout from './ActiveWorkout'

interface Props {
  onDataChange?: () => void
}

export default function RightSidebar({ onDataChange }: Props) {
  const [habits,       setHabits]       = useState<Habit[]>([])
  const [logs,         setLogs]         = useState<HabitLog[]>([])
  const [tasks,        setTasks]        = useState<Task[]>([])
  const [weeklyTime,   setWeeklyTime]   = useState(0)
  const [monthlyTime,  setMonthlyTime]  = useState(0)
  const [showStart,    setShowStart]    = useState(false)
  const [activeExists, setActiveExists] = useState(false)
  const [showActive,   setShowActive]   = useState(false)

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  async function load() {
    const weekStart  = startOfWeek()
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

    const [h, l, t, cw] = await Promise.all([
      db.habits.filter(h => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
      db.tasks.filter(t => !t.completedAt).toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
    ])

    setHabits(h)
    setLogs(l)
    setTasks(t.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')).slice(0, 5))
    setWeeklyTime(cw.filter(w => new Date(w.startedAt) >= weekStart).reduce((s, w) => s + w.totalDurationSeconds, 0))
    setMonthlyTime(cw.filter(w => new Date(w.startedAt) >= monthStart).reduce((s, w) => s + w.totalDurationSeconds, 0))
    setActiveExists(!!localStorage.getItem('activeWorkout'))
  }

  useEffect(() => { load() }, [])

  const today      = toDateKey(new Date().toISOString())
  const todayLogs  = logs.filter(l => toDateKey(l.completedAt) === today)

  async function toggleHabit(habitId: string) {
    const existing = logs.find(l => l.habitId === habitId && toDateKey(l.completedAt) === today)
    
    if (existing) {
      await sync.delete('habitLogs', existing.id)
    } else {
      const log: HabitLog = {
        id: generateId(),
        habitId,
        completedAt: new Date().toISOString(),
      }
      await sync.put('habitLogs', log as unknown as Record<string, unknown>)
    }
    load()
    onDataChange?.()
  }

  return (
    <aside className="right-sidebar">

      

      {/* Today habits */}
      <div className="rs-card">
        <p className="rs-label">Today's habits</p>
        <p className="rs-big">{todayLogs.length}/{habits.length}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {habits.map(h => {
            const done = logs.some(l => l.habitId === h.id && toDateKey(l.completedAt) === today)
            return (
              <div 
                key={h.id} 
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'background 0.2s' }}
                onClick={() => toggleHabit(h.id)}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border)'}
                onMouseLeave={(e) => e.currentTarget.style.background = ''}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: h.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: done ? 'var(--text)' : 'var(--text-h)', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>{h.name}</span>
                <span style={{ fontSize: 11, color: done ? '#22c55e' : 'var(--border)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleHabit(h.id) }}>{done ? '✓' : '○'}</span>
              </div>
            )
          })}
          {habits.length === 0 && <p className="item-sub" style={{ textAlign: 'center', padding: 8 }}>No habits yet</p>}
        </div>
      </div>

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="rs-card">
          <p className="rs-label">Upcoming tasks</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {tasks.map(t => (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: 12.5, color: 'var(--text-h)', margin: 0 }}>{t.title}</p>
                {t.dueDate && <p className="item-sub" style={{ fontSize: 11 }}>{new Date(t.dueDate).toLocaleDateString()}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active / start workout */}
      {activeExists
        ? (
          <div className="rs-card active-banner" onClick={() => setShowActive(true)}>
            <p className="rs-label" style={{ color: '#22c55e' }}>🏋️ Workout in progress</p>
            <p className="rs-sub">Tap to continue</p>
          </div>
        )
        : (
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 4 }}
            onClick={() => setShowStart(true)}>
            🏋️ Start workout
          </button>
        )
      }

      {/* Time stats */}
      {/* <div className="rs-card">
        <p className="rs-label">This week</p>
        <p className="rs-stat">{formatDuration(weeklyTime)}</p>
        <p className="rs-label" style={{ marginTop: 8 }}>This month</p>
        <p className="rs-stat">{formatDuration(monthlyTime)}</p>
      </div> */}

      {/* Weekly goal mini */}
      <div className="rs-card">
        <p className="rs-label">Weekly goal</p>
        <div className="quota-bar-track" style={{ marginTop: 6 }}>
          <div className="quota-bar-fill" style={{
            width: `${Math.min(100, Math.round((weeklyTime > 0 ? 1 : 0) / weeklyTarget * 100))}%`,
          }} />
        </div>
        <p className="rs-sub" style={{ marginTop: 4 }}>{formatDuration(weeklyTime)} this week</p>
      </div>

      {/* Modals */}
      {showStart && (
        <StartWorkoutModal
          onClose={() => setShowStart(false)}
          onStarted={() => { setActiveExists(true); setShowActive(true); load(); onDataChange?.() }}
        />
      )}

      {showActive && (
        <div className="active-overlay">
          <ActiveWorkout
            onFinished={() => { setShowActive(false); setActiveExists(false); load(); onDataChange?.() }}
            onDiscard={() => { setShowActive(false); setActiveExists(false); load() }}
          />
        </div>
      )}
    </aside>
  )
}