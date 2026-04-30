import { generateId, type Habit, type HabitLog, type Task, type Exercise, type WorkoutPlan, type CompletedWorkout } from '../db/database'
import { sync } from '../db/sync'
import { db } from '../db/database'

export async function populateSampleData() {
  console.log('🧪 Populating sample data...')

  // Clear all tables — use array syntax for >5 tables
  await db.transaction('rw', [
    db.habits, db.habitLogs, db.tasks, db.exercises,
    db.workoutPlans, db.completedWorkouts,
    db.workSessionCategories, db.completedWorkSessions
  ], async () => {
    await db.habits.clear()
    await db.habitLogs.clear()
    await db.tasks.clear()
    await db.exercises.clear()
    await db.workoutPlans.clear()
    await db.completedWorkouts.clear()
    await db.workSessionCategories.clear()
    await db.completedWorkSessions.clear()
  })

  const categories = [
    { id: generateId(), name: 'Work',       color: '#ef4444', icon: '💻', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Meditation', color: '#22c55e', icon: '🧘', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Reading',    color: '#3b82f6', icon: '📖', createdAt: new Date().toISOString() },
  ]
  await Promise.all(categories.map(cat => sync.put('workSessionCategories', cat as unknown as Record<string, unknown>)))

  const habits: Habit[] = [
    { id: generateId(), name: 'Meditate',     color: '#22c55e', icon: '🧘', frequency: 'daily',  targetDays: [0,1,2,3,4,5,6], tags: ['health','mindfulness'], quota: undefined,                                      createdAt: new Date(Date.now() - 100*864e5).toISOString() },
    { id: generateId(), name: 'Read 30min',   color: '#3b82f6', icon: '📖', frequency: 'daily',  targetDays: [0,1,2,3,4,5,6], tags: ['personal','growth'],    quota: { type: 'time',     target: 30, unit: 'min' }, createdAt: new Date(Date.now() -  90*864e5).toISOString() },
    { id: generateId(), name: 'Code 2hrs',    color: '#aa3bff', icon: '💻', frequency: 'daily',  targetDays: [1,2,3,4,5],     tags: ['work','coding'],        quota: { type: 'time',     target: 2,  unit: 'hrs' }, createdAt: new Date(Date.now() -  80*864e5).toISOString() },
    { id: generateId(), name: 'Gym workout',  color: '#ef4444', icon: '🏋️', frequency: 'weekly', targetDays: [1,3,5],         tags: ['health','fitness'],     quota: undefined,                                      createdAt: new Date(Date.now() -  70*864e5).toISOString() },
    { id: generateId(), name: 'Journal',      color: '#f59e0b', icon: '📝', frequency: 'daily',  targetDays: [0,1,2,3,4,5,6], tags: ['personal','reflect'],   quota: undefined,                                      createdAt: new Date(Date.now() -  60*864e5).toISOString() },
    { id: generateId(), name: 'Water 3L',     color: '#14b8a6', icon: '💧', frequency: 'daily',  targetDays: [0,1,2,3,4,5,6], tags: ['health'],               quota: { type: 'quantity', target: 3,  unit: 'L'   }, createdAt: new Date(Date.now() -  50*864e5).toISOString() },
    { id: generateId(), name: 'Plan tomorrow',color: '#ec4899', icon: '📋', frequency: 'daily',  targetDays: [0],             tags: ['work','productivity'],  quota: undefined,                                      createdAt: new Date(Date.now() -  40*864e5).toISOString() },
  ]

  const habitLogs: HabitLog[] = []
  for (const habit of habits) {
    for (let d = 0; d < 30; d++) {
      if (Math.random() > 0.7) {
        const logDate = new Date()
        logDate.setDate(logDate.getDate() - d)
        habitLogs.push({
          id: generateId(),
          habitId: habit.id,
          completedAt: logDate.toISOString(),
          ...(habit.quota && { value: Math.floor(Math.random() * habit.quota.target * 1.2) }),
        })
      }
    }
  }

  const tasks: Task[] = [
    { id: generateId(), title: 'Finish project proposal', description: 'Client deliverable', dueDate: new Date(Date.now() +  3*864e5).toISOString().slice(0,10), tags: ['work','urgent'],    urgency: 'high'   as const, importance: 'high'   as const, createdAt: new Date().toISOString() },
    { id: generateId(), title: 'Schedule dentist',        description: '',                   dueDate: new Date(Date.now() +  7*864e5).toISOString().slice(0,10), tags: ['health'],           urgency: 'medium' as const, importance: 'medium' as const, createdAt: new Date(Date.now() - 2*864e5).toISOString() },
    { id: generateId(), title: 'Buy groceries',           description: 'Milk, eggs, veggies',dueDate: '',                                                        tags: ['personal'],        urgency: 'high'   as const, importance: 'low'    as const, createdAt: new Date().toISOString() },
    { id: generateId(), title: 'Read React docs',         description: 'Hooks section',      dueDate: new Date(Date.now() +  5*864e5).toISOString().slice(0,10), tags: ['work','learning'], urgency: 'low'    as const, importance: 'high'   as const, createdAt: new Date().toISOString() },
    { id: generateId(), title: 'Call mom',                description: '',                   dueDate: '',                                                        tags: ['personal'],        urgency: 'medium' as const, importance: 'medium' as const, createdAt: new Date().toISOString() },
    { id: generateId(), title: 'Update resume',           description: 'Add recent projects', dueDate: new Date(Date.now() + 14*864e5).toISOString().slice(0,10),tags: ['personal'],        urgency: 'low'    as const, importance: 'high'   as const, createdAt: new Date().toISOString() },
  ]

  const completedTasks = tasks.slice(0, 3).map(task => ({
    ...task,
    completedAt: new Date(Date.now() - Math.random() * 10 * 864e5).toISOString(),
  }))

  const exercises: Exercise[] = [
    { id: generateId(), name: 'Push-ups', category: 'Bodyweight', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Pull-ups', category: 'Bodyweight', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Squats',   category: 'Legs',       createdAt: new Date().toISOString() },
  ]

  const workoutPlan: WorkoutPlan = {
    id: generateId(),
    name: 'Full Body',
    description: 'Basic strength routine',
    exercises: [
      { exerciseId: exercises[0]!.id, sets: 3, reps: 10, weight: 0 },
      { exerciseId: exercises[2]!.id, sets: 3, reps: 12, weight: 0 },
    ],
    createdAt: new Date().toISOString(),
  }

  const completedWorkout: CompletedWorkout = {
    id: generateId(),
    workoutPlanId: workoutPlan.id,
    workoutPlanName: workoutPlan.name,
    startedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    completedAt: new Date().toISOString(),
    totalDurationSeconds: 45 * 60,
    exercises: workoutPlan.exercises.map((pe, i) => ({
      exerciseId: pe.exerciseId,
      name: exercises[i]!.name,
      sets: [
        { reps: 12, weight: 0, done: true },
        { reps: 10, weight: 0, done: true },
        { reps:  8, weight: 0, done: true },
      ],
    })),
  }

  // Insert with array syntax for >5 tables
  await db.transaction('rw', [
    db.habits, db.habitLogs, db.tasks,
    db.exercises, db.workoutPlans, db.completedWorkouts
  ], async () => {
    await Promise.all([
      db.habits.bulkAdd(habits),
      db.habitLogs.bulkAdd(habitLogs),
      db.tasks.bulkAdd([...completedTasks, ...tasks.slice(3)]),
      db.exercises.bulkAdd(exercises),
      db.workoutPlans.bulkAdd([workoutPlan]),
      db.completedWorkouts.bulkAdd([completedWorkout]),
    ])
  })

  console.log('✅ Sample data populated!', {
    habits: habits.length,
    habitLogs: habitLogs.length,
    tasks: tasks.length,
  })

  if (window.navigator.onLine) {
    await sync.flushQueue()
  }

  alert('Sample data populated! Check Habits/Tasks pages.')
}