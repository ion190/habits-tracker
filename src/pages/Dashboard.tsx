import { useEffect, useState, useCallback } from 'react'
import { db, generateId } from '../db/database'
import type { Habit, HabitLog, CompletedWorkout, Task } from '../db/database'
import { formatDuration, toDateKey, startOfWeek } from '../utils'
import { sync } from '../db/sync'
import UnifiedHeatmap from '../components/UnifiedHeatmap'
import HabitValueModal from '../components/HabitValueModal'

function CompletionCircle({ pct }: { pct: number }) {
  const r = 16; const circ = 2 * Math.PI * r
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fill={color} fontSize="10" fontWeight="600">{pct}%</text>
    </svg>
  )
}

function WorkoutRow({ w }: { w: CompletedWorkout }) {
  const [open, setOpen] = useState(false)
  const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets = w.exercises.reduce((s, e) => s + e.sets.filter((st) => st.done).length, 0)
  const pct = Math.round(totalSets > 0 ? (doneSets / totalSets) * 100 : 0)
  return (
    <li>
      <div className="item-row" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, flexWrap: 'wrap' }}>
            <p className="item-name">{w.workoutPlanName}</p>
            <span className="item-sub" style={{ whiteSpace: 'nowrap' }}>
              {formatDuration(w.totalDurationSeconds)}
            </span>
          </div>
          <p className="item-sub">
            {new Date(w.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' \u00b7 '}{w.exercises.length} exercises \u00b7 {doneSets}/{totalSets} sets
          </p>
        </div>
        <CompletionCircle pct={pct} />
      </div>
      {open && (
        <div style={{ padding: '8px 0 8px 12px', borderTop: '1px solid var(--border)' }}>
          {w.exercises.map((ce, i) => {
            const doneCt = ce.sets.filter((s) => s.done).length
            return (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>{ce.name}</span>
                  <span style={{ color: doneCt === ce.sets.length ? '#22c55e' : 'var(--text)' }}>
                    {doneCt}/{ce.sets.length}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </li>
  )
}

export default function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([])
  const [allWorkouts, setAllWorkouts] = useState<CompletedWorkout[]>([])
  const [workoutsFromPreviousWeek, setWorkoutsFromPreviousWeek] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [valueModalHabit, setValueModalHabit] = useState<Habit | null>(null)

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  const load = useCallback(async () => {
    const weekStart = startOfWeek()
    const previousWeekStart = new Date(weekStart)
    previousWeekStart.setDate(previousWeekStart.getDate() - 7)

    const [h, l, w, t] = await Promise.all([
      db.habits.filter((h) => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
      db.tasks.filter((t) => !t.archivedAt).toArray(),
    ])
    setHabits(h)
    setLogs(l)
    setAllWorkouts(w)
    setTasks(t)

    const thisWeekWorkouts = w.filter((x) => new Date(x.startedAt) >= weekStart)

    if (thisWeekWorkouts.length === 0) {
      const lastWeekWorkouts = w.filter((x) => {
        const date = new Date(x.startedAt)
        return date >= previousWeekStart && date < weekStart
      })
      setWorkouts(lastWeekWorkouts)
      setWorkoutsFromPreviousWeek(true)
    } else {
      setWorkouts(thisWeekWorkouts)
      setWorkoutsFromPreviousWeek(false)
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (loading) return <div className="page-loading">Loading\u2026</div>

  const today = toDateKey(new Date().toISOString())
  const todayLogs = logs.filter((l) => toDateKey(l.completedAt) === today)

  const todaysTasks = tasks.filter((t) => {
    if (t.completedAt) return false
    if (!t.dueDate) return false
    return toDateKey(t.dueDate) === today
  })

  const weekWorkouts = workoutsFromPreviousWeek ? [] : workouts
  const currentWeekTime = weekWorkouts.reduce((s, w) => s + w.totalDurationSeconds, 0)

  async function toggleHabit(habitId: string, value?: number) {
    const existing = logs.find((l) => l.habitId === habitId && toDateKey(l.completedAt) === today)
    if (existing) {
      await sync.delete('habitLogs', existing.id)
    } else {
      const log: HabitLog = {
        id: generateId(),
        habitId,
        completedAt: new Date().toISOString(),
        value,
      }
      await sync.put('habitLogs', log as unknown as Record<string, unknown>)
    }
    load()
  }

  function handleHabitClick(habitId: string) {
    const habit = habits.find(h => h.id === habitId)
    if (!habit) return

    const existing = logs.find(l => l.habitId === habitId && toDateKey(l.completedAt) === today)
    if (existing) {
      // Undo - no value needed
      toggleHabit(habitId)
      return
    }

    if (habit.quota) {
      setValueModalHabit(habit)
    } else {
      toggleHabit(habitId)
    }
  }

  function handleValueSave(value: number) {
    if (!valueModalHabit) return
    toggleHabit(valueModalHabit.id, value)
    setValueModalHabit(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="header-time">
          <p className="page-sub">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <p className="page-sub time-sub time-stylish">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Habits</p>
          <p className="stat-value">{todayLogs.length}/{habits.length}</p>
          <p className="stat-sub">done today</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Tasks</p>
          <p className="stat-value">{todaysTasks.length}</p>
          <p className="stat-sub">for today</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Workout time</p>
          <p className="stat-value">{formatDuration(currentWeekTime)}</p>
          <p className="stat-sub">this week</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Workouts</p>
          <p className="stat-value">{weekWorkouts.length}</p>
          <p className="stat-sub">this week</p>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Weekly workout goal: {weekWorkouts.length}/{weeklyTarget}</h2>
        <div className="quota-bar-track">
          <div
            className="quota-bar-fill"
            style={{
              width: `${Math.min(100, Math.round((weekWorkouts.length / weeklyTarget) * 100))}%`,
              background: weekWorkouts.length >= weeklyTarget ? '#22c55e' : 'var(--accent)',
            }}
          />
        </div>
      </section>

      <section className="card habit-quick-card">
        <h2 className="card-title">Today&apos;s habits</h2>
        {habits.length === 0 ? (
          <p className="empty-hint">No habits yet.</p>
        ) : (
          <div className="habit-quick-row">
            {habits.map((h) => {
              const done = logs.some((l) => l.habitId === h.id && toDateKey(l.completedAt) === today)
              return (
                <button
                  key={h.id}
                  className={`habit-quick-pill ${done ? 'done' : ''}`}
                  onClick={() => handleHabitClick(h.id)}
                  title={h.name}
                >
                  <span className="habit-dot-sm" style={{ background: h.color }} />
                  <span className="habit-quick-name">{h.name}</span>
                  <span className="habit-quick-check">{done ? '\u2713' : '\u25cb'}</span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {valueModalHabit && (
        <HabitValueModal
          habitName={valueModalHabit.name}
          quotaType={valueModalHabit.quota!.type}
          unit={valueModalHabit.quota!.unit}
          onSave={handleValueSave}
          onClose={() => setValueModalHabit(null)}
        />
      )}

      <section className="card heatmap-card">
        <h2 className="card-title">Activity: last year</h2>
        {logs.length === 0 && allWorkouts.length === 0 ? (
          <p className="empty-hint">No activity yet. Start logging habits and workouts!</p>
        ) : (
          <UnifiedHeatmap habits={habits} logs={logs} workouts={allWorkouts} />
        )}
      </section>

      <section className="card">
        <h2 className="card-title">
          {workoutsFromPreviousWeek ? "Last week\u2019s workouts" : "This week\u2019s workouts"}
        </h2>
        {workouts.length === 0 ? (
          <p className="empty-hint">No workouts this week yet.</p>
        ) : (
          <>
            {workoutsFromPreviousWeek && (
              <p style={{ color: '#ef4444', fontWeight: 500, marginBottom: 12, fontSize: 13 }}>
                No workouts for the current week: showing last week
              </p>
            )}
            <ul className="item-list">
              {workouts.map((w) => (
                <WorkoutRow key={w.id} w={w} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

