import { useEffect, useState } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { WorkoutPlan, CompletedWorkout, CompletedExercise, CompletedSet } from '../db/database'
import Modal from './Modal'

interface Props {
  onClose: () => void
  onStarted: () => void
}

// ── Add past workout modal ────────────────────────────────

function AddPastWorkoutModal({ plans, onClose, onSaved }: {
  plans: WorkoutPlan[]
  onClose: () => void
  onSaved: () => void
}) {
  const [planId,   setPlanId]   = useState(plans[0]?.id ?? '')
  const [dateStr,  setDateStr]  = useState(new Date().toISOString().slice(0, 16))
  const [durMin,   setDurMin]   = useState(45)
  const [saving,   setSaving]   = useState(false)

  async function save() {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    setSaving(true)

    const startedAt   = new Date(dateStr).toISOString()
    const completedAt = new Date(new Date(dateStr).getTime() + durMin * 60000).toISOString()

    const exercises: CompletedExercise[] = plan.exercises.map(pe => {
      const sets: CompletedSet[] = Array.from({ length: pe.sets }, () => ({
        reps: pe.reps, weight: pe.weight, done: true, completedAt: startedAt
      }))
      return { exerciseId: pe.exerciseId, name: '', sets }
    })

    // Resolve exercise names
    const exIds  = plan.exercises.map(pe => pe.exerciseId)
    const exList = await db.exercises.where('id').anyOf(exIds).toArray()
    const exMap  = new Map(exList.map(e => [e.id, e.name]))
    exercises.forEach(ce => { ce.name = exMap.get(ce.exerciseId) ?? 'Unknown' })

    const cw: CompletedWorkout = {
      id:                   generateId(),
      workoutPlanId:        plan.id,
      workoutPlanName:      plan.name,
      startedAt,
      completedAt,
      totalDurationSeconds: durMin * 60,
      exercises,
    }

    await sync.put('completedWorkouts', cw as unknown as Record<string, unknown>)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <Modal title="Log past workout" onClose={onClose} width={420}>
      <div className="form-stack">
        <label className="form-label">Workout plan
          <select className="field" value={planId} onChange={e => setPlanId(e.target.value)}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="form-label">Date &amp; time
          <input className="field" type="datetime-local" value={dateStr} onChange={e => setDateStr(e.target.value)} />
        </label>
        <label className="form-label">Duration (minutes)
          <input className="field" type="number" min={1} value={durMin} onChange={e => setDurMin(+e.target.value)} />
        </label>
        <p className="item-sub">All sets will be marked as done. You can edit them later.</p>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !planId}>
            {saving ? 'Saving…' : 'Log workout'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main start workout modal ──────────────────────────────

export default function StartWorkoutModal({ onClose, onStarted }: Props) {
  const [plans,    setPlans]    = useState<WorkoutPlan[]>([])
  const [lastDone, setLastDone] = useState<Map<string, string>>(new Map()) // planId → latest completedAt
  const [secondLast, setSecondLast] = useState<string | null>(null)        // suggested plan id
  const [pastModal, setPastModal] = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [p, cw] = await Promise.all([
        db.workoutPlans.toArray(),
        db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
      ])
      setPlans(p)

      // Build last-done map
      const map = new Map<string, string>()
      for (const w of cw) {
        if (!map.has(w.workoutPlanId)) map.set(w.workoutPlanId, w.completedAt)
      }
      setLastDone(map)

      // Second-last = the plan done before the most recent one
      if (cw.length >= 2) {
        const firstPlanId  = cw[0].workoutPlanId
        const secondEntry  = cw.find(w => w.workoutPlanId !== firstPlanId)
        setSecondLast(secondEntry?.workoutPlanId ?? null)
      }

      setLoading(false)
    }
    load()
  }, [])

  function startWorkout(plan: WorkoutPlan) {
    // Save active session to localStorage so it survives page close
    const session = {
      workoutPlanId:   plan.id,
      workoutPlanName: plan.name,
      startedAt:       new Date().toISOString(),
      exercises:       plan.exercises.map(pe => ({
        exerciseId: pe.exerciseId,
        name:       '',  // resolved on ActiveWorkout mount
        sets:       Array.from({ length: pe.sets }, () => ({
          reps: pe.reps, weight: pe.weight, done: false,
        })),
      })),
    }
    localStorage.setItem('activeWorkout', JSON.stringify(session))
    onStarted()
    onClose()
  }

  // Sort plans: most recently done first, then never-done alphabetically
  const sorted = [...plans].sort((a, b) => {
    const aDate = lastDone.get(a.id) ?? ''
    const bDate = lastDone.get(b.id) ?? ''
    if (aDate && bDate) return bDate.localeCompare(aDate)
    if (aDate) return -1
    if (bDate) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <>
      <Modal title="Start workout" onClose={onClose} width={480}>
        {loading
          ? <p className="empty-hint">Loading…</p>
          : (
            <div className="form-stack">
              {plans.length === 0
                ? <p className="empty-hint">No workout plans yet. Create one in the Workouts page.</p>
                : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                    {sorted.map(plan => {
                      const last    = lastDone.get(plan.id)
                      const isSugg  = plan.id === secondLast
                      return (
                        <div
                          key={plan.id}
                          className="start-plan-row"
                          style={{ borderColor: isSugg ? 'var(--accent)' : 'var(--border)', background: isSugg ? 'var(--accent-bg)' : 'var(--code-bg)' }}
                          onClick={() => startWorkout(plan)}
                        >
                          <div style={{ flex: 1 }}>
                            <p className="item-name">{plan.name}</p>
                            <p className="item-sub">
                              {plan.exercises.length} exercises
                              {last ? ` · last done ${new Date(last).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' · never done'}
                            </p>
                          </div>
                          {isSugg && <span className="suggest-badge">Suggested</span>}
                        </div>
                      )
                    })}
                  </div>
                )
              }

              <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={() => setPastModal(true)}>
                  Log past workout
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              </div>
            </div>
          )
        }
      </Modal>

      {pastModal && (
        <AddPastWorkoutModal
          plans={plans}
          onClose={() => setPastModal(false)}
          onSaved={onStarted}
        />
      )}
    </>
  )
}