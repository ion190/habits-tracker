import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Task } from '../db/database'
import { formatDateOnlyGMT3 } from '../utils'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [importance, setImportance] = useState<'low' | 'medium' | 'high'>('medium')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Load tasks
  async function load() {
    const data = await db.tasks.filter(t => !t.completedAt).toArray()
    setTasks(data.sort((a, b) => {
      // Sort by importance first (desc), then by urgency (desc)
      const impOrder = { high: 3, medium: 2, low: 1 }
      if (impOrder[b.importance] !== impOrder[a.importance]) {
        return impOrder[b.importance] - impOrder[a.importance]
      }
      return impOrder[b.urgency] - impOrder[a.urgency]
    }))
  }

  useEffect(() => { load() }, [])

  function openNewTask() {
    setEditingTask(null)
    setTitle('')
    setDescription('')
    setDueDate('')
    setUrgency('medium')
    setImportance('medium')
    setTags([])
    setTagInput('')
    setShowModal(true)
  }

  function editTask(task: Task) {
    setEditingTask(task)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueDate(task.dueDate ?? '')
    setUrgency(task.urgency)
    setImportance(task.importance)
    setTags(task.tags ?? [])
    setTagInput('')
    setShowModal(true)
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter(t => t !== tag))
  }

  async function save() {
    if (!title.trim()) return

    const task: Task = {
      id: editingTask?.id ?? generateId(),
      title,
      description: description || undefined,
      dueDate: dueDate || undefined,
      notificationTime: undefined,
      completedAt: undefined,
      createdAt: editingTask?.createdAt ?? new Date().toISOString(),
      tags,
      urgency,
      importance,
    }

    await sync.put('tasks', task as unknown as Record<string, unknown>)
    setShowModal(false)
    load()
  }

  async function completeTask(task: Task) {
    await sync.put('tasks', {
      ...task,
      completedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>)
    load()
  }

  function confirmDelete(task: Task) {
    setDeleteTarget(task)
    setShowDeleteConfirm(true)
  }

  async function deleteTask() {
    if (deleteTarget) {
      await sync.delete('tasks', deleteTarget.id)
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
      load()
    }
  }

  // Group tasks by Eisenhower Matrix
  const urgent_important = tasks.filter(t => t.urgency === 'high' && t.importance === 'high')
  const not_urgent_important = tasks.filter(t => t.urgency === 'low' && t.importance === 'high')
  const urgent_not_important = tasks.filter(t => t.urgency === 'high' && t.importance === 'low')
  const not_urgent_not_important = tasks.filter(t => t.urgency === 'low' && t.importance === 'low')

  const Quadrant = ({ title, tasks, color }: { title: string, tasks: Task[], color: string }) => (
    <div style={{
      flex: 1,
      background: `var(--${color}-bg)`,
      border: `1px solid var(--${color}-border)`,
      borderRadius: 8,
      padding: 16,
      minHeight: 200,
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: `var(--${color})`, fontSize: 14, fontWeight: 600 }}>
        {title}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No tasks</p>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                padding: 10,
                cursor: 'pointer',
              }}
              className="hover:opacity-80"
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 500 }}>{task.title}</p>
                  {task.description && (
                    <p style={{ margin: '0 0 6px 0', fontSize: 11, color: 'var(--text-dim)' }}>
                      {task.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {task.tags.map(tag => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          background: 'var(--accent-bg)',
                          borderRadius: 3,
                          color: 'var(--accent)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {task.dueDate && (
                    <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-dim)' }}>
                      Due: {formatDateOnlyGMT3(task.dueDate)}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => completeTask(task)}
                    title="Mark complete"
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => editTask(task)}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    className="btn btn-sm btn-ghost danger"
                    onClick={() => confirmDelete(task)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Tasks</h1>
        <button className="btn btn-primary" onClick={openNewTask}>New Task</button>
      </div>

      {/* Eisenhower Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Quadrant title="🔴 Do First (Urgent & Important)" tasks={urgent_important} color="danger" />
        <Quadrant title="🟠 Schedule (Important, Not Urgent)" tasks={not_urgent_important} color="warning" />
        <Quadrant title="🟡 Delegate (Urgent, Not Important)" tasks={urgent_not_important} color="info" />
        <Quadrant title="⚪ Eliminate (Neither)" tasks={not_urgent_not_important} color="ghost" />
      </div>

      {/* Task Form Modal */}
      {showModal && (
        <Modal title={editingTask ? 'Edit Task' : 'New Task'} onClose={() => setShowModal(false)}>
          <div style={{ maxWidth: 500 }}>
            <div className="form-label">
              Title
              <input
                type="text"
                className="field"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
              />
            </div>

            <div className="form-label">
              Description
              <textarea
                className="field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            <div className="form-label">
              Due Date
              <input
                type="date"
                className="field"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div className="form-label">
                Urgency
                <select
                  className="field"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-label">
                Importance
                <select
                  className="field"
                  value={importance}
                  onChange={(e) => setImportance(e.target.value as 'low' | 'medium' | 'high')}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="form-label">
              Tags
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  className="field"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-secondary" onClick={addTag}>Add</button>
              </div>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        background: 'var(--accent-bg)',
                        border: '1px solid var(--accent-border)',
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                    >
                      {tag}
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}
                        onClick={() => removeTag(tag)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <ConfirmDeleteModal
          title="Delete Task"
          message="Are you sure you want to delete this task?"
          itemName={deleteTarget.title}
          onConfirm={deleteTask}
          onCancel={() => setShowDeleteConfirm(false)}
          isDangerous
        />
      )}
    </div>
  )
}
