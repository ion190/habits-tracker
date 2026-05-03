import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import { getPastTags } from '../utils'
import TagSuggestions from './TagSuggestions'
import type { ActiveWorkSession, WorkSessionTaskSnapshot, Task } from '../db/database'

interface Props {
  onClose: () => void
  onStarted: () => void
}

export default function StartWorkSessionModal({ onClose, onStarted }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [durationMinutes, setDurationMinutes] = useState(25)
  const [categoryName, setCategoryName] = useState('')
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [pastTags, setPastTags] = useState<string[]>([])

  useEffect(() => {
    db.tasks.filter(t => !t.completedAt && !t.archivedAt).toArray().then(ts => {
      setTasks(ts)
    })
  }, [])

  useEffect(() => {
    getPastTags('work').then(setPastTags)
  }, [])

  const toggleTask = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    )
  }

  const startSession = () => {
    const name = categoryName.trim()
    if (!name || durationMinutes <= 0) return

    const selectedTaskSnapshots: WorkSessionTaskSnapshot[] = selectedTasks.map(taskId => {
      const task = tasks.find(t => t.id === taskId)
      return task
        ? { taskId: task.id, title: task.title, tags: task.tags }
        : { taskId, title: 'Unknown', tags: [] }
    })

const session: ActiveWorkSession = {
      id: generateId(),
      categoryId: generateId(),
      categoryName: name,
      categoryColor: 'var(--accent)',
      categoryIcon: '⚡',
      durationSeconds: durationMinutes * 60,
      notes: notes.trim() || undefined,
      tags,
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 2rem' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setDurationMinutes(Math.max(5, durationMinutes - 5))}
            style={{ fontSize: 20, fontWeight: 600, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}
          >
            −
          </button>
          <input
            // type="number"
            className="field"
            min="5"
            max="240"
            value={durationMinutes}
            onChange={e => setDurationMinutes(Math.max(5, +e.target.value))}
            style={{ fontSize: 28, textAlign: 'center', fontWeight: 700, width: 80, color: 'var(--accent)', background: 'transparent', border: 'none' }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => setDurationMinutes(Math.min(240, durationMinutes + 5))}
            style={{ fontSize: 20, fontWeight: 600, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}
          >
            +
          </button>
        </div>
      </div>

      <div className="form-label">
        Category
        <input
          type="text"
          className="field"
          value={categoryName}
          onChange={e => setCategoryName(e.target.value)}
          placeholder="e.g. Deep Work, Writing, Coding"
          style={{ fontSize: 16, padding: '12px 16px' }}
        />
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

      <TagSuggestions
        pastTags={pastTags}
        currentTags={tags}
        onChange={setTags}
        inputValue={tagInput}
        onInputChange={setTagInput}
      />
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
          disabled={!categoryName.trim() || durationMinutes <= 0}
        >
          Start Session ({durationMinutes}m)
        </button>
      </div>
    </div>
  )
}
