import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, generateId, dateKeyForPeriod } from '../db/database'
import type { CalendarActivity, CompletedWorkSession, WorkSessionCategory, JournalEntry, Habit, HabitLog, CompletedWorkout, Task } from '../db/database'
import { sortHabits } from './habits/sortHabits'

const HABIT_SORT_KEY = 'habitsSortOrder'
import { formatDuration, toDateKey, startOfWeek, isTaskDueOnDate, getPastTags } from '../utils'

import { sync } from '../db/sync'
import UnifiedHeatmap from '../components/UnifiedHeatmap'
import TasksMobileQuadrant from './TasksMobileQuadrant'

// ── Mini calendar (ported from RightSidebar) ──────────────────────────────
function SidebarCalendar({
  activities,
  onDayClick,
}: {
  activities: CalendarActivity[]
  onDayClick: (date: string) => void
}) {
  const [viewDate, setViewDate] = useState(new Date())
  const today = toDateKey(new Date().toISOString())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const pad = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}
      >
        <button
          className="btn btn-ghost"
          style={{ padding: '2px 6px', fontSize: 12 }}
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {viewDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button
          className="btn btn-ghost"
          style={{ padding: '2px 6px', fontSize: 12 }}
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, textAlign: 'center' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ fontSize: 9, opacity: 0.45, padding: '1px 0', fontWeight: 600 }}>
            {d}
          </div>
        ))}
        {Array(pad)
          .fill(null)
          .map((_, i) => (
            <div key={`p${i}`} />
          ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = key === today
          const hasActivity = activities.some(a => a.date === key)

          return (
            <div
              key={key}
              onClick={() => onDayClick(key)}
              style={{
                padding: '3px 1px 8px',
                borderRadius: 5,
                fontSize: 11,
                position: 'relative',
                background: isToday ? 'var(--accent)' : 'transparent',
                color: isToday ? '#fff' : 'var(--text)',
                fontWeight: isToday ? 700 : 400,
                cursor: 'pointer',
              }}
            >
              {day}
              {hasActivity && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    background: 'var(--accent)',
                    borderRadius: '50%',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DayPopup({
  date,
  activities,
  tasks,
  journal,
  onClose,
  onNavigate,
}: {
  date: string
  activities: CalendarActivity[]
  tasks: Task[]
  journal?: JournalEntry
  onClose: () => void
  onNavigate: (path: string) => void
}) {
  const label = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const dayActs = activities.filter(a => a.date === date)
  const dayTasks = tasks.filter(
    t => isTaskDueOnDate(t, date) && !(t.completedAt && toDateKey(t.completedAt) === date)
  )

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        zIndex: 300,
        marginTop: 4,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 14,
        width: 240,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>{label}</strong>
        <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 16 }} onClick={onClose}>
          ×
        </button>
      </div>

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

      {journal && (
        <div style={{ marginBottom: 8, padding: '5px 7px', background: 'var(--accent-bg)', borderRadius: 6, fontSize: 11 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>📅 Journal written</span>
        </div>
      )}

      {dayActs.length === 0 && dayTasks.length === 0 && !journal && (
        <p style={{ fontSize: 12, opacity: 0.5, margin: '0 0 8px' }}>Nothing scheduled</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <button className="btn btn-ghost" style={{ fontSize: 11, justifyContent: 'flex-start' }} onClick={() => onNavigate('/calendar')}>
          📅 Open in calendar
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 11, justifyContent: 'flex-start' }}
          onClick={() => onNavigate(`/journal?period=daily&key=${date}`)}
        >
          📝 Journal this day
        </button>
      </div>
    </div>
  )
}

import HabitValueModal from '../components/HabitValueModal'

import StartWorkoutModal from '../components/StartWorkoutModal'
import StartWorkSessionModal from '../components/StartWorkSessionModal'
import ModalPortal from '../components/ModalPortal'
import Modal from '../components/Modal'
import DatePickerInput from '../components/DatePickerInput'
import TagSuggestions from '../components/TagSuggestions'

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
  const [habitSort, setHabitSort] = useState(() => localStorage.getItem(HABIT_SORT_KEY) || 'name')
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
  const [dashboardPopupDate, setDashboardPopupDate] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState<'all' | 'today'>('all')


  // Task modal state

  const [showTaskModal, setShowTaskModal] = useState(false)

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskUrgency, setTaskUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [taskImportance, setTaskImportance] = useState<'low' | 'medium' | 'high'>('medium')
  const [taskTags, setTaskTags] = useState<string[]>([])
  const [taskTagInput, setTaskTagInput] = useState('')
  const [pastTaskTags, setPastTaskTags] = useState<string[]>([])
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatPattern, setRepeatPattern] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'decadely' | 'custom'>('weekly')
  const [repeatTargetDays, setRepeatTargetDays] = useState<number[]>([1,3,5])
  const [repeatEndDate, setRepeatEndDate] = useState('')

  const weeklyTarget = parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')

  const loadTaskTags = useCallback(async () => {
    const tags = await getPastTags('task')
    setPastTaskTags(tags)
  }, [])

  const load = useCallback(async () => {
    const weekStart = startOfWeek()
    const previousWeekStart = new Date(weekStart)
    previousWeekStart.setDate(previousWeekStart.getDate() - 7)

    try {
      const [h, l, w, t, ws, wsc, acts] = await Promise.all([
        db.habits.filter((h) => !h.archivedAt).toArray(),
        db.habitLogs.toArray(),
        db.completedWorkouts.toArray().then(workouts => workouts.sort((a, b) => 
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        )),
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

      const todaysAll = acts.filter((a: CalendarActivity) => a.date === todayKeyLocal)

      // Split today's into future vs past vs ongoing.
      // Include in-progress activities (start <= now <= end), which were previously dropped.
      const futureTodays = todaysAll.filter((a: CalendarActivity) => {
        const startDateTime = new Date(todayKeyLocal + 'T' + a.startTime + ':00')
        return startDateTime > now
      })

      const pastTodays = todaysAll.filter((a: CalendarActivity) => {
        const endDateTime = new Date(todayKeyLocal + 'T' + a.endTime + ':00')
        return endDateTime < now
      })

      const ongoingTodays = todaysAll.filter((a: CalendarActivity) => {
        const startDateTime = new Date(todayKeyLocal + 'T' + a.startTime + ':00')
        const endDateTime = new Date(todayKeyLocal + 'T' + a.endTime + ':00')
        return startDateTime <= now && endDateTime >= now
      })

      const tomorrowActs = acts.filter((a: CalendarActivity) => a.date === tomorrowKeyLocal)

      // Future first, then ongoing, then past
      setTodaysActivities([...futureTodays, ...ongoingTodays, ...pastTodays])
      setTodaysFutureActivities(futureTodays)
      setTomorrowActivities(tomorrowActs)

      const jEntry = await db.journalEntries.filter(e => e.period === 'daily' && e.dateKey === todayKeyLocal).first()
      setTodayJournal(jEntry ?? null)


      const thisWeekWorkouts = w.filter((x: CompletedWorkout) => new Date(x.startedAt) >= weekStart)

      if (thisWeekWorkouts.length === 0) {
        const lastWeekWorkouts = w.filter((x: CompletedWorkout) => {
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
    } catch (err) {
      setLoading(false)
    }
  }, [now])

  useEffect(() => {
    load()
    loadTaskTags()
    const onStorage = () => setHabitSort(localStorage.getItem(HABIT_SORT_KEY) || 'name')
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [load, loadTaskTags])

  // Focus task title input when modal opens
  useEffect(() => {
    if (!showTaskModal) return
    requestAnimationFrame(() => {
      const el = document.getElementById('task-modal-title') as HTMLInputElement | null
      el?.focus()
      el?.select()
    })
  }, [showTaskModal])

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
  const sortedHabits = sortHabits(habits, habitSort)

  const todaysTasks = tasks.filter((t) => {
    if (t.archivedAt) return false
    // Per-instance completion: completedAt stores the done dateKey instance.
    if (t.completedAt && toDateKey(t.completedAt) === today) return false
    return isTaskDueOnDate(t, today)
  })

  const allActiveTasks = tasks.filter((t) => !t.archivedAt && !t.completedAt)
  const tasksForDashboard = taskFilter === 'today' ? todaysTasks : allActiveTasks


  // Eisenhower matrix grouping (urgent/important) from active tasks
  const activeTasksForMatrix = tasks.filter(t => !t.archivedAt && !t.completedAt)

  const urgent_important = activeTasksForMatrix.filter(t => t.urgency === 'high' && t.importance === 'high')
  const not_urgent_important = activeTasksForMatrix.filter(t => t.urgency === 'low' && t.importance === 'high')
  const urgent_not_important = activeTasksForMatrix.filter(t => t.urgency === 'high' && t.importance === 'low')
  const not_urgent_not_important = activeTasksForMatrix.filter(t => t.urgency === 'low' && t.importance === 'low')

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

  function openNewTask() {
    setEditingTask(null)
    setTaskTitle('')
    setTaskDescription('')
    setTaskDueDate('')
    setTaskUrgency('medium')
    setTaskImportance('medium')
    setTaskTags([])
    setTaskTagInput('')
    setRepeatEnabled(false)
    setRepeatPattern('weekly')
    setRepeatTargetDays([1,3,5])
    setRepeatEndDate('')
    setShowTaskModal(true)
  }

  async function toggleTaskDone(task: Task) {
    const completedAt = task.completedAt ? undefined : new Date().toISOString()
    await sync.put(
      'tasks',
      {
        ...task,
        completedAt,
        archivedAt: task.archivedAt,
      } as unknown as Record<string, unknown>
    )
    load()
  }

  async function archiveTaskFromDashboard(task: Task) {
    await sync.put(
      'tasks',
      {
        ...task,
        archivedAt: new Date().toISOString(),
      } as unknown as Record<string, unknown>
    )
    load()
  }

  function openEditTaskModalFromDashboard(task: Task) {
    setEditingTask(task)
    setTaskTitle(task.title)
    setTaskDescription(task.description ?? '')
    setTaskDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '')
    setTaskUrgency(task.urgency)
    setTaskImportance(task.importance)
    setTaskTags(task.tags ?? [])
    setTaskTagInput('')

    if (task.recurrence) {
      setRepeatEnabled(true)
      setRepeatPattern(task.recurrence.pattern)
      setRepeatTargetDays(task.recurrence.targetDays ?? [1, 3, 5])
      setRepeatEndDate(task.recurrence.endDate ?? '')
    } else {
      setRepeatEnabled(false)
      setRepeatPattern('weekly')
      setRepeatTargetDays([1, 3, 5])
      setRepeatEndDate('')
    }

    setShowTaskModal(true)
  }

  async function saveTask() {

    if (!taskTitle.trim()) return
    if (!taskDueDate && repeatEnabled) return

    const task: Task = {
      id: editingTask?.id ?? generateId(),
      title: taskTitle,
      description: taskDescription || undefined,
      dueDate: taskDueDate || undefined,
      recurrence: repeatEnabled && taskDueDate ? {
        pattern: repeatPattern,
        targetDays: repeatPattern === 'weekly' || repeatPattern === 'custom' ? repeatTargetDays : undefined,
        endDate: repeatEndDate || undefined,
      } : undefined,
      notificationTime: undefined,
      completedAt: editingTask?.completedAt ?? undefined,
      createdAt: editingTask?.createdAt ?? new Date().toISOString(),
      tags: taskTags,
      urgency: taskUrgency,
      importance: taskImportance,
      archivedAt: editingTask?.archivedAt ?? undefined,
    }

    await sync.put('tasks', task as unknown as Record<string, unknown>)
    setShowTaskModal(false)
    load()
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

      {/* Dashboard top row: Calendar + Today Tasks + 3 stats (desktop in one row, mobile stacked) */}
      <div className="dashboard-top-grid">
        {/* Calendar card (mini calendar + day popup) */}
        <section className="card dashboard-top-card" style={{ padding: 14 }}>
          <div className="dashboard-top-card__inner">
            <h2 className="card-title">Calendar</h2>

            <div className="rs-card" style={{ border: 'none', padding: 0, background: 'transparent' }}>
              <div style={{ position: 'relative' }}>
                <SidebarCalendar activities={activities} onDayClick={setDashboardPopupDate} />

                {dashboardPopupDate && (
                  <DayPopup
                    date={dashboardPopupDate}
                    activities={activities}
                    tasks={tasks}
                    journal={todayJournal && dashboardPopupDate === today ? todayJournal : undefined}
                    onClose={() => setDashboardPopupDate(null)}
                    onNavigate={(path) => { navigate(path); setDashboardPopupDate(null) }}
                  />
                )}
              </div>
            </div>
          </div>
        </section>


        {/* Today tasks card with + button */}
        <section className="card" style={{ padding: 14,  }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>Tasks</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={taskFilter === 'all' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
              onClick={() => setTaskFilter('all')}
              title="Show all tasks"
            >
              All
            </button>
            <button
              className={taskFilter === 'today' ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
              onClick={() => setTaskFilter('today')}
              title="Show tasks for today"
            >
              Today
            </button>
          </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={openNewTask}
              style={{ fontSize: 32,  cursor: 'pointer', lineHeight: 1 }}
              title="Add new task"
            >
              +
            </button>
          </div>

            <div
            className="dashboard-tasks-list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                
              }}
            >
              {tasksForDashboard.length === 0 ? (
                <p className="empty-hint" style={{ margin: 0 }}>No tasks</p>
              ) : (
                tasksForDashboard.map((task) => {
                const done = !!(task.completedAt && toDateKey(task.completedAt) === today)
                return (
                  <div
                    key={task.id}
                    style={{  background: 'var(--card-bg)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                    onClick={() => navigate('/tasks?taskId=' + task.id)}
                  >
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleTaskDone(task)
                      }}
                      title={done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {done ? '✓' : '○'}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-h)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      {task.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          {task.tags.map(t => (
                            <span key={t} className="tag">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* 3 stats in one section */}
        <section className="card" style={{ padding: 14 }}>
          <h2 className="card-title" style={{ marginBottom: 14 }}>Today & This Week</h2>
          <div className="stats-row stats-col" >

            <div className="stat-card" style={{ minHeight: 110 }}>
              <p className="stat-label">Habits</p>
              <p className="stat-value">{todayLogs.length}/{habits.length}</p>
              <p className="stat-sub">done today</p>
            </div>
            <div className="stat-card" style={{ minHeight: 110 }}>
              <p className="stat-label">Journal</p>
              <p className="stat-value">{todayJournal ? '✍️' : '—'}</p>
              <p className="stat-sub" style={{ color: todayJournal ? '#22c55e' : undefined }}>
                {todayJournal ? 'written today' : 'not written'}
              </p>
            </div>
            <div className="stat-card" style={{ gridColumn: 'span 2', minHeight: 110 }}>
              <p className="stat-label">Workouts</p>
              <p className="stat-value">{weekWorkouts.length}/{weeklyTarget}</p>
              <p className="stat-sub">this week</p>
            </div>
          </div>
        </section>
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

      {/* Task Creation Modal */}
      {showTaskModal && (
        <Modal title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => setShowTaskModal(false)}>
          <div style={{ maxWidth: 500 }}>
            <div className="form-label">
              Title
              <input
                type="text"
                className="field"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
                id="task-modal-title"
              />
            </div>

            <div className="form-label">
              Description
              <textarea
                className="field"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="form-label">
              Due Date
              <DatePickerInput
                value={taskDueDate}
                onChange={setTaskDueDate}
                placeholder="Pick a date"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={repeatEnabled}
                  onChange={(e) => setRepeatEnabled(e.target.checked)}
                />
                Repeat task
              </label>
              {repeatEnabled && (
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  Creates recurring instances; completion is per occurrence.
                </span>
              )}
            </div>

            {repeatEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                <div className="form-label">
                  Repeat pattern
                  <select
                    className="field"
                    value={repeatPattern}
                    onChange={(e) => setRepeatPattern(e.target.value as typeof repeatPattern)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="decadely">Decadely</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {(repeatPattern === 'weekly' || repeatPattern === 'custom') && (
                  <div className="form-label">
                    Target days
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, idx) => {
                        const jsDayIndex = (idx + 1) % 7
                        const isOn = repeatTargetDays.includes(jsDayIndex)
                        return (
                          <button
                            key={d}
                            type="button"
                            className="btn btn-sm"
                            style={{
                              padding: '6px 10px',
                              background: isOn ? 'var(--accent-bg)' : 'var(--bg)',
                              border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                              color: isOn ? 'var(--accent)' : 'var(--text)',
                              borderRadius: 8,
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              setRepeatTargetDays(prev =>
                                prev.includes(jsDayIndex)
                                  ? prev.filter(x => x !== jsDayIndex)
                                  : [...prev, jsDayIndex].sort((a, b) => a - b)
                              )
                            }}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="form-label">
                  End date (optional)
                  <DatePickerInput
                    value={repeatEndDate}
                    onChange={setRepeatEndDate}
                    placeholder="Leave empty for no end date"
                  />
                </div>
              </div>
            )}

            <div className="form-label">
              Urgency
              <select
                className="field"
                value={taskUrgency}
                onChange={(e) => setTaskUrgency(e.target.value as typeof taskUrgency)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-label">
              Importance
              <select
                className="field"
                value={taskImportance}
                onChange={(e) => setTaskImportance(e.target.value as typeof taskImportance)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-label">
              Tags
              <TagSuggestions
                pastTags={pastTaskTags}
                currentTags={taskTags}
                onChange={setTaskTags}
                inputValue={taskTagInput}
                onInputChange={setTaskTagInput}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={saveTask} style={{ flex: 1 }}>
                Save Task
              </button>
              <button className="btn btn-ghost" onClick={() => setShowTaskModal(false)} style={{ flex: 1 }}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
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


        {/* Eisenhower Matrix at the bottom (same layout/logic as Tasks page) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}
        className="tasks-eisenhower-grid tasks-eisenhower-desktop only-desktop"
      >
        <div style={{ flex: 1, background: `var(--danger-bg)`, border: `1px solid var(--danger-border)`, borderRadius: 8, padding: 16, minHeight: 200 }}>
          <h3 style={{ margin: '0 0 12px 0', color: `var(--danger)`, fontSize: 14, fontWeight: 600 }}>🔴 Do First (Urgent & Important)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urgent_important.length === 0 ? <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No tasks</p> : urgent_important.map(task => (
              <div key={task.id} style={{ background: 'var(--card-bg)', border: `2px solid ${task.id === null ? 'var(--accent)' : 'var(--card-border)'}`, borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: 'none', transition: 'all 0.2s' }} className="hover:opacity-80" onClick={() => navigate('/tasks?taskId=' + task.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{task.title}</p>
                    {task.description && <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {task.tags?.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--accent-bg)', borderRadius: 4, color: 'var(--accent)' }}>{tag}</span>
                      ))}
                    </div>
                    {task.dueDate && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); toggleTaskDone(task) }} title="Mark complete" style={{ fontSize: 14 }}>✓</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEditTaskModalFromDashboard(task) }} title="Edit" style={{ fontSize: 14 }}>✎</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); archiveTaskFromDashboard(task) }} title="Archive" style={{ fontSize: 14 }}>🗃</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, background: `var(--warning-bg)`, border: `1px solid var(--warning-border)`, borderRadius: 8, padding: 16, minHeight: 200 }}>
          <h3 style={{ margin: '0 0 12px 0', color: `var(--warning)`, fontSize: 14, fontWeight: 600 }}>🟠 Schedule (Important, Not Urgent)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {not_urgent_important.length === 0 ? <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No tasks</p> : not_urgent_important.map(task => (
              <div key={task.id} style={{ background: 'var(--card-bg)', border: `2px solid var(--card-border)`, borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: 'none', transition: 'all 0.2s' }} className="hover:opacity-80" onClick={() => navigate('/tasks?taskId=' + task.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{task.title}</p>
                    {task.description && <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {task.tags?.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--accent-bg)', borderRadius: 4, color: 'var(--accent)' }}>{tag}</span>
                      ))}
                    </div>
                    {task.dueDate && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); toggleTaskDone(task) }} title="Mark complete" style={{ fontSize: 14 }}>✓</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEditTaskModalFromDashboard(task) }} title="Edit" style={{ fontSize: 14 }}>✎</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); archiveTaskFromDashboard(task) }} title="Archive" style={{ fontSize: 14 }}>🗃</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, background: `var(--info-bg)`, border: `1px solid var(--info-border)`, borderRadius: 8, padding: 16, minHeight: 200 }}>
          <h3 style={{ margin: '0 0 12px 0', color: `var(--info)`, fontSize: 14, fontWeight: 600 }}>🟡 Delegate (Urgent, Not Important)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urgent_not_important.length === 0 ? <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No tasks</p> : urgent_not_important.map(task => (
              <div key={task.id} style={{ background: 'var(--card-bg)', border: `2px solid var(--card-border)`, borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: 'none', transition: 'all 0.2s' }} className="hover:opacity-80" onClick={() => navigate('/tasks?taskId=' + task.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{task.title}</p>
                    {task.description && <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {task.tags?.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--accent-bg)', borderRadius: 4, color: 'var(--accent)' }}>{tag}</span>
                      ))}
                    </div>
                    {task.dueDate && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); toggleTaskDone(task) }} title="Mark complete" style={{ fontSize: 14 }}>✓</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEditTaskModalFromDashboard(task) }} title="Edit" style={{ fontSize: 14 }}>✎</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); archiveTaskFromDashboard(task) }} title="Archive" style={{ fontSize: 14 }}>🗃</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, background: `var(--ghost-bg)`, border: `1px solid var(--ghost-border)`, borderRadius: 8, padding: 16, minHeight: 200 }}>
          <h3 style={{ margin: '0 0 12px 0', color: `var(--ghost)`, fontSize: 14, fontWeight: 600 }}>⚪ Eliminate (Neither)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {not_urgent_not_important.length === 0 ? <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No tasks</p> : not_urgent_not_important.map(task => (
              <div key={task.id} style={{ background: 'var(--card-bg)', border: `2px solid var(--card-border)`, borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: 'none', transition: 'all 0.2s' }} className="hover:opacity-80" onClick={() => navigate('/tasks?taskId=' + task.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{task.title}</p>
                    {task.description && <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>{task.description}</p>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {task.tags?.map(tag => (
                        <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--accent-bg)', borderRadius: 4, color: 'var(--accent)' }}>{tag}</span>
                      ))}
                    </div>
                    {task.dueDate && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>Due: {new Date(task.dueDate).toLocaleDateString()}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); toggleTaskDone(task) }} title="Mark complete" style={{ fontSize: 14 }}>✓</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openEditTaskModalFromDashboard(task) }} title="Edit" style={{ fontSize: 14 }}>✎</button>
                    <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); archiveTaskFromDashboard(task) }} title="Archive" style={{ fontSize: 14 }}>🗃</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile (single column) */}
      <div className="only-mobile" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <TasksMobileQuadrant title="🔴 Do First (Urgent & Important)" tasks={urgent_important} color="danger" selectedTaskId={null} onSelectTask={(taskId) => navigate('/tasks?taskId=' + taskId)} onComplete={(task) => toggleTaskDone(task)} onEdit={(task) => { setEditingTask(task); openEditTaskModalFromDashboard(task) }} onArchive={(task) => archiveTaskFromDashboard(task)} />
        <TasksMobileQuadrant title="🟠 Schedule (Important, Not Urgent)" tasks={not_urgent_important} color="warning" selectedTaskId={null} onSelectTask={(taskId) => navigate('/tasks?taskId=' + taskId)} onComplete={(task) => toggleTaskDone(task)} onEdit={(task) => { setEditingTask(task); openEditTaskModalFromDashboard(task) }} onArchive={(task) => archiveTaskFromDashboard(task)} />
        <TasksMobileQuadrant title="🟡 Delegate (Urgent, Not Important)" tasks={urgent_not_important} color="info" selectedTaskId={null} onSelectTask={(taskId) => navigate('/tasks?taskId=' + taskId)} onComplete={(task) => toggleTaskDone(task)} onEdit={(task) => { setEditingTask(task); openEditTaskModalFromDashboard(task) }} onArchive={(task) => archiveTaskFromDashboard(task)} />
        <TasksMobileQuadrant title="⚪ Eliminate (Neither)" tasks={not_urgent_not_important} color="ghost" selectedTaskId={null} onSelectTask={(taskId) => navigate('/tasks?taskId=' + taskId)} onComplete={(task) => toggleTaskDone(task)} onEdit={(task) => { setEditingTask(task); openEditTaskModalFromDashboard(task) }} onArchive={(task) => archiveTaskFromDashboard(task)} />
      </div>


    </div>
  )
}

