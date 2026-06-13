// src/utils/recurrence.ts
import type { CalendarActivityRecurrence } from '../db/database'

// Helper to convert Date to YYYY-MM-DD string using LOCAL time (not UTC).
// toISOString() returns UTC which can shift the date by a day in non-UTC timezones.
function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Generate all dates for a recurring activity
export function generateRecurrenceDates(
  startDate: string,
  recurrence: CalendarActivityRecurrence,
  maxDays: number = 365
): string[] {
  const dates: string[] = []
  const start = new Date(startDate + 'T00:00:00')
  const current = new Date(start)
  let count = 0
  const pattern = recurrence.pattern
  const endDate = recurrence.endDate ? new Date(recurrence.endDate + 'T00:00:00') : undefined

  while (count < maxDays) {
    if (endDate && current > endDate) break
    const dateKey = toDateKey(current)
    const dayOfWeek = current.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
    switch (pattern) {
      case 'daily':
        dates.push(dateKey)
        break
      case 'weekly':
        if (recurrence.targetDays?.includes(dayOfWeek)) {
          dates.push(dateKey)
        }
        break
      case 'monthly':
        if (current.getDate() === start.getDate()) {
          dates.push(dateKey)
        }
        break
      case 'quarterly':
        if (current.getMonth() % 3 === start.getMonth() % 3 && current.getDate() === start.getDate()) {
          dates.push(dateKey)
        }
        break
      case 'yearly':
        if (current.getMonth() === start.getMonth() && current.getDate() === start.getDate()) {
          dates.push(dateKey)
        }
        break
      case 'custom':
        // For future expansion: support custom intervals
        dates.push(dateKey)
        break
    }
    // Increment date
    switch (pattern) {
      case 'daily':
        current.setDate(current.getDate() + 1)
        break
      case 'weekly':
        current.setDate(current.getDate() + 1)
        break
      case 'monthly':
        current.setMonth(current.getMonth() + 1)
        break
      case 'quarterly':
        current.setMonth(current.getMonth() + 1)
        break
      case 'yearly':
        current.setFullYear(current.getFullYear() + 1)
        break
      case 'custom':
        current.setDate(current.getDate() + 1)
        break
    }
    count++
  }
  return dates
}