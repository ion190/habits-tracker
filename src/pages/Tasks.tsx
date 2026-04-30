import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Task } from '../db/database'
import { formatDateOnlyGMT3 } from '../utils'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import TaskHeatmap from '../components/TaskHeatmap'

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTaskId = searchParams.get('taskId') || null

  const [tasks, setTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)

  // Tag filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const allTags = useMemo(() => {
    return Array.from(new Set(tasks.flatMap(t => t.tags ?? []))).sort()
  }, [tasks])

  const displayedTasks = useMemo(() => {
    if (selectedTags.length === 0) return tasks
    return tasks.filter(t => selectedTags.every(tag => t.tags?.includes(tag)))
  }, [tasks, selectedTags])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium')
  const [importance, setImportance] = useState<'low' | 'medium' | 'high'>('medium')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Load tasks
async function load() {
    const all = await db.tasks.toArray()
    const active = all
      .filter(t => !t.archivedAt && !t.completedAt)
      .sort((a, b) => {
        const impOrder = { high: 3, medium: 2, low: 1 }
        if (impOrder[b.importance] !== impOrder[a.importance]) {
          return impOrder[b.importance] - impOrder[a.importance]
        }
        return impOrder[b.urgency] - impOrder[a.urgency]
      })
    const completed = all
      .filter(t => !!t.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    const archived = all
      .filter(t => t.archivedAt && !t.completedAt)
      .sort((a, b) => new Date(b.archivedAt!).getTime() - new Date(a.archivedAt!).getTime())

    console.log('📋 Tasks load:', { 
      totalTasks: all.length, 
      active: active.length, 
      completed: completed.length, 
      archived: archived.length,
      completedThisWeek: completed.filter(t => {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        return new Date(t.completedAt!) >= weekAgo
      }).length
    })
    setTasks(active)
    setCompletedTasks(completed)
    setArchivedTasks(archived)
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
      completedAt: editingTask?.completedAt ?? undefined,
      createdAt: editingTask?.createdAt ?? new Date().toISOString(),
      tags,
      urgency,
      importance,
      archivedAt: editingTask?.archivedAt ?? undefined,
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

  async function archiveTask(task: Task) {
    await sync.put('tasks', {
      ...task,
      archivedAt: new Date().toISOString(),
    } as unknown as Record<string, unknown>)
    load()
  }

  async function unarchiveTask(task: Task) {
    const { archivedAt, ...rest } = task
    await sync.put('tasks', rest as unknown as Record<string, unknown>)
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
  const urgent_important = displayedTasks.filter(t => t.urgency === 'high' && t.importance === 'high')
  const not_urgent_important = displayedTasks.filter(t => t.urgency === 'low' && t.importance === 'high')
  const urgent_not_important = displayedTasks.filter(t => t.urgency === 'high' && t.importance === 'low')
  const not_urgent_not_important = displayedTasks.filter(t => t.urgency === 'low' && t.importance === 'low')

  const Quadrant = ({ title, tasks, color }: { title: string, tasks: Task[], color: string, selectedTaskId?: string | null }) => {
    return (
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
                id={`quad-task-${task.id}`}
                style={{
                  background: 'var(--card-bg)',
                  border: `2px solid ${task.id === selectedTaskId ? 'var(--accent)' : 'var(--card-border)'}`,
                  borderRadius: 8,
                  padding: 12,
                  cursor: 'pointer',
                  boxShadow: task.id === selectedTaskId ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                  transition: 'all 0.2s'
                }}
                className="hover:opacity-80"
                onClick={() => {
                  if (task.id === selectedTaskId) {
                    setSearchParams({})
                  } else {
                    setSearchParams({ taskId: task.id })
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: 14, 
                      fontWeight: 600,
                      color: task.id === selectedTaskId ? 'var(--accent)' : 'var(--text)'
                    }}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>
                        {task.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {task.tags?.map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            background: 'var(--accent-bg)',
                            borderRadius: 4,
                            color: 'var(--accent)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {task.dueDate && (
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>
                        Due: {formatDateOnlyGMT3(task.dueDate)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => { e.stopPropagation(); completeTask(task) }}
                      title="Mark complete"
                      style={{ fontSize: 14 }}
                    >
                      ✓
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => { e.stopPropagation(); editTask(task) }}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => { e.stopPropagation(); archiveTask(task) }}
                      title="Archive"
                    >
                      🗃
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // All tasks list - above heatmap
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null

  useEffect(() => {
    if (selectedTask) {
      // Scroll to selected task after render
      setTimeout(() => {
        const el = document.getElementById(`task-${selectedTask.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [tasks, selectedTaskId])

  const AllTasksList = () => (
    <section className="card" style={{ marginBottom: 20 }}>
      <h2 className="card-title" style={{ marginBottom: 12 }}>All Tasks ({displayedTasks.length})</h2>
      <div style={{ 
        maxHeight: 400, 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 8 
      }}>
        {displayedTasks.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No active tasks</p>
        ) : (
          displayedTasks.map(task => (
            <div
              key={task.id}
              id={`task-${task.id}`}
              style={{
                background: 'var(--card-bg)',
                border: `2px solid ${task.id === selectedTaskId ? 'var(--accent)' : 'var(--card-border)'}`,
                borderRadius: 8,
                padding: 12,
                cursor: 'pointer',
                boxShadow: task.id === selectedTaskId ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                if (task.id === selectedTaskId) {
                  setSearchParams({})
                } else {
                  setSearchParams({ taskId: task.id })
                }
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ 
                    margin: '0 0 4px 0', 
                    fontSize: 14, 
                    fontWeight: 600,
                    color: task.id === selectedTaskId ? 'var(--accent)' : 'var(--text)'
                  }}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>
                      {task.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    {task.tags?.map(tag => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          background: 'var(--accent-bg)',
                          borderRadius: 4,
                          color: 'var(--accent)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {task.dueDate && (
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-dim)' }}>
                      Due: {formatDateOnlyGMT3(task.dueDate)}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, minWidth: 80, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => { e.stopPropagation(); completeTask(task) }}
                    title="Mark complete"
                    style={{ fontSize: 14 }}
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => { e.stopPropagation(); editTask(task) }}
                    title="Edit"
                  >
                    ✎
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )

  const allTasksForHeatmap = [...displayedTasks, ...archivedTasks.filter(t => selectedTags.length === 0 || selectedTags.every(tag => t.tags?.includes(tag)) )]

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Tasks ({displayedTasks.length})</h1>
        <button className="btn btn-primary" onClick={openNewTask}>New Task</button>
      </div>

      {/* Tag Filter UI */}
      {allTags.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Filter by tags:</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 8px',
                  background: selectedTags.length === 0 ? 'var(--accent-bg)' : 'var(--bg)',
                  border: `1px solid ${selectedTags.length === 0 ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedTags([])}
              >
                All ({tasks.length})
              </span>
              {allTags.map(tag => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: selectedTags.includes(tag) ? 'var(--accent-bg)' : 'var(--bg)',
                    border: `1px solid ${selectedTags.includes(tag) ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                    )
                  }}
                >
                  {tag} ({tasks.filter(t => t.tags?.includes(tag)).length})
                  {selectedTags.includes(tag) && <span style={{ marginLeft: 4 }}>✕</span>}
                </span>
              ))}
            </div>
            {selectedTags.length > 0 && (
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setSelectedTags([])}
                style={{ fontSize: 12 }}
              >
                Clear ({displayedTasks.length})
              </button>
            )}
          </div>
        </div>
      )}

      <AllTasksList />

      {/* Task Heatmap */}
      <section className="card heatmap-card">
        <h2 className="card-title">Task completion — last year</h2>
        <TaskHeatmap tasks={allTasksForHeatmap} />
      </section>

      {/* Eisenhower Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <Quadrant title="🔴 Do First (Urgent & Important)" tasks={urgent_important} color="danger" selectedTaskId={selectedTaskId} />
        <Quadrant title="🟠 Schedule (Important, Not Urgent)" tasks={not_urgent_important} color="warning" selectedTaskId={selectedTaskId} />
        <Quadrant title="🟡 Delegate (Urgent, Not Important)" tasks={urgent_not_important} color="info" selectedTaskId={selectedTaskId} />
        <Quadrant title="⚪ Eliminate (Neither)" tasks={not_urgent_not_important} color="ghost" selectedTaskId={selectedTaskId} />
      </div>

      {/* Tasks Done section */}
      <section className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title" style={{ marginBottom: 12 }}>Tasks Done ({completedTasks.length})</h2>
        <div style={{ 
          maxHeight: 300, 
          overflowY: 'auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 8 
        }}>
          {completedTasks.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No completed tasks yet</p>
          ) : (
            completedTasks.slice(0, 10).map(task => (  // Show recent 10
              <div
                key={task.id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--success-border)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: 14, 
                      fontWeight: 600,
                      color: 'var(--success)'
                    }}>
                      ✓ {task.title}
                    </p>
                    {task.description && (
                      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>
                        {task.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {task.tags?.map(tag => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            background: 'var(--success-bg)',
                            borderRadius: 4,
                            color: 'var(--success)',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {task.dueDate && <span>Due: {formatDateOnlyGMT3(task.dueDate)}</span>}
                      {task.completedAt && <span>Done: {formatDateOnlyGMT3(task.completedAt)}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {completedTasks.length > 10 && (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, padding: 12 }}>
              +{completedTasks.length - 10} more...
            </p>
          )}
        </div>
      </section>

      {/* Show archived toggle */}
      {archivedTasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button
            className="btn btn-secondary"
            onClick={() => setShowArchived(s => !s)}
          >
            {showArchived ? '▲ Hide archived' : `▼ Show archived (${archivedTasks.length})`}
          </button>
        </div>
      )}

      {/* Archived tasks section */}
      {showArchived && archivedTasks.length > 0 && (
        <section className="card" style={{ opacity: 0.7 }}>
          <h2 className="card-title">Archived tasks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archivedTasks.map(task => (
              <div
                key={task.id}
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: 13, fontWeight: 500 }}>{task.title}</p>
                    {task.description && (
                      <p style={{ margin: '0 0 6px 0', fontSize: 11, color: 'var(--text-dim)' }}>
                        {task.description}
                      </p>
                    )}
                    {task.dueDate && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 10, color: 'var(--text-dim)' }}>
                        Due: {formatDateOnlyGMT3(task.dueDate)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => unarchiveTask(task)}
                      title="Unarchive"
                    >
                      ↩
                    </button>
                    <button
                      className="btn btn-sm btn-ghost danger"
                      onClick={() => confirmDelete(task)}
                      title="Delete permanently"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
          message="Are you sure you want to permanently delete this task?"
          itemName={deleteTarget.title}
          onConfirm={deleteTask}
          onCancel={() => setShowDeleteConfirm(false)}
          isDangerous
        />
      )}
    </div>
  )
}

