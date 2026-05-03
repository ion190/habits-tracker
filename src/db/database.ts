// src/db/database.ts
import Dexie, { type Table } from 'dexie'

export interface HabitQuota {
  type: 'quantity' | 'time'
  target: number
  unit: string
}

export interface Habit {
  id: string
  name: string
  color: string
  icon: string
  frequency: 'daily' | 'weekly' | 'custom'
  targetDays: number[]
  tags: string[]
  quota?: HabitQuota
  createdAt: string
  archivedAt?: string
}

export interface HabitLog {
  id: string
  habitId: string
  completedAt: string
  note?: string
  value?: number
}

export interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  notificationTime?: string
  completedAt?: string
  createdAt: string
  tags: string[]
  urgency: 'low' | 'medium' | 'high'
  importance: 'low' | 'medium' | 'high'
  archivedAt?: string
}

export interface Exercise {
  id: string
  name: string
  category: string
  description?: string
  imageUrl?: string
  createdAt: string
}

export interface PlanExercise {
  exerciseId: string
  sets: number
  reps: number
  weight: number
}

export interface WorkoutPlan {
  id: string
  name: string
  description?: string
  exercises: PlanExercise[]
  createdAt: string
}

export interface CompletedSet {
  reps: number
  weight: number
  done: boolean
  completedAt?: string
}

export interface CompletedExercise {
  exerciseId: string
  name: string
  sets: CompletedSet[]
}

export interface CompletedWorkout {
  id: string
  workoutPlanId: string
  workoutPlanName: string
  startedAt: string
  completedAt: string
  totalDurationSeconds: number
  exercises: CompletedExercise[]
}

export interface ActiveWorkout {
  workoutPlanId: string
  workoutPlanName: string
  startedAt: string
  exercises: CompletedExercise[]
}

// ── Sync queue ────────────────────────────────────────────
export type SyncOperation = 'put' | 'delete'

export interface SyncQueueEntry {
  id: string
  table: string
  recordId: string
  operation: SyncOperation
  data?: unknown
  createdAt: string
  retries: number
}

// ── Work Sessions ─────────────────────────────────────────
export interface WorkSessionCategory {
  id: string
  name: string
  color: string
  icon: string
  createdAt: string
}

export interface WorkSessionTaskSnapshot {
  taskId: string
  title: string
  tags: string[]
}

export interface ActiveWorkSession {
  id: string
  categoryId: string
  categoryName: string
  categoryColor: string
  categoryIcon: string
  durationSeconds: number
  notes?: string
  tags?: string[]
  tasks: WorkSessionTaskSnapshot[]
  startedAt: string
  pausedAt?: string
  totalElapsedSeconds?: number
}

export interface CompletedWorkSession {
  id: string
  categoryId: string
  categoryName: string
  categoryColor: string
  plannedDurationSeconds: number
  actualDurationSeconds: number
  distractionSeconds: number
  productivityPct: number
  notes?: string
  tags?: string[]
  tasks: WorkSessionTaskSnapshot[]
  startedAt: string
  endedAt: string
}

// ── Journal ───────────────────────────────────────────────
// dateKey format by period:
//   daily:     '2026-05-02'
//   weekly:    '2026-W18'
//   monthly:   '2026-05'
//   quarterly: '2026-Q2'
//   yearly:    '2026'
//   decadely:  '2020s'

export type JournalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'decadely'

export interface JournalEntry {
  id: string
  period: JournalPeriod
  dateKey: string
  title?: string
  content: string
  mood?: number  // 1-5 emoji mood score
  createdAt: string
  updatedAt: string
}

// ── Calendar Activities ───────────────────────────────────
export interface CalendarActivity {
  id: string
  title: string
  date: string       // YYYY-MM-DD
  startTime: string  // HH:MM
  endTime: string    // HH:MM
  color: string
  category?: string
  notes?: string
  createdAt: string
}

