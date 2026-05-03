import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, generateId, dateKeyForPeriod } from '../db/database'
import type { CalendarActivity, CompletedWorkSession, WorkSessionCategory, JournalEntry, Habit, HabitLog, CompletedWorkout, Task } from '../db/database'
import { formatDuration, toDateKey, startOfWeek } from '../utils'
import { sync } from '../db/sync'
import UnifiedHeatmap from '../components/UnifiedHeatmap'
import HabitValueModal from '../components/HabitValueModal'
import StartWorkoutModal from '../components/StartWorkoutModal'
import StartWorkSessionModal from '../components/StartWorkSessionModal'
import ModalPortal from '../components/ModalPortal'

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
            {' \u00b7 '}{w.exercises.length} exercises {' \u00b7 '} {doneSets}/{totalSets} sets
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
  const navigate = useNavigate()
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [workouts, setWorkouts] = useState<CompletedWorkout[]>([])
  const [allWorkouts, setAllWorkouts] = useState<CompletedWorkout[]>([])
  const [workoutsFromPreviousWeek, setWorkoutsFromPreviousWeek] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [valueModalHabit, setValueModalHabit] = useState<Habit | null>(null)
  const [showStartWorkout, setShowStartWorkout] = useState(false)
  const [showStartSession, setShowStartSession] = useState(false)
  const [workSessions, setWorkSessions] = useState<CompletedWorkSession[]>([])
  const [workSessionCategories, setWorkSessionCategories] = useState<WorkSessionCategory[]>([])
  const [activeWorkSession, setActiveWorkSession] = useState(null)
  const [todayJournal, setTodayJournal] = useState<JournalEntry | null>(null)
  const [activities, setActivities] = useState<CalendarActivity[]>([])
  const [todaysActivities, setTodaysActivities] = useState<CalendarActivity[]>([])
  const [todaysFutureActivities, setTodaysFutureActivities] = useState<CalendarActivity[]>([])
  const [tomorrowActivities, setTomorrowActivities] = useState<CalendarActivity[]>([])
  const [tomorrowKey, setTomorrowKey] = useState('')
  const [now, setNow] = useState(new Date())

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  const load = useCallback(async () => {
    const weekStart = startOfWeek()
    const previousWeekStart = new Date(weekStart)
    previousWeekStart.setDate(previousWeekStart.getDate() - 7)

    const [h, l, w, t, ws, wsc, acts] = await Promise.all([
      db.habits.filter((h) => !h.archivedAt).toArray(),
      db.habitLogs.toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
      db.tasks.filter((t) => !t.archivedAt).toArray(),
      db.completedWorkSessions.where('startedAt').aboveOrEqual(startOfWeek().toISOString()).toArray(),
      db.workSessionCategories.toArray(),
      db.calendarActivities.toArray(),
    ])
    setActivities(acts)
    setHabits(h)
    setLogs(l)
    setAllWorkouts(w)
    setTasks(t)
    setWorkSessions(ws)
    setWorkSessionCategories(wsc)

    const todayKeyLocal = dateKeyForPeriod('daily')
    const tomorrowDate = new Date()
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowKeyLocal = toDateKey(tomorrowDate.toISOString())
    setTomorrowKey(tomorrowKeyLocal)

    const todaysAll = acts.filter(a => a.date === todayKeyLocal)
    
    // Split today's into past/completed vs future
    const futureTodays = todaysAll.filter(a => {
      const startDateTime = new Date(todayKeyLocal + 'T' + a.startTime + ':00')
      return startDateTime > now
    })
    const pastTodays = todaysAll.filter(a => {
      const endDateTime = new Date(todayKeyLocal + 'T' + a.endTime + ':00')
      return endDateTime < now
    })
    
    const tomorrowActs = acts.filter(a => a.date === tomorrowKeyLocal)
    setTodaysActivities([...futureTodays, ...pastTodays]) // Future first
    setTodaysFutureActivities(futureTodays)
    setTomorrowActivities(tomorrowActs)
    const jEntry = await db.journalEntries.filter(e => e.period === 'daily' && e.dateKey === todayKeyLocal).first()
    setTodayJournal(jEntry ?? null)

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
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      setNow(new Date())
    }, 1000 * 30) // Update every 30s for activity status
    return () => clearInterval(timer)
  }, [])

  if (loading) return <div className="page-loading">Loading…</div>

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
          <p className="stat-label">Journal</p>
          <p className="stat-value">{todayJournal ? '✍️' : '—'}</p>
          <p className="stat-sub" style={{ color: todayJournal ? '#22c55e' : undefined }}>
            {todayJournal ? 'written today' : 'not written'}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Tasks</p>
          <p className="stat-value">{todaysTasks.length}</p>
          <p className="stat-sub">for today</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Workouts</p>
          <p className="stat-value">{weekWorkouts.length}/{weeklyTarget}</p>
          <p className="stat-sub">this week</p>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Today's Activities</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
          {todaysActivities.length === 0 ? (
            <>
              <p className="empty-hint" style={{ marginBottom: 12 }}>No activities planned today</p>
              {tomorrowActivities.length > 0 && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8, fontWeight: 500 }}>Tomorrow</p>
                  {tomorrowActivities.map((a) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--card-bg)', borderRadius: 8 }}>
                      <span className="habit-dot-sm" style={{ background: a.color || '#3b82f6' }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 500 }}>{a.title}</span>
                        <span style={{ color: 'var(--text-dim)', fontSize: 13 }}> {a.startTime}–{a.endTime}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          ) : (
            todaysActivities.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--card-bg)', borderRadius: 8 }}>
                <span className="habit-dot-sm" style={{ background: a.color || '#3b82f6' }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 500 }}>{a.title}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}> {a.startTime}–{a.endTime}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {todaysTasks.length > 0 && (
        <section className="card">
          <h2 className="card-title">Today's Tasks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
            {todaysTasks.map((task) => (
              <div key={task.id} style={{ padding: 8, background: 'var(--card-bg)', borderRadius: 8, cursor: 'pointer' }} 
                   onClick={() => navigate('/tasks?taskId=' + task.id)}>
                <span style={{ fontWeight: 500 }}>{task.title}</span>
                {task.tags.length > 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>
                    {task.tags.map(t => '#' + t).join(' ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
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

{showStartWorkout && (
        <ModalPortal title="Start workout" onClose={() => setShowStartWorkout(false)}>
          <StartWorkoutModal 
            onClose={() => setShowStartWorkout(false)} 
            onStarted={() => { setShowStartWorkout(false); navigate('/workouts', { replace: true }) }} 
          />
        </ModalPortal>
      )}

{showStartSession && (
        <ModalPortal title="Start Work Session" onClose={() => setShowStartSession(false)}>
          <StartWorkSessionModal
            onClose={() => setShowStartSession(false)}
            onStarted={() => {
              setShowStartSession(false)
            }}
          />
        </ModalPortal>
      )}

      <section className="card heatmap-card">
        <h2 className="card-title">Activity: last year</h2>
{logs.length === 0 && allWorkouts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p className="empty-hint" style={{ marginBottom: 16 }}>No activity yet. Start logging habits and workouts!</p>
            <button 
              className="btn btn-secondary" 
              style={{ fontSize: 13 }}
              onClick={async () => {
                await import('../utils/sampleData').then(m => m.populateSampleData())
                load()
              }}
              title="Adds historical data for heatmap demos"
            >
              💾 Load Demo Data
            </button>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12 }}>
              Adds habits, logs, tasks across 1 year for testing heatmaps
            </p>
          </div>
        ) : (
          <UnifiedHeatmap habits={habits} logs={logs} workouts={allWorkouts} />
        )}
      </section>

      <section className="card">
        <h2 className="card-title">
          {workoutsFromPreviousWeek ? "Last week's workouts" : "This week's workouts"}
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

