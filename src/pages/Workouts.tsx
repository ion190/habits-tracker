import { useEffect, useState, useRef } from 'react'
import { db, generateId } from '../db/database'
import type { Exercise, WorkoutPlan, PlanExercise, CompletedWorkout } from '../db/database'
import Modal from '../components/Modal'
import { IconPlus, IconTrash, IconSettings } from '../components/Icons'
import { formatDuration, startOfWeek } from '../utils'

// ── Types ─────────────────────────────────────────────────

interface PlanExerciseRow extends PlanExercise {
  _key: string   // local UI key only
  _name: string  // resolved name for display
}

// ── Small components ──────────────────────────────────────

function QuotaBar({ done, target, onEdit }: { done: number; target: number; onEdit: () => void }) {
  const pct = Math.min(100, Math.round((done / Math.max(target, 1)) * 100))
  const met = done >= target
  return (
    <div className="card quota-section">
      <div className="quota-header">
        <div>
          <h2 className="card-title" style={{ marginBottom: 4 }}>Weekly workout goal</h2>
          <p className="page-sub">{done} of {target} workouts completed this week</p>
        </div>
        <button className="btn btn-ghost icon-btn" onClick={onEdit} title="Edit goal">
          <IconSettings />
        </button>
      </div>
      <div className="quota-bar-track" style={{ marginTop: 12 }}>
        <div className="quota-bar-fill" style={{ width: `${pct}%`, background: met ? '#22c55e' : 'var(--accent)' }} />
      </div>
      {met && <p style={{ fontSize: 12, color: '#22c55e', marginTop: 6 }}>🎉 Goal reached!</p>}
    </div>
  )
}

// ── Exercise picker modal ─────────────────────────────────

