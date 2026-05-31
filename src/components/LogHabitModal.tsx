import { useMemo, useState } from 'react'

import Modal from './Modal'
import DatePickerInput from './DatePickerInput'
import type { Habit } from '../db/database'


interface Props {
  habits: Habit[]
  initialDateKey?: string
  onClose: () => void
  onSave: (payload: { habitId: string; dateKey: string; value?: number }) => void
}

export default function LogHabitModal({ habits, initialDateKey, onClose, onSave }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey ?? new Date().toISOString().slice(0, 10))

  // Multi-select: habit IDs
  const [habitIds, setHabitIds] = useState<string[]>(() => (habits[0]?.id ? [habits[0].id] : []))





  function toggleHabitSelection(id: string) {
    setHabitIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function submit() {
    if (!dateKey || habitIds.length === 0) return
    for (const id of habitIds) onSave({ habitId: id, dateKey })
    onClose()
  }





  return (
    <Modal title="Log a habit" onClose={onClose} width={520}>
      <div className="form-stack">
        <div className="form-label">
          Date
          <DatePickerInput value={dateKey} onChange={setDateKey} />
        </div>

        <div className="form-label">
          Habits
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              padding: 10,
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'var(--bg)',
            }}
          >
            {habits.map(h => {
              const selected = habitIds.includes(h.id)
              return (
                <button
                  key={h.id}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => toggleHabitSelection(h.id)}
                  style={{
                    borderColor: selected ? h.color : 'var(--border)',
                    background: selected ? h.color + '22' : 'var(--bg)',
                    color: selected ? h.color : 'var(--text)',
                  }}
                  aria-pressed={selected}
                >
                  {h.name}
                </button>
              )
            })}
          </div>
        </div>



        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!dateKey || habitIds.length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}


