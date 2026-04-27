import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, generateId } from '../db/database'
import type { Habit, HabitLog, CompletedWorkout } from '../db/database'
import { formatDuration, toDateKey, startOfWeek } from '../utils'
import { sync } from '../db/sync'
import RightSidebar from '../components/RightSidebar'

// ── Completion circle (same as Workouts page) ─────────────

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

// ── Heatmap ───────────────────────────────────────────────

function buildHeatmap(logs: HabitLog[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const l of logs) { const d = toDateKey(l.completedAt); map.set(d, (map.get(d) ?? 0) + 1) }
  return map
}

function Heatmap({ logs }: { logs: HabitLog[] }) {
  const days = Array.from({ length: 364 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (363 - i)); return toDateKey(d.toISOString())
  })
  const map = buildHeatmap(logs)
  const firstDayOfWeek = new Date(days[0]).getDay() // 0=Sun, 1=Mon...6=Sat
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Convert to Monday-first: 0=Mon, 6=Sun
  const cls = (n: number) => n === 0 ? 'hm-0' : n === 1 ? 'hm-1' : n === 2 ? 'hm-2' : n <= 4 ? 'hm-3' : 'hm-4'
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        {Array(pad).fill(null).map((_, i) => <div key={`p${i}`} className="hm-cell hm-0" />)}
        {days.map(d => <div key={d} className={`hm-cell ${cls(map.get(d) ?? 0)}`} title={`${d}: ${map.get(d) ?? 0}`} />)}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>{(['hm-0','hm-1','hm-2','hm-3','hm-4'] as const).map(c => <div key={c} className={`hm-cell ${c}`} />)}<span>More</span>
      </div>
    </div>
  )
}

// ── Habit progress row ────────────────────────────────────