function ExercisePicker({
  exercises, onPick, onClose
}: {
  exercises: Exercise[]
  onPick: (ex: Exercise) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtered  = exercises.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <Modal title="Pick exercise" onClose={onClose} width={440}>
      <input
        className="field"
        placeholder="Search exercises…"
        value={q}
        onChange={e => setQ(e.target.value)}
        autoFocus
      />
      {filtered.length === 0
        ? <p className="empty-hint">No exercises found.</p>
        : (
          <ul className="item-list" style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
            {filtered.map(ex => (
              <li key={ex.id} className="item-row" style={{ cursor: 'pointer' }} onClick={() => { onPick(ex); onClose() }}>
                <div>
                  <p className="item-name">{ex.name}</p>
                  <p className="item-sub">{ex.category}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      }
    </Modal>
  )
}

// ── Create / Edit exercise modal ──────────────────────────

function ExerciseModal({
  initial, onSave, onClose
}: {
  initial?: Exercise
  onSave: (ex: Exercise) => void
  onClose: () => void
}) {
  const [name, setName]     = useState(initial?.name ?? '')
  const [cat,  setCat]      = useState(initial?.category ?? '')
  const [desc, setDesc]     = useState(initial?.description ?? '')

  function submit() {
    if (!name.trim()) return
    onSave({
      id:          initial?.id ?? generateId(),
      name:        name.trim(),
      category:    cat.trim() || 'uncategorised',
      description: desc.trim(),
      createdAt:   initial?.createdAt ?? new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Modal title={initial ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <div className="form-stack">
        <label className="form-label">Name *
          <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bench Press" autoFocus />
        </label>
        <label className="form-label">Category
          <input className="field" value={cat} onChange={e => setCat(e.target.value)} placeholder="e.g. chest, legs, cardio" />
        </label>
        <label className="form-label">Description
          <textarea className="field" value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Optional notes…" />
        </label>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Create / Edit plan modal ──────────────────────────────

function PlanModal({
  initial, exercises, onSave, onClose
}: {
  initial?: WorkoutPlan
  exercises: Exercise[]
  onSave: (plan: WorkoutPlan) => void
  onClose: () => void
}) {
  const [name, setName]   = useState(initial?.name ?? '')
  const [desc, setDesc]   = useState(initial?.description ?? '')
  const [rows, setRows]   = useState<PlanExerciseRow[]>(() =>
    (initial?.exercises ?? []).map(pe => ({
      ...pe,
      _key:  generateId(),
      _name: exercises.find(e => e.id === pe.exerciseId)?.name ?? 'Unknown',
    }))
  )
  const [picking, setPicking] = useState(false)

  function addExercise(ex: Exercise) {
    setRows(r => [...r, {
      exerciseId:  ex.id,
      sets:        3,
      reps:        10,
      weight:      0,
      restSeconds: 60,
      _key:        generateId(),
      _name:       ex.name,
    }])
  }

  function updateRow(key: string, field: keyof PlanExercise, val: number) {
    setRows(r => r.map(row => row._key === key ? { ...row, [field]: val } : row))
  }

  function removeRow(key: string) {
    setRows(r => r.filter(row => row._key !== key))
  }

  function submit() {
    if (!name.trim()) return
    onSave({
      id:          initial?.id ?? generateId(),
      name:        name.trim(),
      description: desc.trim(),
      exercises:   rows.map(({ _key, _name, ...pe }) => pe),
      createdAt:   initial?.createdAt ?? new Date().toISOString(),
    })
    onClose()
  }

  return (
    <>
      <Modal title={initial ? 'Edit plan' : 'New workout plan'} onClose={onClose} width={620}>
        <div className="form-stack">
          <label className="form-label">Plan name *
            <input className="field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Push Day" autoFocus />
          </label>
          <label className="form-label">Description
            <input className="field" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
          </label>

          {/* Exercise rows */}
          <div>
            <p className="form-label" style={{ marginBottom: 8 }}>Exercises</p>
            {rows.length === 0 && <p className="empty-hint" style={{ padding: '12px 0' }}>No exercises added yet.</p>}
            {rows.map(row => (
              <div key={row._key} className="plan-ex-row">
                <span className="plan-ex-name">{row._name}</span>
                <label className="plan-ex-field">
                  <span>Sets</span>
                  <input type="number" className="field field-sm" min={1} value={row.sets}
                    onChange={e => updateRow(row._key, 'sets', +e.target.value)} />
                </label>
                <label className="plan-ex-field">
                  <span>Reps</span>
                  <input type="number" className="field field-sm" min={1} value={row.reps}
                    onChange={e => updateRow(row._key, 'reps', +e.target.value)} />
                </label>
                <label className="plan-ex-field">
                  <span>kg</span>
                  <input type="number" className="field field-sm" min={0} value={row.weight}
                    onChange={e => updateRow(row._key, 'weight', +e.target.value)} />
                </label>
                <button className="btn btn-ghost icon-btn" onClick={() => removeRow(row._key)}>
                  <IconTrash />
                </button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setPicking(true)}>
              <IconPlus /> Add exercise
            </button>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>Save plan</button>
          </div>
        </div>
      </Modal>

      {picking && (
        <ExercisePicker
          exercises={exercises}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

// ── Plan card ─────────────────────────────────────────────

function PlanCard({
  plan, exercises, onEdit, onDelete
}: {
  plan: WorkoutPlan
  exercises: Exercise[]
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="plan-card">
      <div className="plan-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="item-name">{plan.name}</p>
          {plan.description && <p className="item-sub">{plan.description}</p>}
          <p className="item-sub" style={{ marginTop: 2 }}>{plan.exercises.length} exercise{plan.exercises.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="plan-card-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>
            {open ? 'Hide' : 'View'}
          </button>
          <button className="btn btn-ghost" onClick={onEdit}>Edit</button>
          <button className="btn btn-ghost danger" onClick={onDelete}><IconTrash /></button>
        </div>
      </div>

      {open && (
        <div className="plan-exercises">
          {plan.exercises.length === 0
            ? <p className="empty-hint">No exercises in this plan.</p>
            : (
              <table className="ex-table">
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Sets</th>
                    <th>Reps</th>
                    <th>Weight</th>
                    <th>Rest</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.exercises.map((pe, i) => {
                    const ex = exercises.find(e => e.id === pe.exerciseId)
                    return (
                      <tr key={i}>
                        <td>{ex?.name ?? 'Unknown'}</td>
                        <td>{pe.sets}</td>
                        <td>{pe.reps}</td>
                        <td>{pe.weight} kg</td>
                        <td>{pe.restSeconds}s</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </div>
      )}
    </div>
  )
}

// ── Main Workouts page ────────────────────────────────────

export default function Workouts() {
  const [plans,       setPlans]       = useState<WorkoutPlan[]>([])
  const [exercises,   setExercises]   = useState<Exercise[]>([])
  const [recentW,     setRecentW]     = useState<CompletedWorkout[]>([])
  const [loading,     setLoading]     = useState(true)

  // Modals
  const [planModal,   setPlanModal]   = useState<'new' | WorkoutPlan | null>(null)
  const [exModal,     setExModal]     = useState<'new' | Exercise | null>(null)
  const [goalModal,   setGoalModal]   = useState(false)

  const [weeklyTarget, setWeeklyTarget] = useState(() =>
    parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3')
  )
  const goalRef = useRef<HTMLInputElement>(null)

  async function reload() {
    const [p, e, w] = await Promise.all([
      db.workoutPlans.toArray(),
      db.exercises.orderBy('name').toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().limit(20).toArray(),
    ])
    setPlans(p)
    setExercises(e)
    setRecentW(w)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  // --- Handlers ---

  async function savePlan(plan: WorkoutPlan) {
    await db.workoutPlans.put(plan)
    reload()
  }

  async function deletePlan(id: string) {
    if (!confirm('Delete this workout plan?')) return
    await db.workoutPlans.delete(id)
    reload()
  }

  async function saveExercise(ex: Exercise) {
    await db.exercises.put(ex)
    reload()
  }

  async function deleteExercise(id: string) {
    if (!confirm('Delete this exercise?')) return
    await db.exercises.delete(id)
    reload()
  }

  function saveGoal() {
    const val = parseInt(goalRef.current?.value ?? '3')
    if (isNaN(val) || val < 1) return
    localStorage.setItem('weeklyWorkoutTarget', String(val))
    setWeeklyTarget(val)
    setGoalModal(false)
  }

  if (loading) return <div className="page-loading">Loading…</div>

  const weekStart        = startOfWeek()
  const workoutsThisWeek = recentW.filter(w => new Date(w.startedAt) >= weekStart)

  return (
    <div className="page">
      <div className="page-header">
        <h1>Workouts</h1>
        <p className="page-sub">Plans, exercises and history</p>
      </div>

      {/* Quota */}
      <QuotaBar
        done={workoutsThisWeek.length}
        target={weeklyTarget}
        onEdit={() => setGoalModal(true)}
      />

      {/* Workout Plans */}
      <section>
        <div className="section-header">
          <h2 className="card-title" style={{ marginBottom: 0 }}>Workout plans</h2>
          <button className="btn btn-primary" onClick={() => setPlanModal('new')}>
            <IconPlus /> New plan
          </button>
        </div>
        {plans.length === 0
          ? (
            <div className="card">
              <p className="empty-hint">No plans yet. Create one to get started.</p>
            </div>
          )
          : plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              exercises={exercises}
              onEdit={() => setPlanModal(plan)}
              onDelete={() => deletePlan(plan.id)}
            />
          ))
        }
      </section>

      {/* Exercise database */}
      <section>
        <div className="section-header">
          <h2 className="card-title" style={{ marginBottom: 0 }}>Exercise database</h2>
          <button className="btn btn-secondary" onClick={() => setExModal('new')}>
            <IconPlus /> New exercise
          </button>
        </div>
        <div className="card">
          {exercises.length === 0
            ? <p className="empty-hint">No exercises yet.</p>
            : (
              <ul className="item-list">
                {exercises.map(ex => (
                  <li key={ex.id} className="item-row">
                    <div style={{ flex: 1 }}>
                      <p className="item-name">{ex.name}</p>
                      <p className="item-sub">{ex.category}{ex.description ? ` · ${ex.description}` : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" onClick={() => setExModal(ex)}>Edit</button>
                      <button className="btn btn-ghost danger" onClick={() => deleteExercise(ex.id)}><IconTrash /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          }
        </div>
      </section>

      {/* Recent completed workouts */}
      <section>
        <h2 className="card-title">Completed workouts</h2>
        <div className="card">
          {recentW.length === 0
            ? <p className="empty-hint">No completed workouts yet.</p>
            : (
              <ul className="item-list">
                {recentW.map(w => {
                  const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
                  const doneSets  = w.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
                  return (
                    <li key={w.id} className="item-row">
                      <div>
                        <p className="item-name">{w.workoutPlanName}</p>
                        <p className="item-sub">
                          {new Date(w.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}{formatDuration(w.totalDurationSeconds)}
                          {' · '}{w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}
                          {' · '}{doneSets}/{totalSets} sets done
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )
          }
        </div>
      </section>

      {/* ── Modals ── */}

      {planModal && (
        <PlanModal
          initial={planModal === 'new' ? undefined : planModal}
          exercises={exercises}
          onSave={savePlan}
          onClose={() => setPlanModal(null)}
        />
      )}

      {exModal && (
        <ExerciseModal
          initial={exModal === 'new' ? undefined : exModal}
          onSave={saveExercise}
          onClose={() => setExModal(null)}
        />
      )}

      {goalModal && (
        <Modal title="Edit weekly goal" onClose={() => setGoalModal(false)} width={360}>
          <div className="form-stack">
            <label className="form-label">Workouts per week
              <input
                ref={goalRef}
                className="field"
                type="number"
                min={1}
                max={14}
                defaultValue={weeklyTarget}
                autoFocus
              />
            </label>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setGoalModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveGoal}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}