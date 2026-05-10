// at the top of src/lib/api.ts — replace the single BASE line
const DEFAULT_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export function getApiBase(): string {
  return localStorage.getItem('rituals_api_url') ?? DEFAULT_BASE
}
export function setApiBase(url: string): void {
  localStorage.setItem('rituals_api_url', url.replace(/\/$/, '')) // strip trailing slash
  _token = null   // force re-auth when URL changes
  _tokenExp = 0
}
export function clearApiConfig(): void {
  localStorage.removeItem('rituals_api_url')
  localStorage.removeItem('rituals_api_role')
  _token = null
  _tokenExp = 0
  _lastRole = 'VISITOR'
}

// then in the req() helper, change the BASE references:
// const res = await fetch(`${getApiBase()}${path}`, ...
// same for the retry fetch

// src/lib/api.ts
// Typed API client for rituals-api backend.
// Usage:
//   import { api } from '@/lib/api'
//   await api.auth('ADMIN')          // get a token (stores in memory)
//   const { data } = await api.habits.list({ limit: 20, offset: 0 })
//   await api.habits.create({ name: 'Meditate', ... })

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

// ── Types (mirrors database.ts) ───────────────────────────
export type Role = 'ADMIN' | 'WRITER' | 'VISITOR'
export type Permission = 'READ' | 'WRITE' | 'DELETE'

export interface Paged<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export interface PageParams { limit?: number; offset?: number }

// ── Token state (in-memory only) ──────────────────────────
let _token: string | null = null
let _tokenExp: number     = 0   // unix ms
let _lastRole: Role       = 'VISITOR'

export function getToken(): string | null { return _token }
export function isAuthenticated(): boolean { return !!_token && Date.now() < _tokenExp }

/** Call once with a role to obtain a JWT. Re-auth happens automatically. */
export async function initAuth(role: Role = 'VISITOR'): Promise<void> {
  _lastRole = role
    localStorage.setItem('rituals_api_role', role)   // ← add this line
  const res = await fetch(`${BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) throw new Error('Failed to obtain token')
  const { token } = await res.json() as { token: string }
  _token    = token
  _tokenExp = Date.now() + 55_000  // 55s buffer (token lives 60s)
}

// ── Core fetch helper ─────────────────────────────────────
async function req<T>(
  path: string,
  method: string = 'GET',
  body?: unknown,
): Promise<T> {
  // Auto-refresh if expired
  if (!_token || Date.now() >= _tokenExp) await initAuth(_lastRole)

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${_token!}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    // Token rejected — refresh once and retry
    await initAuth(_lastRole)
    const retry = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_token!}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!retry.ok) throw new Error(`API ${method} ${path} → ${retry.status}`)
    return retry.status === 204 ? (undefined as T) : retry.json()
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

// ── Resource factory (DRY CRUD for every entity) ──────────
function resource<T, C = Partial<T>>(path: string) {
  return {
    list:   (params: PageParams & Record<string, unknown> = {}) => {
      const qs = new URLSearchParams(
        Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
      ).toString()
      return req<Paged<T>>(`${path}${qs ? `?${qs}` : ''}`)
    },
    get:    (id: string)  => req<T>(`${path}/${id}`),
    create: (data: C)     => req<T>(path, 'POST', data),
    update: (id: string, data: Partial<C>) => req<T>(`${path}/${id}`, 'PUT', data),
    remove: (id: string)  => req<void>(`${path}/${id}`, 'DELETE'),
  }
}

// ── Public API surface ────────────────────────────────────
import type {
  Habit, HabitLog, Task, Exercise, WorkoutPlan,
  CompletedWorkout, WorkSessionCategory, CompletedWorkSession,
  JournalEntry, CalendarActivity,
} from '../db/database'    // ← your existing database.ts

export const api = {
  auth: initAuth,

  habits:                   resource<Habit>('/habits'),
  habitLogs:                resource<HabitLog>('/habit-logs'),
  tasks:                    resource<Task>('/tasks'),
  exercises:                resource<Exercise>('/exercises'),
  workoutPlans:             resource<WorkoutPlan>('/workout-plans'),
  completedWorkouts:        resource<CompletedWorkout>('/completed-workouts'),
  workSessionCategories:    resource<WorkSessionCategory>('/work-session-categories'),
  completedWorkSessions:    resource<CompletedWorkSession>('/completed-work-sessions'),
  journalEntries:           resource<JournalEntry>('/journal-entries'),
  calendarActivities:       resource<CalendarActivity>('/calendar-activities'),
}

const _savedRole = localStorage.getItem('rituals_api_role') as Role | null
if (_savedRole) _lastRole = _savedRole