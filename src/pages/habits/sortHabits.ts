import type { Habit } from '../../db/database'

export const HABIT_SORT_KEY = 'habitsSortOrder'

export const HABIT_SORT_OPTIONS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'created', label: 'Created (Newest)' },
  { value: 'color', label: 'Color' },
  { value: 'frequency', label: 'Frequency' },
] as const

export function sortHabits(
  habits: Habit[],
  sortOrder: 'name' | 'created' | 'color' | 'frequency' | string,
) {
  if (sortOrder === 'name') {
    return [...habits].sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortOrder === 'created') {
    return [...habits].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } else if (sortOrder === 'color') {
    return [...habits].sort((a, b) => (a.color || '').localeCompare(b.color || ''))
  } else if (sortOrder === 'frequency') {
    return [...habits].sort((a, b) => (a.frequency || '').localeCompare(b.frequency || ''))
  }
  return habits
}

