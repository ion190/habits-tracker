import type { Habit } from '../../db/database'

export const HABIT_SORT_KEY = 'habitsSortOrder'

export const HABIT_SORT_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'created', label: 'Created (Newest)' },
  { value: 'color', label: 'Color' },
  { value: 'frequency', label: 'Frequency' },
] as const

// Frequency group order: daily → weekly → custom
const FREQ_ORDER: Record<string, number> = { daily: 0, weekly: 1, custom: 2 }

function freqGroup(h: Habit): number {
  return FREQ_ORDER[h.frequency] ?? 3
}

export function sortHabits(
  habits: Habit[],
  sortOrder: 'name' | 'created' | 'color' | 'frequency' | string,
) {
  // Secondary comparator based on selected sort
  function secondary(a: Habit, b: Habit): number {
    if (sortOrder === 'name') return a.name.localeCompare(b.name)
    if (sortOrder === 'created') return (b.createdAt || '').localeCompare(a.createdAt || '')
    if (sortOrder === 'color') return (a.color || '').localeCompare(b.color || '')
    if (sortOrder === 'frequency') return (a.frequency || '').localeCompare(b.frequency || '')
    return 0
  }

  return [...habits].sort((a, b) => {
    // Primary: always group by frequency (daily first, then weekly, then custom)
    const freqDiff = freqGroup(a) - freqGroup(b)
    if (freqDiff !== 0) return freqDiff
    // Secondary: user-chosen sort within each frequency group
    return secondary(a, b)
  })
}