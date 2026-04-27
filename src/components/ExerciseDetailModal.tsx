import type { Exercise } from '../db/database'
import Modal from './Modal'

interface Props {
  exercise: Exercise
  onClose: () => void
  onEdit?: () => void
}

export default function ExerciseDetailModal({ exercise, onClose, onEdit }: Props) {
  return (
    <Modal title={exercise.name} onClose={onClose} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {exercise.imageUrl && (
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            style={{ width: '100%', maxHeight: 240, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="detail-row">
            <span className="detail-label">Category</span>
            <span className="detail-value">{exercise.category || '—'}</span>
          </div>
          {exercise.description && (
            <div className="detail-row">
              <span className="detail-label">Notes</span>
              <span className="detail-value">{exercise.description}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="detail-label">Added</span>
            <span className="detail-value">{new Date(exercise.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {onEdit && (
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={onEdit}>Edit exercise</button>
          </div>
        )}
      </div>
    </Modal>
  )
}