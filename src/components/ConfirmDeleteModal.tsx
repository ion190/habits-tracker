import { useEffect } from 'react'

interface Props {
  title: string
  message?: string
  itemName?: string
  onConfirm: () => void
  onCancel: () => void
  isDangerous?: boolean
}

export default function ConfirmDeleteModal({
  title,
  message = 'Are you sure you want to delete this?',
  itemName,
  onConfirm,
  onCancel,
  isDangerous = false,
}: Props) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onClick={(e) => {
      if (e.target === e.currentTarget) onCancel()
    }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ marginBottom: 12, color: 'var(--text)' }}>
            {message}
            {itemName && <strong style={{ display: 'block', marginTop: 4, color: 'var(--text-h)' }}>"{itemName}"</strong>}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text)', marginBottom: 16 }}>
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={onConfirm}
              style={{
                background: isDangerous ? '#ef4444' : 'var(--accent)',
                color: 'white',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
