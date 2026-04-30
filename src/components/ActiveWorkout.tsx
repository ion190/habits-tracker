import { useEffect, useState, useCallback } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { ActiveWorkout, CompletedWorkout, Exercise } from '../db/database'
import { formatDuration } from '../utils'
import ExerciseDetailModal from './ExerciseDetailModal'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
  onFinished: () => void
  onDiscard:  () => void
}

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

export default function ActiveWorkout({ onFinished, onDiscard }: Props) {
  const [session,      setSession]      = useState<ActiveWorkout | null>(null)
  const [exercises,    setExercises]    = useState<Exercise[]>([])
  const [elapsed,      setElapsed]      = useState(0)
  const [detailEx,     setDetailEx]     = useState<Exercise | null>(null)
  const [adding,       setAdding]       = useState(false)
  const [addQuery,     setAddQuery]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Load session and resolve exercise names
  useEffect(() => {
    const raw = localStorage.getItem('activeWorkout')
    if (!raw) return
    const s: ActiveWorkout = JSON.parse(raw)

    db.exercises.toArray().then(exList => {
      setExercises(exList)
      const exMap = new Map(exList.map(e => [e.id, e.name]))
      if (s.exercises) {
        s.exercises = s.exercises.map(ce => ({ ...ce, name: exMap.get(ce.exerciseId) ?? ce.name }))
      }
      setSession(s)
    })
  }, [])

  // Persist session to localStorage on every change
  const persist = useCallback((s: ActiveWorkout) => {
    localStorage.setItem('activeWorkout', JSON.stringify(s))
    setSession(s)
  }, [])

  // Timer
  useEffect(() => {
    if (!session) return
    const start = new Date(session.startedAt).getTime()
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.startedAt])

  if (!session) return null

  // ── Handlers ───────────────────────────────────────────

  function toggleSet(exIdx: number, setIdx: number) {
    if (!session?.exercises) return
    const s = { ...session }
    if (s.exercises) {
      s.exercises = s.exercises.map((ce, i) =>
        i === exIdx ? { ...ce, sets: ce.sets.map((st, j) => j === setIdx ? { ...st, done: !st.done } : st) } : ce
      )
    }
    persist(s)
  }

  function updateSet(exIdx: number, setIdx: number, field: 'reps' | 'weight', val: number) {
    if (!session?.exercises) return
    const s = { ...session }
    if (s.exercises) {
      s.exercises = s.exercises.map((ce, i) =>
        i === exIdx ? { ...ce, sets: ce.sets.map((st, j) => j === setIdx ? { ...st, [field]: val } : st) } : ce
      )
    }
    persist(s)
  }

  function addSet(exIdx: number) {
    if (!session?.exercises) return
    const s = { ...session }
    if (s.exercises && exIdx < s.exercises.length) {
      const lastSet = s.exercises[exIdx].sets.at(-1)
      s.exercises[exIdx].sets = [...s.exercises[exIdx].sets, { reps: lastSet?.reps ?? 10, weight: lastSet?.weight ?? 0, done: false }]
    }
    persist(s)
  }

  function removeSet(exIdx: number, setIdx: number) {
    if (!session?.exercises) return
    const s = { ...session }
    if (s.exercises && exIdx < s.exercises.length) {
      s.exercises[exIdx].sets = s.exercises[exIdx].sets.filter((_, j) => j !== setIdx)
    }
    persist(s)
  }

  function removeExercise(exIdx: number) {
    if (!session?.exercises) return
    const s = { ...session }
    if (s.exercises) {
      s.exercises = s.exercises.filter((_, i) => i !== exIdx)
    }
    persist(s)
  }

  function moveExercise(exIdx: number, dir: -1 | 1) {
    if (!session?.exercises) return
    const s    = { ...session }
    const to   = exIdx + dir
    if (!s.exercises || to < 0 || to >= s.exercises.length) return
    s.exercises = moveItem(s.exercises, exIdx, to)
    persist(s)
  }

  function addExercise(ex: Exercise) {
    if (!session?.exercises) return
    const s = { ...session }
    if (s.exercises) {
      s.exercises = [...s.exercises, {
        exerciseId: ex.id,
        name:       ex.name,
        sets:       [{ reps: 10, weight: 0, done: false }],
      }]
    }
    setAdding(false)
    setAddQuery('')
    persist(s)
  }

  async function finish() {
    if (!session?.exercises || !session?.startedAt) {
      setSaving(false)
      return
    }
    setSaving(true)
    const now        = new Date().toISOString()
    const startedAt  = session.startedAt
    const totalSec   = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)

    const cw: CompletedWorkout = {
      id:                   generateId(),
      workoutPlanId:        session.workoutPlanId || '',
      workoutPlanName:      session.workoutPlanName || '',
      startedAt,
      completedAt:          now,
      totalDurationSeconds: totalSec,
      exercises:            session.exercises.map(ce => ({
        exerciseId: ce.exerciseId,
        name:       ce.name,
        sets:       ce.sets.map(st => ({ ...st, completedAt: now })),
      })),
    }

    await sync.put('completedWorkouts', cw as unknown as Record<string, unknown>)
    localStorage.removeItem('activeWorkout')
    window.dispatchEvent(new CustomEvent('workoutStatusChange'))
    setSaving(false)
    onFinished()
  }

  async function discard() {
    setShowDiscardConfirm(true)
  }

  function confirmDiscard() {
    localStorage.removeItem('activeWorkout')
    window.dispatchEvent(new CustomEvent('workoutStatusChange'))
    setShowDiscardConfirm(false)
    onDiscard()
  }

  const totalSets  = session.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets   = session.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const filteredEx = exercises.filter(e => e.name.toLowerCase().includes(addQuery.toLowerCase()))

  return (
    <div className="active-workout">
      {/* Header */}
      <div className="aw-header">
        <div>
          <h2 className="aw-title">{session.workoutPlanName}</h2>
          <p className="aw-sub">{doneSets}/{totalSets} sets · {formatDuration(elapsed)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost danger" onClick={discard}>Discard</button>
          <button className="btn btn-primary" onClick={finish} disabled={saving}>
            {saving ? 'Saving…' : 'Finish workout'}
          </button>
        </div>
      </div>

      {/* Exercises */}
      <div className="aw-exercises">
        {session.exercises.map((ce, exIdx) => {
          const exData = exercises.find(e => e.id === ce.exerciseId)
          return (
            <div key={`${ce.exerciseId}-${exIdx}`} className="aw-exercise-card">
              <div className="aw-ex-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {exData?.imageUrl && (
                    <img src={exData.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                      onClick={() => exData && setDetailEx(exData)} />
                  )}
                  <p className="item-name" style={{ cursor: 'pointer' }} onClick={() => exData && setDetailEx(exData)}>
                    {ce.name}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button 
                    className="complete-all-btn" 
                    onClick={() => {
                      if (!session?.exercises) return
                      const s = { ...session }
                      if (s.exercises) {
                        s.exercises = s.exercises.map((ce, i) =>
                          i === exIdx ? { ...ce, sets: ce.sets.map(st => ({ ...st, done: true })) } : ce
                        )
                      }
                      persist(s)
                    }}
                    title="Complete all sets"
                  >
                    ✓ All
                  </button>
                  <button className="btn btn-ghost icon-btn" onClick={() => moveExercise(exIdx, -1)} disabled={exIdx === 0} title="Move up">↑</button>
                  <button className="btn btn-ghost icon-btn" onClick={() => moveExercise(exIdx, 1)} disabled={exIdx === session.exercises.length - 1} title="Move down">↓</button>
                  <button className="btn btn-ghost danger icon-btn" onClick={() => removeExercise(exIdx)} title="Remove">✕</button>
                </div>

              </div>

              {/* Set rows */}
              <table className="aw-sets-table">
                <thead>
                  <tr><th>#</th><th>Reps</th><th className="kg-col">kg</th><th></th><th className="done-col">Done</th><th className="remove-col"></th></tr>

                </thead>
                <tbody>
                  {ce.sets.map((set, setIdx) => (
                    <tr key={setIdx} className={set.done ? 'set-done' : ''}>
                      <td>{setIdx + 1}</td>
                      <td>
                        <input type="number" className="field field-sm" min={0} value={set.reps}
                          onChange={e => updateSet(exIdx, setIdx, 'reps', +e.target.value)} />
                      </td>
                      <td className="kg-col">
                        <input type="number" className="field field-sm" min={0} step={0.5} value={set.weight}
                          onChange={e => updateSet(exIdx, setIdx, 'weight', +e.target.value)} />
                      </td>
                      <td></td>
                      <td className="done-col">
                        <button
                          className={`set-check-btn ${set.done ? 'done' : ''}`}
                          onClick={() => toggleSet(exIdx, setIdx)}
                        >
                          {set.done ? '✓' : '○'}
                        </button>
                      </td>
                      <td className="remove-col">
                        <button className="btn btn-ghost danger icon-btn" style={{ padding: '2px 6px', fontSize: 11 }}
                          onClick={() => removeSet(exIdx, setIdx)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>

              </table>
              <button className="btn btn-ghost" style={{ marginTop: 6, fontSize: 12 }} onClick={() => addSet(exIdx)}>
                + Add set
              </button>
            </div>
          )
        })}

        {/* Add exercise */}
        {adding
          ? (
            <div className="card" style={{ padding: 12 }}>
              <input className="field" placeholder="Search exercises…" value={addQuery} onChange={e => setAddQuery(e.target.value)} autoFocus />
              <ul className="item-list" style={{ maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
                {filteredEx.map(ex => (
                  <li key={ex.id} className="item-row" style={{ cursor: 'pointer' }} onClick={() => addExercise(ex)}>
                    <p className="item-name">{ex.name}</p>
                    <p className="item-sub">{ex.category}</p>
                  </li>
                ))}
              </ul>
              <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => setAdding(false)}>Cancel</button>
            </div>
          )
          : (
            <button className="btn btn-secondary" onClick={() => setAdding(true)}>+ Add exercise</button>
          )
        }
      </div>

      {detailEx && <ExerciseDetailModal exercise={detailEx} onClose={() => setDetailEx(null)} />}

      {showDiscardConfirm && (
        <ConfirmDeleteModal
          title="Discard workout"
          message="Are you sure you want to discard this workout? All progress will be lost."
          onConfirm={confirmDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
          isDangerous
        />
      )}
    </div>
  )
}