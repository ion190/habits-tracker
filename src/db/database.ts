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
// Every write that couldn't reach Firestore is stored here.
// The SyncEngine flushes these when the device comes back online.

export type SyncOperation = 'put' | 'delete'

export interface SyncQueueEntry {
  id: string                // local id for this queue entry
  table: string             // which Firestore collection
  recordId: string          // id of the affected document
  operation: SyncOperation
  data?: unknown            // full record for 'put', undefined for 'delete'
  createdAt: string         // when the operation was queued
  retries: number           // how many times we've tried
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
}

// ── Database ──────────────────────────────────────────────

class RitualsDB extends Dexie {
  habits!: Table<Habit>
  habitLogs!: Table<HabitLog>
  tasks!: Table<Task>
  exercises!: Table<Exercise>
  workoutPlans!: Table<WorkoutPlan>
  completedWorkouts!: Table<CompletedWorkout>
  syncQueue!: Table<SyncQueueEntry>

  constructor() {
    super('RitualsDB')
    this.version(6).stores({
      habits:            '&id, name, frequency, archivedAt',
      habitLogs:         '&id, habitId, completedAt',
      tasks:             '&id, dueDate, notificationTime, completedAt, urgency, importance, archivedAt',
      exercises:         '&id, name, category',
      workoutPlans:      '&id, name, createdAt',
      completedWorkouts: '&id, workoutPlanId, startedAt',
      syncQueue:         '&id, table, recordId, createdAt',
    })
  }
}

export const db = new RitualsDB()

// ── Helpers ───────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ── Import / Export ───────────────────────────────────────

export async function exportDatabase(): Promise<void> {
  const data: ExportData = {
    exportedAt:        new Date().toISOString(),
    version:           1,
    habits:            await db.habits.toArray(),
    habitLogs:         await db.habitLogs.toArray(),
    tasks:             await db.tasks.toArray(),
    exercises:         await db.exercises.toArray(),
    workoutPlans:      await db.workoutPlans.toArray(),
    completedWorkouts: await db.completedWorkouts.toArray(),
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
  ]
  await db.transaction('rw', tables, async () => {
    await db.habits.clear()
    await db.habitLogs.clear()
    await db.tasks.clear()
    await db.exercises.clear()
    await db.workoutPlans.clear()
    await db.completedWorkouts.clear()

    if (data.habits?.length)            await db.habits.bulkAdd(data.habits)
    if (data.habitLogs?.length)         await db.habitLogs.bulkAdd(data.habitLogs)
    if (data.tasks?.length)             await db.tasks.bulkAdd(data.tasks)
    if (data.exercises?.length)         await db.exercises.bulkAdd(data.exercises)
    if (data.workoutPlans?.length)      await db.workoutPlans.bulkAdd(data.workoutPlans)
    if (data.completedWorkouts?.length) await db.completedWorkouts.bulkAdd(data.completedWorkouts)
  })
}