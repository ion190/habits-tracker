import { useState } from 'react'
import Modal from './Modal'

interface Props {
  habitName: string
  quotaType: 'quantity' | 'time'
  unit: string
  onSave: (value: number) => void
  onClose: () => void
}

export default function HabitValueModal({ habitName, quotaType, unit, onSave, onClose }: Props) {
  const [value, setValue] = useState('')

  function submit() {
    const num = parseFloat(value)
    if (Number.isNaN(num) || num < 0) return
    onSave(num)
    onClose()
  }

  return (
    <Modal title={`Log ${habitName}`} onClose={onClose} width={360}>
      <div className="form-stack">
        <label className="form-label">
          {quotaType === 'time' ? 'Time spent' : 'Amount completed'} ({unit})
          <input
            className="field"
            type="number"
            min={0}
            step={quotaType === 'time' ? '0.5' : '1'}
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            placeholder={`Enter ${unit}...`}
          />
        </label>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!value || Number.isNaN(parseFloat(value))}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