function HabitProgress({ habit, logs, onToggle }: { habit: Habit; logs: HabitLog[]; onToggle: (habitId: string) => void }) {
  const navigate  = useNavigate()
  const last30    = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return toDateKey(d.toISOString()) })
  const done      = last30.filter(d => logs.some(l => l.habitId === habit.id && toDateKey(l.completedAt) === d)).length
  const pct       = Math.round((done / 30) * 100)
  const today     = toDateKey(new Date().toISOString())
  const doneToday = logs.some(l => l.habitId === habit.id && toDateKey(l.completedAt) === today)
  return (
    <div className="habit-progress-row" onClick={() => navigate(`/habits/${habit.id}`)}>
      <span className="habit-dot-sm" style={{ background: habit.color, width: 12, height: 12 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <p className="item-name" style={{ fontSize: 13 }}>{habit.name}</p>
          <p className="item-sub">{pct}%</p>
        </div>
        <div className="quota-bar-track">
          <div className="quota-bar-fill" style={{ width: `${pct}%`, background: habit.color }} />
        </div>
      </div>
      <span 
        className={`done-pill ${doneToday ? 'done' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(habit.id)
        }}
        style={{ cursor: 'pointer' }}
      >
        {doneToday ? '✓' : '○'}
      </span>
    </div>
  )
}

// ── Workout row (this week only) ──────────────────────────

function WorkoutRow({ w }: { w: CompletedWorkout }) {
  const [open, setOpen] = useState(false)
  const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets  = w.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const pct       = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  return (
    <li>
      <div
        className="item-row"
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <p className="item-name">{w.workoutPlanName}</p>
            <span className="item-sub" style={{ whiteSpace: 'nowrap' }}>{formatDuration(w.totalDurationSeconds)}</span>
          </div>
          <p className="item-sub">
            {new Date(w.startedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' · '}{w.exercises.length} exercises · {doneSets}/{totalSets} sets
          </p>
        </div>
        <CompletionCircle pct={pct} />
      </div>

      {/* Toggle exercises detail */}
      {open && (
        <div style={{ padding: '8px 0 8px 12px', borderTop: '1px solid var(--border)' }}>
          {w.exercises.map((ce, i) => {
            const doneCt = ce.sets.filter(s => s.done).length
            return (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>{ce.name}</span>
                  <span style={{ color: doneCt === ce.sets.length ? '#22c55e' : 'var(--text)' }}>{doneCt}/{ce.sets.length}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </li>
  )
}

// ── Dashboard ─────────────────────────────────────────────

export default function Dashboard() {
  const [habits,   setHabits]   = useState<Habit[]>([])
  const [logs,     setLogs]     = useState<HabitLog[]>([])
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([])
  const [workoutsFromPreviousWeek, setWorkoutsFromPreviousWeek] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  const load = useCallback(async () => {
    const weekStart = startOfWeek()
    const previousWeekStart = new Date(weekStart)
    previousWeekStart.setDate(previousWeekStart.getDate() - 7)
    
    const [h, l, w] = await Promise.all([
      db.habits.filter(h => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
    ])
    setHabits(h)
    setLogs(l)
    
    // Try to get this week's workouts
    const thisWeekWorkouts = w.filter(x => new Date(x.startedAt) >= weekStart)
    
    // If no workouts this week, get last week's workouts
    if (thisWeekWorkouts.length === 0) {
      const lastWeekWorkouts = w.filter(x => {
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

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (loading) return <div className="page-loading">Loading…</div>

  const today     = toDateKey(new Date().toISOString())
  const todayLogs = logs.filter(l => toDateKey(l.completedAt) === today)
  const exCount   = workouts.reduce((s, w) => s + w.exercises.length, 0)
  const totalTime = workouts.reduce((s, w) => s + w.totalDurationSeconds, 0)

  function calcStreak() {
    const set = new Set(logs.map(l => toDateKey(l.completedAt)))
    let streak = 0; const cur = new Date()
    while (set.has(toDateKey(cur.toISOString()))) { streak++; cur.setDate(cur.getDate() - 1) }
    return streak
  }

  async function toggleHabit(habitId: string) {
    const today = toDateKey(new Date().toISOString())
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
  }

  return (
    <div className="dashboard-layout">
      {/* Main content */}
      <div className="page">
        <div className="page-header">
          <h1>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <p className="page-sub">{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <p className="page-sub" style={{ fontSize: '14px', opacity: 0.7 }}>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card"><p className="stat-label">Streak</p><p className="stat-value">{calcStreak()}d</p><p className="stat-sub">days in a row</p></div>
          <div className="stat-card"><p className="stat-label">Today</p><p className="stat-value">{todayLogs.length}/{habits.length}</p><p className="stat-sub">habits done</p></div>
          <div className="stat-card"><p className="stat-label">Exercises</p><p className="stat-value">{exCount}</p><p className="stat-sub">this week</p></div>
          <div className="stat-card"><p className="stat-label">Workout time</p><p className="stat-value">{formatDuration(totalTime)}</p><p className="stat-sub">this week</p></div>
        </div>

        {/* Workout quota */}
        <section className="card">
          <h2 className="card-title">Weekly workout goal — {workouts.length}/{weeklyTarget}</h2>
          <div className="quota-bar-track">
            <div className="quota-bar-fill" style={{
              width: `${Math.min(100, Math.round(workouts.length / weeklyTarget * 100))}%`,
              background: workouts.length >= weeklyTarget ? '#22c55e' : 'var(--accent)'
            }} />
          </div>
        </section>

        {/* Habits progress */}
        <section className="card">
          <h2 className="card-title">Habits — 30-day progress</h2>
          {habits.length === 0
            ? <p className="empty-hint">No habits yet.</p>
            : habits.map(h => <HabitProgress key={h.id} habit={h} logs={logs} onToggle={toggleHabit} />)
          }
        </section>

        {/* Heatmap */}
        <section className="card">
          <h2 className="card-title">Habit activity — last year</h2>
          {logs.length === 0 ? <p className="empty-hint">No logs yet.</p> : <Heatmap logs={logs} />}
        </section>

        {/* This week's workouts */}
        <section className="card">
          <h2 className="card-title">This week's workouts</h2>
          {workouts.length === 0
            ? <p className="empty-hint">No workouts this week yet.</p>
            : (
              <>
                {workoutsFromPreviousWeek && (
                  <p style={{ color: '#ef4444', fontWeight: 500, marginBottom: 12, fontSize: 13 }}>
                    No workouts for the current week
                  </p>
                )}
                <ul className="item-list">{workouts.map(w => <WorkoutRow key={w.id} w={w} />)}</ul>
              </>
            )
          }
        </section>
      </div>

      {/* Right sidebar */}
      <RightSidebar onDataChange={load} />
    </div>
  )
}