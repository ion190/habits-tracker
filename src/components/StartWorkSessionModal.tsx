import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import type { ActiveWorkSession, WorkSessionCategory, WorkSessionTaskSnapshot, Task } from '../db/database'

interface Props {
  onClose: () => void
  onStarted: () => void
}

export default function StartWorkSessionModal({ onClose, onStarted }: Props) {
  const [categories, setCategories] = useState<WorkSessionCategory[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [durationMinutes, setDurationMinutes] = useState(25)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    Promise.all([
      db.workSessionCategories.toArray(),
      db.tasks.filter(t => !t.completedAt && !t.archivedAt).toArray()
    ]).then(([cats, ts]) => {
      setCategories(cats)
      setTasks(ts)
      if (cats.length > 0) setSelectedCategory(cats[0].id)
    })
  }, [])

  const toggleTask = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    )
  }

  const startSession = () => {
    const category = categories.find(c => c.id === selectedCategory)
    if (!category || durationMinutes <= 0) return

    const selectedTaskSnapshots: WorkSessionTaskSnapshot[] = selectedTasks.map(taskId => {
      const task = tasks.find(t => t.id === taskId)
      return task
        ? { taskId: task.id, title: task.title, tags: task.tags }
        : { taskId, title: 'Unknown', tags: [] }
    })

    const session: ActiveWorkSession = {
      id: generateId(),
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      categoryIcon: category.icon,
      durationSeconds: durationMinutes * 60,
      notes: notes.trim() || undefined,
      tasks: selectedTaskSnapshots,
      startedAt: new Date().toISOString(),
    }

    localStorage.setItem('activeWorkSession', JSON.stringify(session))
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    onStarted()
  }

  return (
    <div style={{ maxWidth: 500 }}>
      <div className="form-label">
        Duration (minutes)
        <input
          type="number"
          className="field"
          min="1"
          max="240"
          value={durationMinutes}
          onChange={e => setDurationMinutes(+e.target.value)}
          style={{ fontSize: 24, textAlign: 'center', fontWeight: 600 }}
        />
      </div>

      <div className="form-label">
        Category
        <select className="field" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
          ))}
        </select>
      </div>

      <div className="form-label">
        Tasks (optional)
        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
          {tasks.length === 0 ? (
            <p style={{ textAlign: 'center', opacity: 0.6, margin: 20 }}>No active tasks</p>
          ) : (
            tasks.slice(0, 10).map(task => (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 6,
                background: selectedTasks.includes(task.id) ? 'var(--accent-bg)' : 'transparent',
                marginBottom: 4,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => toggleTask(task.id)}
                  />
                  <span style={{ fontWeight: 500 }}>{task.title}</span>
                </label>
                {task.tags.length > 0 && (
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{task.tags[0]}</span>
                )}
              </div>
            ))
          )}
        </div>
        {tasks.length > 10 && (
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
            Showing 10 most recent. {selectedTasks.length} selected.
          </p>
        )}
      </div>

      <div className="form-label">
        Notes (optional)
        <textarea
          className="field"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. 'Deep work on feature X, avoid email'"
          rows={2}
        />
      </div>

      <div className="form-actions">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={startSession}
          disabled={!selectedCategory || durationMinutes <= 0}
        >
          Start Session ({durationMinutes}m)
        </button>
      </div>
    </div>
  )
}