import { useEffect, useState, useRef } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Exercise, WorkoutPlan, PlanExercise, CompletedWorkout, CompletedExercise } from '../db/database'
import Modal from '../components/Modal'
import { IconPlus, IconTrash, IconSettings } from '../components/Icons'
import { formatDuration, startOfWeek, formatDateOnlyGMT3 } from '../utils'

// ── Completion circle ─────────────────────────────────────

function CompletionCircle({ pct }: { pct: number }) {
  const r = 16; const circ = 2 * Math.PI * r
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ}
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fill={color} fontSize="10" fontWeight="600">{pct}%</text>
    </svg>
  )
}

// ── Completed workout modal ───────────────────────────────

function WorkoutDetailModal({ workout, exercises, onClose }: {
  workout: CompletedWorkout
  exercises: Exercise[]
  onClose: () => void
}) {
  const totalSets = workout.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets  = workout.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const pct       = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  return (
    <Modal title={workout.workoutPlanName} onClose={onClose} width={580}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <CompletionCircle pct={pct} />
        <div>
          <p className="item-name">{formatDateOnlyGMT3(workout.startedAt).split(', ').slice(0, 4).join(', ')}</p>
          <p className="item-sub">{formatDuration(workout.totalDurationSeconds)} · {doneSets}/{totalSets} sets done · {workout.exercises.length} exercises</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
        {workout.exercises.map((ce, i) => {
          const ex = exercises.find(e => e.id === ce.exerciseId)
          const doneCt = ce.sets.filter(s => s.done).length
          return (
            <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <p className="item-name">{ce.name}</p>
                <span style={{ fontSize: 12, color: doneCt === ce.sets.length ? '#22c55e' : 'var(--text)' }}>
                  {doneCt}/{ce.sets.length} sets
                </span>
              </div>
              {ex?.imageUrl && (
                <img src={ex.imageUrl} alt={ce.name} style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} />
              )}
              <table className="ex-table">
                <thead><tr><th>Set</th><th>Reps</th><th>Weight</th><th>Status</th></tr></thead>
                <tbody>
                  {ce.sets.map((set, si) => (
                    <tr key={si} style={{ opacity: set.done ? 1 : 0.45 }}>
                      <td>{si + 1}</td>
                      <td>{set.reps}</td>
                      <td>{set.weight} kg</td>
                      <td>{set.done ? '✓ Done' : '✗ Skipped'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ── Exercise image upload ────────────────────────────────

function ImageUpload({ value, onChange }: { value?: string; onChange: (b64: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => onChange(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value && (
        <div style={{ position: 'relative' }}>
          <img src={value} alt="preview" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
          <button className="btn btn-ghost danger" style={{ position: 'absolute', top: 6, right: 6, padding: '4px 8px', fontSize: 11 }} onClick={() => onChange(undefined)}>
            Remove
          </button>
        </div>
      )}
      <button className="btn btn-secondary" onClick={() => ref.current?.click()}>
        {value ? 'Change image' : 'Add image'}
      </button>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ── Exercise modal ────────────────────────────────────────

function ExerciseModal({ initial, onSave, onClose }: {
  initial?: Exercise; onSave: (ex: Exercise) => void; onClose: () => void
}) {
  const [name,     setName]     = useState(initial?.name ?? '')
  const [cat,      setCat]      = useState(initial?.category ?? '')
  const [desc,     setDesc]     = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState<string | undefined>(initial?.imageUrl)

  function submit() {
    if (!name.trim()) return
    onSave({ id: initial?.id ?? generateId(), name: name.trim(), category: cat.trim() || 'uncategorised', description: desc.trim(), imageUrl, createdAt: initial?.createdAt ?? new Date().toISOString() })
    onClose()
  }

  return (
    <Modal title={initial ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <div className="form-stack">
        <label className="form-label">Name *<input className="field" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
        <label className="form-label">Category<input className="field" value={cat} onChange={e => setCat(e.target.value)} placeholder="e.g. chest, legs, cardio" /></label>
        <label className="form-label">Description<textarea className="field" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></label>
        <div className="form-label">Image<ImageUpload value={imageUrl} onChange={setImageUrl} /></div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit}>Save</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Exercise picker ───────────────────────────────────────

interface PlanExRow extends PlanExercise { _key: string; _name: string }

function ExercisePicker({ exercises, onPick, onClose }: { exercises: Exercise[]; onPick: (ex: Exercise) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const filtered = exercises.filter(e => e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Modal title="Pick exercise" onClose={onClose} width={440}>
      <input className="field" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
      <ul className="item-list" style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
        {filtered.length === 0 ? <p className="empty-hint">No exercises found.</p>
          : filtered.map(ex => (
            <li key={ex.id} className="item-row" style={{ cursor: 'pointer' }} onClick={() => { onPick(ex); onClose() }}>
              <div style={{ flex: 1 }}><p className="item-name">{ex.name}</p><p className="item-sub">{ex.category}</p></div>
              {ex.imageUrl && <img src={ex.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />}
            </li>
          ))
        }
      </ul>
    </Modal>
  )
}

// ── Plan modal ────────────────────────────────────────────

function PlanModal({ initial, exercises, onSave, onClose }: { initial?: WorkoutPlan; exercises: Exercise[]; onSave: (p: WorkoutPlan) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [rows, setRows] = useState<PlanExRow[]>(() =>
    (initial?.exercises ?? []).map(pe => ({ ...pe, _key: generateId(), _name: exercises.find(e => e.id === pe.exerciseId)?.name ?? 'Unknown' }))
  )
  const [picking, setPicking] = useState(false)

  function addEx(ex: Exercise) {
    setRows(r => [...r, { exerciseId: ex.id, sets: 3, reps: 10, weight: 0, restSeconds: 60, _key: generateId(), _name: ex.name }])
  }

  function update(key: string, field: keyof PlanExercise, val: number) {
    setRows(r => r.map(row => row._key === key ? { ...row, [field]: val } : row))
  }

  function submit() {
    if (!name.trim()) return
    onSave({ id: initial?.id ?? generateId(), name: name.trim(), description: desc.trim(), exercises: rows.map(({ _key: _k, _name: _n, ...pe }) => pe), createdAt: initial?.createdAt ?? new Date().toISOString() })
    onClose()
  }

  return (
    <>
      <Modal title={initial ? 'Edit plan' : 'New plan'} onClose={onClose} width={620}>
        <div className="form-stack">
          <label className="form-label">Plan name *<input className="field" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
          <label className="form-label">Description<input className="field" value={desc} onChange={e => setDesc(e.target.value)} /></label>
          <div>
            <p className="form-label" style={{ marginBottom: 8 }}>Exercises</p>
            {rows.length === 0 && <p className="empty-hint" style={{ padding: '12px 0' }}>No exercises added yet.</p>}
            {rows.map(row => (
              <div key={row._key} className="plan-ex-row">
                <span className="plan-ex-name">{row._name}</span>
                <label className="plan-ex-field"><span>Sets</span><input type="number" className="field field-sm" min={1} value={row.sets} onChange={e => update(row._key, 'sets', +e.target.value)} /></label>
                <label className="plan-ex-field"><span>Reps</span><input type="number" className="field field-sm" min={1} value={row.reps} onChange={e => update(row._key, 'reps', +e.target.value)} /></label>
                <label className="plan-ex-field"><span>kg</span><input type="number" className="field field-sm" min={0} value={row.weight} onChange={e => update(row._key, 'weight', +e.target.value)} /></label>
                <button className="btn btn-ghost icon-btn" onClick={() => setRows(r => r.filter(x => x._key !== row._key))}><IconTrash /></button>
              </div>
            ))}
            <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => setPicking(true)}><IconPlus /> Add exercise</button>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>Save plan</button>
          </div>
        </div>
      </Modal>
      {picking && <ExercisePicker exercises={exercises} onPick={addEx} onClose={() => setPicking(false)} />}
    </>
  )
}

// ── Plan card ─────────────────────────────────────────────

function PlanCard({ plan, exercises, onEdit, onDelete }: { plan: WorkoutPlan; exercises: Exercise[]; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="plan-card">
      <div className="plan-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="item-name">{plan.name}</p>
          {plan.description && <p className="item-sub">{plan.description}</p>}
          <p className="item-sub">{plan.exercises.length} exercise{plan.exercises.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="plan-card-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'View'}</button>
          <button className="btn btn-ghost" onClick={onEdit}>Edit</button>
          <button className="btn btn-ghost danger" onClick={onDelete}><IconTrash /></button>
        </div>
      </div>
      {open && (
        <div className="plan-exercises">
          {plan.exercises.length === 0 ? <p className="empty-hint">No exercises.</p> : (
            <table className="ex-table">
              <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th><th>Rest</th></tr></thead>
              <tbody>
                {plan.exercises.map((pe, i) => {
                  const ex = exercises.find(e => e.id === pe.exerciseId)
                  return (
                    <tr key={i}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {ex?.imageUrl && <img src={ex.imageUrl} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />}
                        {ex?.name ?? 'Unknown'}
                      </td>
                      <td>{pe.sets}</td><td>{pe.reps}</td><td>{pe.weight}kg</td><td>{pe.restSeconds}s</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ── Completed workout row ─────────────────────────────────

function WorkoutRow({ w, exercises, onClick }: { w: CompletedWorkout; exercises: Exercise[]; onClick: () => void }) {
  const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets  = w.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const pct       = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0

  return (
    <li className="item-row" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          <p className="item-name">{w.workoutPlanName}</p>
          <span className="item-sub" style={{ whiteSpace: 'nowrap' }}>{formatDuration(w.totalDurationSeconds)}</span>
        </div>
        <p className="item-sub">
          {new Date(w.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}{w.exercises.length} exercises · {doneSets}/{totalSets} sets
        </p>
      </div>
      <CompletionCircle pct={pct} />
    </li>
  )
}

// ── Filter types ──────────────────────────────────────────

type TimeFilter = 'all' | 'week' | 'month' | '3months' | '6months' | 'year'

function filterWorkouts(ws: CompletedWorkout[], time: TimeFilter, name: string): CompletedWorkout[] {
  let result = ws
  if (name) result = result.filter(w => w.workoutPlanName.toLowerCase().includes(name.toLowerCase()))
  if (time !== 'all') {
    const days: Record<TimeFilter, number> = { all: 0, week: 7, month: 30, '3months': 90, '6months': 180, year: 365 }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days[time])
    result = result.filter(w => new Date(w.startedAt) >= cutoff)
  }
  return result
}

// ── Main page ─────────────────────────────────────────────

export default function Workouts() {
  const [plans,       setPlans]       = useState<WorkoutPlan[]>([])
  const [exercises,   setExercises]   = useState<Exercise[]>([])
  const [allWorkouts, setAllWorkouts] = useState<CompletedWorkout[]>([])
  const [loading,     setLoading]     = useState(true)

  // Exercise filters
  const [exCatFilter,  setExCatFilter]  = useState('all')
  const [exPlanFilter, setExPlanFilter] = useState('all')

  // Completed workout filters
  const [timeFilter,  setTimeFilter]  = useState<TimeFilter>('all')
  const [nameFilter,  setNameFilter]  = useState('')

  // Modals
  const [planModal,    setPlanModal]    = useState<'new' | WorkoutPlan | null>(null)
  const [exModal,      setExModal]      = useState<'new' | Exercise | null>(null)
  const [detailModal,  setDetailModal]  = useState<CompletedWorkout | null>(null)
  const [goalModal,    setGoalModal]    = useState(false)

  const [weeklyTarget, setWeeklyTarget] = useState(() => parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3'))
  const goalRef = useRef<HTMLInputElement>(null)

  async function reload() {
    const [p, e, w] = await Promise.all([
      db.workoutPlans.toArray(),
      db.exercises.orderBy('name').toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
    ])
    setPlans(p); setExercises(e); setAllWorkouts(w); setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function savePlan(plan: WorkoutPlan) { await sync.put('workoutPlans', plan as unknown as Record<string, unknown>); reload() }
  async function deletePlan(id: string) { if (!confirm('Delete this plan?')) return; await sync.delete('workoutPlans', id); reload() }
  async function saveExercise(ex: Exercise) { await sync.put('exercises', ex as unknown as Record<string, unknown>); reload() }
  async function deleteExercise(id: string) { if (!confirm('Delete?')) return; await sync.delete('exercises', id); reload() }

  function saveGoal() {
    const val = parseInt(goalRef.current?.value ?? '3')
    if (!isNaN(val) && val > 0) { localStorage.setItem('weeklyWorkoutTarget', String(val)); setWeeklyTarget(val) }
    setGoalModal(false)
  }

  if (loading) return <div className="page-loading">Loading…</div>

  const weekStart = startOfWeek()
  const thisWeek  = allWorkouts.filter(w => new Date(w.startedAt) >= weekStart)

  // Unique categories for filter
  const categories = ['all', ...Array.from(new Set(exercises.map(e => e.category).filter(Boolean)))]

  // Exercises filtered by category and plan membership
  const planExIds = exPlanFilter === 'all' ? null : new Set(plans.find(p => p.id === exPlanFilter)?.exercises.map(pe => pe.exerciseId) ?? [])
  const filteredExercises = exercises.filter(e => {
    if (exCatFilter !== 'all' && e.category !== exCatFilter) return false
    if (planExIds && !planExIds.has(e.id)) return false
    return true
  })

  const filteredWorkouts = filterWorkouts(allWorkouts, timeFilter, nameFilter)

  return (
    <div className="page">
      <div className="page-header"><h1>Workouts</h1><p className="page-sub">Plans, exercises and history</p></div>

      {/* Quota */}
      <div className="card quota-section">
        <div className="quota-header">
          <div>
            <h2 className="card-title" style={{ marginBottom: 4 }}>Weekly goal</h2>
            <p className="page-sub">{thisWeek.length} of {weeklyTarget} workouts this week</p>
          </div>
          <button className="btn btn-ghost icon-btn" onClick={() => setGoalModal(true)}><IconSettings /></button>
        </div>
        <div className="quota-bar-track" style={{ marginTop: 12 }}>
          <div className="quota-bar-fill" style={{ width: `${Math.min(100, Math.round(thisWeek.length / weeklyTarget * 100))}%`, background: thisWeek.length >= weeklyTarget ? '#22c55e' : 'var(--accent)' }} />
        </div>
        {thisWeek.length >= weeklyTarget && <p style={{ fontSize: 12, color: '#22c55e', marginTop: 6 }}>🎉 Goal reached!</p>}
      </div>

      {/* Plans */}
      <section>
        <div className="section-header">
          <h2 className="card-title" style={{ marginBottom: 0 }}>Workout plans</h2>
          <button className="btn btn-primary" onClick={() => setPlanModal('new')}><IconPlus /> New plan</button>
        </div>
        {plans.length === 0 ? <div className="card"><p className="empty-hint">No plans yet.</p></div>
          : plans.map(plan => <PlanCard key={plan.id} plan={plan} exercises={exercises} onEdit={() => setPlanModal(plan)} onDelete={() => deletePlan(plan.id)} />)
        }
      </section>

      {/* Exercise DB */}
      <section>
        <div className="section-header">
          <h2 className="card-title" style={{ marginBottom: 0 }}>Exercise database</h2>
          <button className="btn btn-secondary" onClick={() => setExModal('new')}><IconPlus /> New exercise</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <select className="field" style={{ width: 'auto' }} value={exCatFilter} onChange={e => setExCatFilter(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
          <select className="field" style={{ width: 'auto' }} value={exPlanFilter} onChange={e => setExPlanFilter(e.target.value)}>
            <option value="all">All plans</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(exCatFilter !== 'all' || exPlanFilter !== 'all') && (
            <button className="btn btn-ghost" onClick={() => { setExCatFilter('all'); setExPlanFilter('all') }}>Clear filters</button>
          )}
        </div>

        <div className="card">
          {filteredExercises.length === 0 ? <p className="empty-hint">No exercises match filters.</p>
            : (
              <ul className="item-list">
                {filteredExercises.map(ex => (
                  <li key={ex.id} className="item-row">
                    {ex.imageUrl && <img src={ex.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
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

      {/* Completed workouts */}
      <section>
        <h2 className="card-title">Completed workouts</h2>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <input className="field" style={{ width: 200 }} placeholder="Filter by name…" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
          <select className="field" style={{ width: 'auto' }} value={timeFilter} onChange={e => setTimeFilter(e.target.value as TimeFilter)}>
            <option value="all">All time</option>
            <option value="week">Last week</option>
            <option value="month">Last month</option>
            <option value="3months">Last 3 months</option>
            <option value="6months">Last 6 months</option>
            <option value="year">Last year</option>
          </select>
          {(nameFilter || timeFilter !== 'all') && (
            <button className="btn btn-ghost" onClick={() => { setNameFilter(''); setTimeFilter('all') }}>Clear</button>
          )}
        </div>

        <div className="card">
          {filteredWorkouts.length === 0 ? <p className="empty-hint">No completed workouts match filters.</p>
            : (
              <ul className="item-list">
                {filteredWorkouts.map(w => (
                  <WorkoutRow key={w.id} w={w} exercises={exercises} onClick={() => setDetailModal(w)} />
                ))}
              </ul>
            )
          }
        </div>
      </section>

      {/* Modals */}
      {planModal && <PlanModal initial={planModal === 'new' ? undefined : planModal} exercises={exercises} onSave={savePlan} onClose={() => setPlanModal(null)} />}
      {exModal && <ExerciseModal initial={exModal === 'new' ? undefined : exModal} onSave={saveExercise} onClose={() => setExModal(null)} />}
      {detailModal && <WorkoutDetailModal workout={detailModal} exercises={exercises} onClose={() => setDetailModal(null)} />}
      {goalModal && (
        <Modal title="Weekly goal" onClose={() => setGoalModal(false)} width={360}>
          <div className="form-stack">
            <label className="form-label">Workouts per week<input ref={goalRef} className="field" type="number" min={1} max={14} defaultValue={weeklyTarget} autoFocus /></label>
            <div className="form-actions"><button className="btn btn-secondary" onClick={() => setGoalModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveGoal}>Save</button></div>
          </div>
        </Modal>
      )}
    </div>
  )
}