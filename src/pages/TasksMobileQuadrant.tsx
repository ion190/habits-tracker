import type { Task } from '../db/database'
import { formatDateOnlyGMT3 } from '../utils'

export default function TasksMobileQuadrant(props: {
  title: string
  tasks: Task[]
  color: 'danger' | 'warning' | 'info' | 'ghost'
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
  onComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onArchive: (task: Task) => void
}) {
  const {
    title,
    tasks,
    color,
    selectedTaskId,
    onSelectTask,
    onComplete,
    onEdit,
    onArchive,
  } = props

  return (
    <div
      style={{
        width: '100%',
        background: `var(--${color}-bg)`,
        border: `1px solid var(--${color}-border)`,
        borderRadius: 8,
        padding: 16,
        minHeight: 200,
      }}
    >
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
                transition: 'all 0.2s',
              }}
              onClick={() => onSelectTask(task.id)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        margin: '0 0 4px 0',
                        fontSize: 14,
                        fontWeight: 600,
                        color: task.id === selectedTaskId ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      {task.title}
                    </p>

                    {task.description && (
                      <p style={{ margin: '0 0 8px 0', fontSize: 12, color: 'var(--text-dim)' }}>
                        {task.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                      {task.tags?.map(tag => (
                        <span
                          key={tag}
                          className="tag"
                          style={{ fontSize: 11 }}
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
                </div>

                {/* Mobile action row: edit/remove controls, without hiding behind click */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={e => {
                      e.stopPropagation()
                      onComplete(task)
                    }}
                    title="Mark complete"
                    style={{ fontSize: 14 }}
                  >
                    ✓
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={e => {
                      e.stopPropagation()
                      onEdit(task)
                    }}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={e => {
                      e.stopPropagation()
                      onArchive(task)
                    }}
                    title="Archive (removes from matrix)"
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

