import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/database'
import type { Habit, HabitLog, CompletedWorkout } from '../db/database'
import { formatDuration, toDateKey, startOfWeek } from '../utils'

function buildHeatmap(logs: HabitLog[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const log of logs) { const d = toDateKey(log.completedAt); map.set(d, (map.get(d) ?? 0) + 1) }
  return map
}

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return toDateKey(d.toISOString())
  })
}

function Heatmap({ logs }: { logs: HabitLog[] }) {
  const days = getLastNDays(364); const map = buildHeatmap(logs); const pad = new Date(days[0]).getDay()
  const cls = (n: number) => n === 0 ? 'hm-0' : n === 1 ? 'hm-1' : n === 2 ? 'hm-2' : n <= 4 ? 'hm-3' : 'hm-4'
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        {Array(pad).fill(null).map((_, i) => <div key={`p${i}`} className="hm-cell hm-0" />)}
        {days.map(day => <div key={day} className={`hm-cell ${cls(map.get(day) ?? 0)}`} title={`${day}: ${map.get(day) ?? 0}`} />)}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>{(['hm-0','hm-1','hm-2','hm-3','hm-4'] as const).map(c => <div key={c} className={`hm-cell ${c}`} />)}<span>More</span>
      </div>
    </div>
  )
}

function HabitProgress({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const navigate = useNavigate()
  const last30 = Array.from({ length: 30 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return toDateKey(d.toISOString()) })
  const done = last30.filter(d => logs.some(l => l.habitId === habit.id && toDateKey(l.completedAt) === d)).length
  const pct = Math.round((done / 30) * 100)
  const today = toDateKey(new Date().toISOString())
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
      <span className={`done-pill ${doneToday ? 'done' : ''}`}>{doneToday ? '✓' : '○'}</span>
    </div>
  )
}

export default function Dashboard() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  useEffect(() => {
    async function load() {
      const [h, l, w] = await Promise.all([
        db.habits.filter(h => !h.archivedAt).toArray(),
        db.habitLogs.toArray(),
        db.completedWorkouts.orderBy('startedAt').reverse().limit(8).toArray(),
      ])
      setHabits(h); setLogs(l); setWorkouts(w); setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="page-loading">Loading…</div>

  const today = toDateKey(new Date().toISOString())
  const weekStart = startOfWeek()
  const todayLogs = logs.filter(l => toDateKey(l.completedAt) === today)
  const thisWeek = workouts.filter(w => new Date(w.startedAt) >= weekStart)
  const exThisWeek = thisWeek.reduce((s, w) => s + w.exercises.length, 0)

  function calcStreak() {
    const set = new Set(logs.map(l => toDateKey(l.completedAt)))
    let streak = 0; const cur = new Date()
    while (set.has(toDateKey(cur.toISOString()))) { streak++; cur.setDate(cur.getDate() - 1) }
    return streak
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-sub">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="stats-row">
        <div className="stat-card"><p className="stat-label">Streak</p><p className="stat-value">{calcStreak()}d</p><p className="stat-sub">days in a row</p></div>
        <div className="stat-card"><p className="stat-label">Today</p><p className="stat-value">{todayLogs.length}/{habits.length}</p><p className="stat-sub">habits done</p></div>
        <div className="stat-card"><p className="stat-label">Exercises</p><p className="stat-value">{exThisWeek}</p><p className="stat-sub">this week</p></div>
        <div className="stat-card"><p className="stat-label">Workout time</p><p className="stat-value">{formatDuration(thisWeek.reduce((s, w) => s + w.totalDurationSeconds, 0))}</p><p className="stat-sub">this week</p></div>
      </div>

      <section className="card">
        <h2 className="card-title">Weekly workout goal — {thisWeek.length}/{weeklyTarget}</h2>
        <div className="quota-bar-track">
          <div className="quota-bar-fill" style={{ width: `${Math.min(100, Math.round(thisWeek.length / weeklyTarget * 100))}%`, background: thisWeek.length >= weeklyTarget ? '#22c55e' : 'var(--accent)' }} />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">All habits — 30-day progress</h2>
        {habits.length === 0 ? <p className="empty-hint">No habits yet.</p> : habits.map(h => <HabitProgress key={h.id} habit={h} logs={logs} />)}
      </section>

      <section className="card">
        <h2 className="card-title">Habit activity — last year</h2>
        {logs.length === 0 ? <p className="empty-hint">No logs yet.</p> : <Heatmap logs={logs} />}
      </section>

      <section className="card">
        <h2 className="card-title">Recent workouts</h2>
        {workouts.length === 0 ? <p className="empty-hint">No completed workouts yet.</p> : (
          <ul className="item-list">
            {workouts.map(w => {
              const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
              const doneSets  = w.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
              return (
                <li key={w.id} className="item-row">
                  <div style={{ flex: 1 }}>
                    <p className="item-name">{w.workoutPlanName}</p>
                    <p className="item-sub">
                      {new Date(w.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' · '}{formatDuration(w.totalDurationSeconds)}
                      {' · '}{w.exercises.length} exercises · {doneSets}/{totalSets} sets
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}