import { db, generateId } from './database'
import type { WorkSessionCategory } from './database'
import { sync } from './sync'

const DEFAULT_CATEGORIES: Omit<WorkSessionCategory, 'id'>[] = [
  { name: 'Work',          color: '#ef4444', icon: '💻', createdAt: new Date().toISOString() },
  { name: 'Meditation',    color: '#22c55e', icon: '🧘', createdAt: new Date().toISOString() },
  { name: 'Contemplation', color: '#3b82f6', icon: '🤔', createdAt: new Date().toISOString() },
  { name: 'Reading',       color: '#f59e0b', icon: '📖', createdAt: new Date().toISOString() },
]

export async function seedWorkSessionCategories() {
  const existing = await db.workSessionCategories.toArray()
  if (existing.length === 0) {
    await Promise.all(DEFAULT_CATEGORIES.map(cat => {
      const fullCat: WorkSessionCategory = { id: generateId(), ...cat }
      return sync.put('workSessionCategories', fullCat as unknown as Record<string, unknown>)
    }))
    console.log('✅ Seeded default work session categories')
  }
}