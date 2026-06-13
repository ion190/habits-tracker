import { useMemo, useState } from 'react'


import Modal from './Modal'
import { useEnterSave } from './useEnterSave'

import type { Habit } from '../db/database'
import DatePickerInput from './DatePickerInput'

interface Props {
  habit: Habit
  initialDateKey: string
  onClose: () => void
  onConfirm: (payload: { habitId: string; dateKey: string; value: number }) => void
}

export default function LogHabitQuotaModal({ habit, initialDateKey, onClose, onConfirm }: Props) {
  const [dateKey, setDateKey] = useState(initialDateKey)
  const [value, setValue] = useState('')

  const requiresValue = !!habit.quota

  const parsedValue = useMemo(() => {
    if (!requiresValue) return undefined
    const n = parseFloat(value)
    if (Number.isNaN(n) || n < 0) return undefined
    return n
  }, [requiresValue, value])



  const submit = () => {
    if (!requiresValue || !parsedValue) return
    onConfirm({ habitId: habit.id, dateKey, value: parsedValue })
    onClose()
  }

  useEnterSave(submit)

  return (
    <Modal title={`Log quota: ${habit.name}`} onClose={onClose} width={420}>


      <div className="form-stack">
        <div className="form-label">
          Date
          <DatePickerInput value={dateKey} onChange={setDateKey} />
        </div>

        <div className="form-label">
          Value ({habit.quota?.unit})
          <input
            className="field"
            type="number"
            min={0}
            step={habit.quota?.type === 'time' ? '0.5' : '1'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={`Enter ${habit.quota?.unit ?? ''}`}
          />
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={parsedValue === undefined}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