// ── Export / import shape ─────────────────────────────────
export interface ExportData {
  exportedAt: string
  version: number
  habits: Habit[]
  habitLogs: HabitLog[]
  tasks: Task[]
  exercises: Exercise[]
  workoutPlans: WorkoutPlan[]
  completedWorkouts: CompletedWorkout[]
  workSessionCategories: WorkSessionCategory[]
  completedWorkSessions: CompletedWorkSession[]
  journalEntries: JournalEntry[]
  calendarActivities: CalendarActivity[]
}

// ── Database ──────────────────────────────────────────────
class RitualsDB extends Dexie {
  habits!: Table<Habit>
  habitLogs!: Table<HabitLog>
  tasks!: Table<Task>
  exercises!: Table<Exercise>
  workoutPlans!: Table<WorkoutPlan>
  completedWorkouts!: Table<CompletedWorkout>
  workSessionCategories!: Table<WorkSessionCategory>
  completedWorkSessions!: Table<CompletedWorkSession>
  journalEntries!: Table<JournalEntry>
  calendarActivities!: Table<CalendarActivity>
  syncQueue!: Table<SyncQueueEntry>

  constructor() {
    super('RitualsDB')
    this.version(7).stores({
      habits:                 '&id, name, frequency, archivedAt',
      habitLogs:              '&id, habitId, completedAt',
      tasks:                  '&id, dueDate, notificationTime, completedAt, urgency, importance, archivedAt',
      exercises:              '&id, name, category',
      workoutPlans:           '&id, name, createdAt',
      completedWorkouts:      '&id, workoutPlanId, startedAt',
      workSessionCategories:  '&id, name',
      completedWorkSessions:  '&id, categoryId, startedAt',
      syncQueue:              '&id, table, recordId, createdAt',
    })
    this.version(8).stores({
      habits:                 '&id, name, frequency, archivedAt',
      habitLogs:              '&id, habitId, completedAt',
      tasks:                  '&id, dueDate, notificationTime, completedAt, urgency, importance, archivedAt',
      exercises:              '&id, name, category',
      workoutPlans:           '&id, name, createdAt',
      completedWorkouts:      '&id, workoutPlanId, startedAt',
      workSessionCategories:  '&id, name',
      completedWorkSessions:  '&id, categoryId, startedAt',
      journalEntries:         '&id, period, dateKey',
      calendarActivities:     '&id, date, startTime',
      syncQueue:              '&id, table, recordId, createdAt',
    })

    this.version(9).stores({
      habits:                 '&id, name, frequency, archivedAt',
      habitLogs:              '&id, habitId, completedAt',
      tasks:                  '&id, dueDate, notificationTime, completedAt, urgency, importance, archivedAt',
      exercises:              '&id, name, category',
      workoutPlans:           '&id, name, createdAt',
      completedWorkouts:      '&id, workoutPlanId, startedAt',
      workSessionCategories:  '&id, name',
      completedWorkSessions:  '&id, categoryId, startedAt',
      journalEntries:         '&id, period, dateKey, [period+dateKey]',
      calendarActivities:     '&id, date, startTime',
      syncQueue:              '&id, table, recordId, createdAt',
    })
  }
}

export const db = new RitualsDB()

// ── Helpers ───────────────────────────────────────────────
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Journal date key helpers ──────────────────────────────
export function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const w1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)
}

export function dateKeyForPeriod(period: JournalPeriod, date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const d = date.getDate().toString().padStart(2, '0')
  const q = Math.ceil((date.getMonth() + 1) / 3)
  const w = getISOWeek(date).toString().padStart(2, '0')
  const decade = Math.floor(y / 10) * 10
  switch (period) {
    case 'daily':     return `${y}-${m}-${d}`
    case 'weekly':    return `${y}-W${w}`
    case 'monthly':   return `${y}-${m}`
    case 'quarterly': return `${y}-Q${q}`
    case 'yearly':    return `${y}`
    case 'decadely':  return `${decade}s`
  }
}

