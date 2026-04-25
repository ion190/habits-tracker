import { useEffect, useState } from 'react'
import { db } from '../db/database'
import type { Habit, HabitLog, CompletedWorkout } from '../db/database'
import { formatDuration, toDateKey, startOfWeek } from '../utils'

// ── Heatmap ───────────────────────────────────────────────

function buildHeatmap(logs: HabitLog[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const log of logs) {
    const day = toDateKey(log.completedAt)
    map.set(day, (map.get(day) ?? 0) + 1)
  }
  return map
}

function getLastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(toDateKey(d.toISOString()))
  }
  return days
}

function intensityClass(count: number) {
  if (count === 0) return 'hm-0'
  if (count === 1) return 'hm-1'
  if (count === 2) return 'hm-2'
  if (count <= 4)  return 'hm-3'
  return 'hm-4'
}

function Heatmap({ logs }: { logs: HabitLog[] }) {
  const days      = getLastNDays(364)
  const map       = buildHeatmap(logs)
  const firstDow  = new Date(days[0]).getDay()
  const padded    = [...Array(firstDow).fill(null), ...days]

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        {padded.map((day, i) =>
          day === null
            ? <div key={`pad-${i}`} className="hm-cell hm-0" />
            : <div
                key={day}
                className={`hm-cell ${intensityClass(map.get(day) ?? 0)}`}
                title={`${day}: ${map.get(day) ?? 0} completions`}
              />
        )}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {(['hm-0','hm-1','hm-2','hm-3','hm-4'] as const).map(c => (
          <div key={c} className={`hm-cell ${c}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

// ── Quota progress bar ────────────────────────────────────

function QuotaBar({ done, target }: { done: number; target: number }) {
  const pct = Math.min(100, Math.round((done / Math.max(target, 1)) * 100))
  return (
    <div className="quota-bar-wrap">
      <div className="quota-bar-track">
        <div
          className="quota-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="quota-label">{done}/{target} this week</span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────

export default function Dashboard() {
  const [habits,   setHabits]   = useState<Habit[]>([])
  const [logs,     setLogs]     = useState<HabitLog[]>([])
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([])
  const [loading,  setLoading]  = useState(true)

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  useEffect(() => {
    async function load() {
      const [h, l, w] = await Promise.all([
        db.habits.toArray(),
        db.habitLogs.toArray(),
        db.completedWorkouts.orderBy('startedAt').reverse().limit(8).toArray(),
      ])
      setHabits(h)
      setLogs(l)
      setWorkouts(w)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="page-loading">Loading…</div>

  const today        = toDateKey(new Date().toISOString())
  const weekStart    = startOfWeek()
  const activeHabits = habits.filter(h => !h.archivedAt)
  const todayLogs    = logs.filter(l => toDateKey(l.completedAt) === today)

  const workoutsThisWeek = workouts.filter(
    w => new Date(w.startedAt) >= weekStart
  )

  // Total exercises done this week (sum across sessions)
  const exercisesThisWeek = workoutsThisWeek.reduce(
    (sum, w) => sum + w.exercises.length, 0
  )

  // Simple streak: consecutive days back from today with at least one log
  function calcStreak(): number {
    const set = new Set(logs.map(l => toDateKey(l.completedAt)))
    let streak = 0
    const cur  = new Date()
    while (true) {
      const key = toDateKey(cur.toISOString())
      if (!set.has(key)) break
      streak++
      cur.setDate(cur.getDate() - 1)
    }
    return streak
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-sub">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <StatCard label="Streak"         value={`${calcStreak()}d`}           sub="days in a row" />
        <StatCard label="Today"          value={`${todayLogs.length}/${activeHabits.length}`} sub="habits done" />
        <StatCard label="Exercises"      value={exercisesThisWeek}            sub="this week" />
        <StatCard label="Workout time"
          value={formatDuration(workoutsThisWeek.reduce((s, w) => s + w.totalDurationSeconds, 0))}
          sub="this week"
        />
      </div>

      {/* Workout quota */}
      <section className="card">
        <h2 className="card-title">Weekly workout goal</h2>
        <QuotaBar done={workoutsThisWeek.length} target={weeklyTarget} />
      </section>

      {/* Heatmap */}
      <section className="card">
        <h2 className="card-title">Habit activity — last year</h2>
        {logs.length === 0
          ? <p className="empty-hint">No logs yet. Tick a habit to see your map.</p>
          : <Heatmap logs={logs} />
        }
      </section>

      {/* Recent workouts */}
      <section className="card">
        <h2 className="card-title">Recent workouts</h2>
        {workouts.length === 0
          ? <p className="empty-hint">No completed workouts yet.</p>
          : (
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
                        {' · '}{w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}
                        {' · '}{doneSets}/{totalSets} sets
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        }
      </section>
    </div>
  )
}