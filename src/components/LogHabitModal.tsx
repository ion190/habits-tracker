import { useMemo, useState } from 'react'

import Modal from './Modal'
import DatePickerInput from './DatePickerInput'
import { useEnterSave } from './useEnterSave'

import type { Habit } from '../db/database'


interface Props {
  habits: Habit[]
  initialDateKey?: string
  onClose: () => void
  onSave: (payload: { habitId: string; dateKey: string; value?: number }) => void
}

interface HabitState {
  selected: boolean
  value: string
}

type HabitStates = Record<string, HabitState>

export default function LogHabitModal({ habits, initialDateKey, onClose, onSave }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey ?? new Date().toISOString().slice(0, 10))
  const [habitStates, setHabitStates] = useState<HabitStates>(() =>
    habits.reduce((acc, habit) => {
      acc[habit.id] = { selected: false, value: '' }
      return acc
    }, {} as HabitStates),
  )

  const selectedHabits = useMemo(
    () => habits.filter(habit => habitStates[habit.id]?.selected),
    [habits, habitStates],
  )

  function toggleHabitSelection(id: string) {
    setHabitStates(prev => ({
      ...prev,
      [id]: {
        selected: !prev[id]?.selected,
        value: prev[id]?.value || '',
      },
    }))
  }

  function updateHabitValue(id: string, fieldValue: string) {
    setHabitStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        value: fieldValue,
      },
    }))
  }

  const canSave = useMemo(() => {
    if (!dateKey || selectedHabits.length === 0) return false
    return selectedHabits.every(habit => {
      if (!habit.quota) return true
      const value = parseFloat(habitStates[habit.id]?.value ?? '')
      return !Number.isNaN(value) && value >= 0
    })
  }, [dateKey, selectedHabits, habitStates])

  const submit = () => {
    if (!canSave) return
    selectedHabits.forEach(habit => {
      const rawValue = habitStates[habit.id]?.value
      const value = habit.quota ? parseFloat(rawValue) : undefined
      onSave({ habitId: habit.id, dateKey, value })
    })
    onClose()
  }

  useEnterSave(submit)






  return (
    <Modal title="Log a habit" onClose={onClose} width={520}>
      <div className="form-stack">
        <div className="form-label">
          Date
          <DatePickerInput value={dateKey} onChange={setDateKey} />
        </div>

        <div className="form-label">
          Habits
          <div className="habit-grid">
            {habits.map(habit => {
              const selected = habitStates[habit.id]?.selected
              return (
                <div key={habit.id} className={`habit-card ${selected ? 'selected' : ''}`}>
                  <button
                    type="button"
                    className="habit-card-button"
                    onClick={() => toggleHabitSelection(habit.id)}
                    aria-pressed={selected}
                  >
                    <div className="habit-card-title">{habit.name}</div>
                    <div className="habit-card-sub">
                      <span>{habit.frequency}</span>
                      {habit.quota && (
                        <span>{habit.quota.target}{habit.quota.unit ? ` ${habit.quota.unit}` : ''}</span>
                      )}
                    </div>
                  </button>

                  {selected && habit.quota && (
                    <div className="habit-card-value">
                      <label className="form-label" style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
                        Enter {habit.quota.unit}
                      </label>
                      <input
                        className="field"
                        type="number"
                        min={0}
                        step={habit.quota.type === 'time' ? '0.5' : '1'}
                        value={habitStates[habit.id]?.value ?? ''}
                        onChange={e => updateHabitValue(habit.id, e.target.value)}
                        placeholder={habit.quota.unit || 'Value'}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!canSave}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}