export function labelForDateKey(period: JournalPeriod, dateKey: string): string {
  switch (period) {
    case 'daily': {
      const d = new Date(dateKey + 'T00:00:00')
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    case 'weekly': {
      const [yearStr, weekStr] = dateKey.split('-W')
      const year = parseInt(yearStr)
      const week = parseInt(weekStr)
      const jan1 = new Date(year, 0, 1)
      const daysToMonday = (1 + 7 - jan1.getDay()) % 7
      const mon = new Date(year, 0, daysToMonday + (week - 1) * 7 + 1)
      const sun = new Date(mon)
      sun.setDate(sun.getDate() + 6)
      const baseLabel = `Week ${week}, ${year}`
      const rangeLabel = formatDateRange(mon, sun)
      return `${baseLabel} (${rangeLabel})`
    }
    case 'monthly': {
      const [y, mo] = dateKey.split('-')
      return new Date(+y, +mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
    case 'quarterly': {
      const [yearStr, qStr] = dateKey.split('-Q')
      const year = parseInt(yearStr)
      const q = parseInt(qStr)
      const monthStart = (q - 1) * 3
      const monthEnd = monthStart + 2
      const startDate = new Date(year, monthStart, 1)
      const endDate = new Date(year, monthEnd + 1, 0) // Last day of end month
      const baseLabel = dateKey.replace('-', ' ')
      const rangeLabel = formatDateRange(startDate, endDate)
      return `${baseLabel} (${rangeLabel})`
    }
    case 'yearly':    return dateKey
    case 'decadely':  return `The ${dateKey}`
  }
}

function formatDateRange(start: Date, end: Date): string {
  const formatShort = (date: Date): string => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${formatShort(start)}–${formatShort(end)}`
  }
  return `${formatShort(start)}–${formatShort(end)}`
}

// ── Import / Export ───────────────────────────────────────
export async function exportDatabase(): Promise<void> {
  const data: ExportData = {
    exportedAt:              new Date().toISOString(),
    version:                 3,
    habits:                  await db.habits.toArray(),
    habitLogs:               await db.habitLogs.toArray(),
    tasks:                   await db.tasks.toArray(),
    exercises:               await db.exercises.toArray(),
    workoutPlans:            await db.workoutPlans.toArray(),
    completedWorkouts:       await db.completedWorkouts.toArray(),
    workSessionCategories:   await db.workSessionCategories.toArray(),
    completedWorkSessions:   await db.completedWorkSessions.toArray(),
    journalEntries:          await db.journalEntries.toArray(),
    calendarActivities:      await db.calendarActivities.toArray(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `rituals-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importDatabase(file: File): Promise<void> {
  const text = await file.text()
  const data: ExportData = JSON.parse(text)
  if (!data.version || !data.habits) throw new Error('Invalid backup file.')

  const tables = [
    db.habits, db.habitLogs, db.tasks,
    db.exercises, db.workoutPlans, db.completedWorkouts,
    db.workSessionCategories, db.completedWorkSessions,
    db.journalEntries, db.calendarActivities,
  ]
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map(t => t.clear()))
    if (data.habits?.length)                  await db.habits.bulkAdd(data.habits)
    if (data.habitLogs?.length)               await db.habitLogs.bulkAdd(data.habitLogs)
    if (data.tasks?.length)                   await db.tasks.bulkAdd(data.tasks)
    if (data.exercises?.length)               await db.exercises.bulkAdd(data.exercises)
    if (data.workoutPlans?.length)            await db.workoutPlans.bulkAdd(data.workoutPlans)
    if (data.completedWorkouts?.length)       await db.completedWorkouts.bulkAdd(data.completedWorkouts)
    if (data.workSessionCategories?.length)   await db.workSessionCategories.bulkAdd(data.workSessionCategories)
    if (data.completedWorkSessions?.length)   await db.completedWorkSessions.bulkAdd(data.completedWorkSessions)
    if (data.journalEntries?.length)          await db.journalEntries.bulkAdd(data.journalEntries)
    if (data.calendarActivities?.length)      await db.calendarActivities.bulkAdd(data.calendarActivities)
  })
}