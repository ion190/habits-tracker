import { useEffect, useState, useRef } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Exercise, WorkoutPlan, PlanExercise, CompletedWorkout } from '../db/database'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import ExerciseDetailModal from '../components/ExerciseDetailModal'
import StartWorkoutModal from '../components/StartWorkoutModal'
import ActiveWorkout from '../components/ActiveWorkout'
import { IconPlus, IconTrash, IconSettings } from '../components/Icons'
import { formatDuration, startOfWeek, toDateKey } from '../utils'

// ── Completion circle ─────────────────────────────────────

function CompletionCircle({ pct }: { pct: number }) {
  const r = 16; const circ = 2 * Math.PI * r
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ - (pct / 100) * circ} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fill={color} fontSize="10" fontWeight="600">{pct}%</text>
    </svg>
  )
}

// ── Workout detail modal ──────────────────────────────────

function WorkoutDetailModal({ workout, exercises, onClose }: {
  workout: CompletedWorkout; exercises: Exercise[]; onClose: () => void
}) {
  const totalSets = workout.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets  = workout.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const pct       = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0
  return (
    <Modal title={workout.workoutPlanName} onClose={onClose} width={580}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <CompletionCircle pct={pct} />
        <div>
          <p className="item-name">{new Date(workout.startedAt).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}</p>
          <p className="item-sub">{formatDuration(workout.totalDurationSeconds)} · {doneSets}/{totalSets} sets · {workout.exercises.length} exercises</p>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:420, overflowY:'auto' }}>
        {workout.exercises.map((ce, i) => {
          const ex = exercises.find(e => e.id === ce.exerciseId)
          const doneCt = ce.sets.filter(s => s.done).length
          return (
            <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {ex?.imageUrl && <img src={ex.imageUrl} alt="" style={{ width:32, height:32, objectFit:'cover', borderRadius:4 }} />}
                  <p className="item-name">{ce.name}</p>
                </div>
                <span style={{ fontSize:12, color: doneCt===ce.sets.length ? '#22c55e' : 'var(--text)' }}>{doneCt}/{ce.sets.length} sets</span>
              </div>
              <table className="ex-table">
                <thead><tr><th>Set</th><th>Reps</th><th>Weight</th><th>Status</th></tr></thead>
                <tbody>
                  {ce.sets.map((set, si) => (
                    <tr key={si} style={{ opacity: set.done ? 1 : 0.45 }}>
                      <td>{si+1}</td><td>{set.reps}</td><td>{set.weight} kg</td><td>{set.done ? '✓ Done' : '✗ Skipped'}</td>
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

// ── Workout heatmap ───────────────────────────────────────

function WorkoutHeatmap({ workouts }: { workouts: CompletedWorkout[] }) {
  const map = new Map<string, number>()
  for (const w of workouts) { const d = toDateKey(w.startedAt); map.set(d, (map.get(d) ?? 0) + 1) }
  const days = Array.from({ length: 364 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (363 - i)); return toDateKey(d.toISOString()) })
  const firstDayOfWeek = new Date(days[0]).getDay() // 0=Sun, 1=Mon...6=Sat
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Convert to Monday-first: 0=Mon, 6=Sun
  const cls = (n: number) => n === 0 ? 'hm-0' : n === 1 ? 'hm-1' : n <= 3 ? 'hm-3' : 'hm-4'
  return (
    <div className="heatmap-wrap" style={{ marginTop: 16 }}>
      <div className="heatmap-grid">
        {Array(pad).fill(null).map((_, i) => <div key={`p${i}`} className="hm-cell hm-0" />)}
        {days.map(d => <div key={d} className={`hm-cell ${cls(map.get(d) ?? 0)}`} title={`${d}: ${map.get(d) ?? 0} workout(s)`} />)}
      </div>
    </div>
  )
}

// ── Exercise image upload ─────────────────────────────────

function ImageUpload({ value, onChange }: { value?: string; onChange: (b64: string | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {value && (
        <div style={{ position:'relative' }}>
          <img src={value} alt="preview" style={{ width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)' }} />
          <button className="btn btn-ghost danger" style={{ position:'absolute', top:6, right:6, padding:'4px 8px', fontSize:11 }} onClick={() => onChange(undefined)}>Remove</button>
        </div>
      )}
      <button className="btn btn-secondary" onClick={() => ref.current?.click()}>{value ? 'Change image' : 'Add image'}</button>
      <input ref={ref} type="file" accept="image/*" style={{ display:'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => onChange(ev.target?.result as string); r.readAsDataURL(f) }} />
    </div>
  )
}

// ── Exercise modal ────────────────────────────────────────

function ExerciseModal({ initial, onSave, onClose }: { initial?: Exercise; onSave: (ex: Exercise) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cat,  setCat]  = useState(initial?.category ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [img,  setImg]  = useState<string | undefined>(initial?.imageUrl)
  function submit() {
    if (!name.trim()) return
    onSave({ id: initial?.id ?? generateId(), name: name.trim(), category: cat.trim() || 'uncategorised', description: desc.trim(), imageUrl: img, createdAt: initial?.createdAt ?? new Date().toISOString() })
    onClose()
  }
  return (
    <Modal title={initial ? 'Edit exercise' : 'New exercise'} onClose={onClose}>
      <div className="form-stack">
        <label className="form-label">Name *<input className="field" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
        <label className="form-label">Category<input className="field" value={cat} onChange={e => setCat(e.target.value)} /></label>
        <label className="form-label">Description<textarea className="field" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></label>
        <div className="form-label">Image<ImageUpload value={img} onChange={setImg} /></div>
        <div className="form-actions"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Save</button></div>
      </div>
    </Modal>
  )
}

// ── Plan modal with reorder ───────────────────────────────

interface PlanExRow extends PlanExercise { _key: string; _name: string }

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const copy = [...arr]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item); return copy
}

function PlanModal({ initial, exercises, onSave, onClose }: {
  initial?: WorkoutPlan; exercises: Exercise[]; onSave: (p: WorkoutPlan) => void; onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [desc, setDesc] = useState(initial?.description ?? '')
  const [rows, setRows] = useState<PlanExRow[]>(() =>
    (initial?.exercises ?? []).map(pe => ({ ...pe, _key: generateId(), _name: exercises.find(e => e.id === pe.exerciseId)?.name ?? 'Unknown' }))
  )
  const [picking, setPicking] = useState(false)
  const [detailEx, setDetailEx] = useState<Exercise | null>(null)

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
      <Modal title={initial ? 'Edit plan' : 'New plan'} onClose={onClose} width={640}>
        <div className="form-stack">
          <label className="form-label">Plan name *<input className="field" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
          <label className="form-label">Description<input className="field" value={desc} onChange={e => setDesc(e.target.value)} /></label>

          <div>
            <p className="form-label" style={{ marginBottom:8 }}>Exercises</p>
            {rows.length === 0 && <p className="empty-hint" style={{ padding:'12px 0' }}>None added yet.</p>}
            {rows.map((row, idx) => {
              const exData = exercises.find(e => e.id === row.exerciseId)
              return (
                <div key={row._key} className="plan-ex-row">
                  {/* Reorder */}
                  <div style={{ display:'flex', flexDirection:'column', gap:2, flexShrink:0 }}>
                    <button className="btn btn-ghost icon-btn" style={{ padding:'2px 5px', fontSize:10 }} onClick={() => setRows(r => moveItem(r, idx, idx-1))} disabled={idx===0}>↑</button>
                    <button className="btn btn-ghost icon-btn" style={{ padding:'2px 5px', fontSize:10 }} onClick={() => setRows(r => moveItem(r, idx, idx+1))} disabled={idx===rows.length-1}>↓</button>
                  </div>
                  {exData?.imageUrl && (
                    <img src={exData.imageUrl} alt="" style={{ width:32, height:32, objectFit:'cover', borderRadius:4, cursor:'pointer' }}
                      onClick={() => exData && setDetailEx(exData)} />
                  )}
                  <span className="plan-ex-name" style={{ cursor:'pointer' }} onClick={() => exData && setDetailEx(exData)}>{row._name}</span>
                  <label className="plan-ex-field"><span>Sets</span><input type="number" className="field field-sm" min={1} value={row.sets} onChange={e => update(row._key,'sets',+e.target.value)} /></label>
                  <label className="plan-ex-field"><span>Reps</span><input type="number" className="field field-sm" min={1} value={row.reps} onChange={e => update(row._key,'reps',+e.target.value)} /></label>
                  <label className="plan-ex-field"><span>kg</span><input type="number" className="field field-sm" min={0} value={row.weight} onChange={e => update(row._key,'weight',+e.target.value)} /></label>
                  <button className="btn btn-ghost danger icon-btn" onClick={() => setRows(r => r.filter(x => x._key !== row._key))}><IconTrash /></button>
                </div>
              )
            })}
            <button className="btn btn-secondary" style={{ marginTop:8 }} onClick={() => setPicking(true)}><IconPlus /> Add exercise</button>
          </div>

          <div className="form-actions"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={submit}>Save plan</button></div>
        </div>
      </Modal>

      {picking && (
        <Modal title="Pick exercise" onClose={() => setPicking(false)} width={440}>
          <ul className="item-list" style={{ maxHeight:320, overflowY:'auto' }}>
            {exercises.map(ex => (
              <li key={ex.id} className="item-row" style={{ cursor:'pointer' }}
                onClick={() => { setRows(r => [...r, { exerciseId:ex.id, sets:3, reps:10, weight:0, _key:generateId(), _name:ex.name }]); setPicking(false) }}>
                {ex.imageUrl && <img src={ex.imageUrl} alt="" style={{ width:36, height:36, objectFit:'cover', borderRadius:6 }} />}
                <div><p className="item-name">{ex.name}</p><p className="item-sub">{ex.category}</p></div>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {detailEx && <ExerciseDetailModal exercise={detailEx} onClose={() => setDetailEx(null)} />}
    </>
  )
}

// ── Plan card ─────────────────────────────────────────────

function PlanCard({ plan, exercises, onEdit, onDelete }: { plan: WorkoutPlan; exercises: Exercise[]; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [detailEx, setDetailEx] = useState<Exercise | null>(null)
  return (
    <>
      <div className="plan-card" onClick={() => setOpen(o => !o)} style={{ cursor:'pointer' }}>
        <div className="plan-card-header" onClick={e => e.stopPropagation()}>
          <div style={{ flex:1, minWidth:0 }} onClick={() => setOpen(o => !o)}>
            <p className="item-name">{plan.name}</p>
            {plan.description && <p className="item-sub">{plan.description}</p>}
            <p className="item-sub">{plan.exercises.length} exercises</p>
          </div>
          <div className="plan-card-actions">
            <button className="btn btn-ghost" onClick={onEdit}>Edit</button>
            <button className="btn btn-ghost danger" onClick={onDelete}><IconTrash /></button>
          </div>
        </div>
        {open && (
          <div className="plan-exercises">
            {plan.exercises.length === 0 ? <p className="empty-hint">No exercises.</p> : (
              <table className="ex-table">
                <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Weight</th></tr></thead>
                <tbody>
                  {plan.exercises.map((pe, i) => {
                    const ex = exercises.find(e => e.id === pe.exerciseId)
                    return (
                      <tr key={i} style={{ cursor:'pointer' }} onClick={() => ex && setDetailEx(ex)}>
                        <td style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {ex?.imageUrl && <img src={ex.imageUrl} alt="" style={{ width:28, height:28, objectFit:'cover', borderRadius:4 }} />}
                          {ex?.name ?? 'Unknown'}
                        </td>
                        <td>{pe.sets}</td><td>{pe.reps}</td><td>{pe.weight}kg</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {detailEx && <ExerciseDetailModal exercise={detailEx} onClose={() => setDetailEx(null)} />}
    </>
  )
}

// ── Completed workout row ─────────────────────────────────

function WorkoutRow({ w, exercises, onClick }: { w: CompletedWorkout; exercises: Exercise[]; onClick: () => void }) {
  const [open, setOpen] = useState(false)
  const totalSets = w.exercises.reduce((s, e) => s + e.sets.length, 0)
  const doneSets  = w.exercises.reduce((s, e) => s + e.sets.filter(st => st.done).length, 0)
  const pct       = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0
  return (
    <li>
      <div className="item-row" style={{ cursor:'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
            <p className="item-name">{w.workoutPlanName}</p>
            <span className="item-sub" style={{ whiteSpace:'nowrap' }}>{formatDuration(w.totalDurationSeconds)}</span>
          </div>
          <p className="item-sub">
            {new Date(w.startedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
            {' · '}{w.exercises.length} exercises · {doneSets}/{totalSets} sets
          </p>
        </div>
        <CompletionCircle pct={pct} />
      </div>

      {open && (
        <div style={{ padding:'10px 12px', borderTop:'1px solid var(--border)', background:'var(--bg)' }}>
          {w.exercises.map((ce, i) => {
            const ex = exercises.find(e => e.id === ce.exerciseId)
            return (
              <div key={i} className="item-row" style={{ cursor:'pointer' }} onClick={e => { e.stopPropagation(); onClick() }}>
                {ex?.imageUrl && <img src={ex.imageUrl} alt="" style={{ width:32, height:32, objectFit:'cover', borderRadius:4 }} />}
                <div style={{ flex:1 }}>
                  <p className="item-name" style={{ fontSize:13 }}>{ce.name}</p>
                  <p className="item-sub">{ce.sets.filter(s => s.done).length}/{ce.sets.length} sets done</p>
                </div>
              </div>
            )
          })}
          <button className="btn btn-ghost" style={{ marginTop:6, fontSize:12 }} onClick={e => { e.stopPropagation(); onClick() }}>
            View full details →
          </button>
        </div>
      )}
    </li>
  )
}

// ── Filter types ──────────────────────────────────────────

type TimeFilter = 'all'|'week'|'month'|'3months'|'6months'|'year'

function filterWorkouts(ws: CompletedWorkout[], time: TimeFilter, name: string): CompletedWorkout[] {
  let r = name ? ws.filter(w => w.workoutPlanName.toLowerCase().includes(name.toLowerCase())) : ws
  if (time !== 'all') {
    const days: Record<TimeFilter, number> = { all:0, week:7, month:30, '3months':90, '6months':180, year:365 }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days[time])
    r = r.filter(w => new Date(w.startedAt) >= cutoff)
  }
  return r
}

// ── Main Workouts page ────────────────────────────────────

export default function Workouts() {
  const [plans,        setPlans]        = useState<WorkoutPlan[]>([])
  const [exercises,    setExercises]    = useState<Exercise[]>([])
  const [allWorkouts,  setAllWorkouts]  = useState<CompletedWorkout[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showAllEx,    setShowAllEx]    = useState(false)
  const [showAllCW,    setShowAllCW]    = useState(false)
  const [showHeatmap,  setShowHeatmap]  = useState(false)
  const [exCatFilter,  setExCatFilter]  = useState('all')
  const [exPlanFilter, setExPlanFilter] = useState('all')
  const [timeFilter,   setTimeFilter]   = useState<TimeFilter>('all')
  const [nameFilter,   setNameFilter]   = useState('')
  const [planModal,    setPlanModal]    = useState<'new'|WorkoutPlan|null>(null)
  const [exModal,      setExModal]      = useState<'new'|Exercise|null>(null)
  const [detailModal,  setDetailModal]  = useState<CompletedWorkout|null>(null)
  const [exDetailModal,setExDetailModal]= useState<Exercise|null>(null)
  const [goalModal,    setGoalModal]    = useState(false)
  const [showStart,    setShowStart]    = useState(false)
  const [showActive,   setShowActive]   = useState(!!localStorage.getItem('activeWorkout'))
  const [weeklyTarget, setWeeklyTarget] = useState(() => parseInt(localStorage.getItem('weeklyWorkoutTarget') ?? '3'))
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)
  const [deletePlanName, setDeletePlanName] = useState<string>('')
  const [deleteExerciseId, setDeleteExerciseId] = useState<string | null>(null)
  const [deleteExerciseName, setDeleteExerciseName] = useState<string>('')
  const goalRef = useRef<HTMLInputElement>(null)

  async function reload() {
    const [p, e, w] = await Promise.all([
      db.workoutPlans.orderBy('createdAt').reverse().toArray(),
      db.exercises.orderBy('name').toArray(),
      db.completedWorkouts.orderBy('startedAt').reverse().toArray(),
    ])
    setPlans(p); setExercises(e); setAllWorkouts(w); setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function savePlan(plan: WorkoutPlan) { await sync.put('workoutPlans', plan as unknown as Record<string,unknown>); reload() }
  async function deletePlan(id: string) { await sync.delete('workoutPlans', id); setDeletePlanId(null); reload() }
  async function saveExercise(ex: Exercise) { await sync.put('exercises', ex as unknown as Record<string,unknown>); reload() }
  async function deleteExercise(id: string) { await sync.delete('exercises', id); setDeleteExerciseId(null); reload() }

  function saveGoal() {
    const val = parseInt(goalRef.current?.value ?? '3')
    if (!isNaN(val) && val > 0) { localStorage.setItem('weeklyWorkoutTarget', String(val)); setWeeklyTarget(val) }
    setGoalModal(false)
  }

  if (loading) return <div className="page-loading">Loading…</div>
  if (showActive) return (
    <ActiveWorkout
      onFinished={() => { setShowActive(false); reload() }}
      onDiscard={() => setShowActive(false)}
    />
  )

  const weekStart    = startOfWeek()
  const thisWeek     = allWorkouts.filter(w => new Date(w.startedAt) >= weekStart)
  const categories   = ['all', ...Array.from(new Set(exercises.map(e => e.category)))]
  const planExIds    = exPlanFilter === 'all' ? null : new Set(plans.find(p => p.id === exPlanFilter)?.exercises.map(pe => pe.exerciseId) ?? [])
  const filteredEx   = exercises.filter(e => {
    if (exCatFilter !== 'all' && e.category !== exCatFilter) return false
    if (planExIds && !planExIds.has(e.id)) return false
    return true
  })
  const filteredCW    = filterWorkouts(allWorkouts, timeFilter, nameFilter)
  const displayedEx   = showAllEx  ? filteredEx   : filteredEx.slice(0, 8)
  const displayedCW   = showAllCW  ? filteredCW   : filteredCW.slice(0, 8)

  return (
    <div className="page">
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div><h1>Workouts</h1><p className="page-sub">Plans, exercises and history</p></div>
        <div style={{ display:'flex', gap:8 }}>
          {localStorage.getItem('activeWorkout') && (
            <button className="btn btn-secondary" onClick={() => setShowActive(true)}>▶ Resume workout</button>
          )}
          <button className="btn btn-primary" onClick={() => setShowStart(true)}><IconPlus /> Start workout</button>
        </div>
      </div>

      {/* Quota */}
      <div className="card quota-section">
        <div className="quota-header">
          <div><h2 className="card-title" style={{ marginBottom:4 }}>Weekly goal</h2><p className="page-sub">{thisWeek.length} of {weeklyTarget} this week</p></div>
          <button className="btn btn-ghost icon-btn" onClick={() => setGoalModal(true)}><IconSettings /></button>
        </div>
        <div className="quota-bar-track" style={{ marginTop:12 }}>
          <div className="quota-bar-fill" style={{ width:`${Math.min(100, Math.round(thisWeek.length/weeklyTarget*100))}%`, background: thisWeek.length>=weeklyTarget?'#22c55e':'var(--accent)' }} />
        </div>
        {thisWeek.length >= weeklyTarget && <p style={{ fontSize:12, color:'#22c55e', marginTop:6 }}>🎉 Goal reached!</p>}
      </div>

      {/* Completed workouts — FIRST now */}
      <section>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:8 }}>
          <h2 className="card-title" style={{ marginBottom:0 }}>Completed workouts</h2>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <input className="field" style={{ width:160 }} placeholder="Filter by name…" value={nameFilter} onChange={e => setNameFilter(e.target.value)} />
            <select className="field" style={{ width:'auto' }} value={timeFilter} onChange={e => setTimeFilter(e.target.value as TimeFilter)}>
              <option value="all">All time</option>
              <option value="week">Last week</option>
              <option value="month">Last month</option>
              <option value="3months">Last 3 months</option>
              <option value="6months">Last 6 months</option>
              <option value="year">Last year</option>
            </select>
            <button className={`btn ${showHeatmap ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowHeatmap(h => !h)}>
              {showHeatmap ? 'Hide heatmap' : '📅 Heatmap'}
            </button>
            {(nameFilter || timeFilter !== 'all') && <button className="btn btn-ghost" onClick={() => { setNameFilter(''); setTimeFilter('all') }}>Clear</button>}
          </div>
        </div>

        {showHeatmap && (
          <div className="card" style={{ marginBottom:12 }}>
            <h2 className="card-title">Workout frequency</h2>
            <WorkoutHeatmap workouts={filteredCW} />
          </div>
        )}

        <div className="card">
          {filteredCW.length === 0 ? <p className="empty-hint">No completed workouts match filters.</p> : (
            <>
              <ul className="item-list">
                {displayedCW.map(w => <WorkoutRow key={w.id} w={w} exercises={exercises} onClick={() => setDetailModal(w)} />)}
              </ul>
              {filteredCW.length > 8 && (
                <button className="btn btn-ghost" style={{ width:'100%', marginTop:8 }} onClick={() => setShowAllCW(s => !s)}>
                  {showAllCW ? 'Show less' : `Show all ${filteredCW.length} workouts`}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Exercise database — SECOND */}
      <section>
        <div className="section-header">
          <h2 className="card-title" style={{ marginBottom:0 }}>Exercise database</h2>
          <button className="btn btn-secondary" onClick={() => setExModal('new')}><IconPlus /> New exercise</button>
        </div>
        <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
          <select className="field" style={{ width:'auto' }} value={exCatFilter} onChange={e => setExCatFilter(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
          <select className="field" style={{ width:'auto' }} value={exPlanFilter} onChange={e => setExPlanFilter(e.target.value)}>
            <option value="all">All plans</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(exCatFilter !== 'all' || exPlanFilter !== 'all') && <button className="btn btn-ghost" onClick={() => { setExCatFilter('all'); setExPlanFilter('all') }}>Clear</button>}
        </div>
        <div className="card">
          {filteredEx.length === 0 ? <p className="empty-hint">No exercises match filters.</p> : (
            <>
              <ul className="item-list">
                {displayedEx.map(ex => (
                  <li key={ex.id} className="item-row" style={{ cursor:'pointer' }} onClick={() => setExDetailModal(ex)}>
                    {ex.imageUrl && <img src={ex.imageUrl} alt="" style={{ width:40, height:40, objectFit:'cover', borderRadius:6, flexShrink:0 }} />}
                    <div style={{ flex:1 }}><p className="item-name">{ex.name}</p><p className="item-sub">{ex.category}{ex.description ? ` · ${ex.description}` : ''}</p></div>
                    <div style={{ display:'flex', gap:6 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost" onClick={() => setExModal(ex)}>Edit</button>
                      <button className="btn btn-ghost danger" onClick={() => {
                        setDeleteExerciseId(ex.id)
                        setDeleteExerciseName(ex.name)
                      }}><IconTrash /></button>
                    </div>
                  </li>
                ))}
              </ul>
              {filteredEx.length > 8 && (
                <button className="btn btn-ghost" style={{ width:'100%', marginTop:8 }} onClick={() => setShowAllEx(s => !s)}>
                  {showAllEx ? 'Show less' : `Show all ${filteredEx.length} exercises`}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Workout plans */}
      <section>
        <div className="section-header">
          <h2 className="card-title" style={{ marginBottom:0 }}>Workout plans</h2>
          <button className="btn btn-primary" onClick={() => setPlanModal('new')}><IconPlus /> New plan</button>
        </div>
        {plans.length === 0 ? <div className="card"><p className="empty-hint">No plans yet.</p></div>
          : plans.map(plan => <PlanCard key={plan.id} plan={plan} exercises={exercises} onEdit={() => setPlanModal(plan)} onDelete={() => {
            setDeletePlanId(plan.id)
            setDeletePlanName(plan.name)
          }} />)
        }
      </section>

      {/* Modals */}
      {planModal && <PlanModal initial={planModal==='new'?undefined:planModal} exercises={exercises} onSave={savePlan} onClose={() => setPlanModal(null)} />}
      {exModal && <ExerciseModal initial={exModal==='new'?undefined:exModal} onSave={saveExercise} onClose={() => setExModal(null)} />}
      {detailModal && <WorkoutDetailModal workout={detailModal} exercises={exercises} onClose={() => setDetailModal(null)} />}
      {exDetailModal && <ExerciseDetailModal exercise={exDetailModal} onClose={() => setExDetailModal(null)} onEdit={() => { setExModal(exDetailModal); setExDetailModal(null) }} />}
      {showStart && <StartWorkoutModal onClose={() => setShowStart(false)} onStarted={() => { setShowStart(false); setShowActive(true) }} />}
      {goalModal && (
        <Modal title="Weekly goal" onClose={() => setGoalModal(false)} width={360}>
          <div className="form-stack">
            <label className="form-label">Workouts per week<input ref={goalRef} className="field" type="number" min={1} max={14} defaultValue={weeklyTarget} autoFocus /></label>
            <div className="form-actions"><button className="btn btn-secondary" onClick={() => setGoalModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveGoal}>Save</button></div>
          </div>
        </Modal>
      )}

      {deletePlanId && (
        <ConfirmDeleteModal
          title="Delete workout plan"
          message="Are you sure you want to delete this workout plan?"
          itemName={deletePlanName}
          onConfirm={() => deletePlan(deletePlanId)}
          onCancel={() => {
            setDeletePlanId(null)
            setDeletePlanName('')
          }}
          isDangerous
        />
      )}

      {deleteExerciseId && (
        <ConfirmDeleteModal
          title="Delete exercise"
          message="Are you sure you want to delete this exercise?"
          itemName={deleteExerciseName}
          onConfirm={() => deleteExercise(deleteExerciseId)}
          onCancel={() => {
            setDeleteExerciseId(null)
            setDeleteExerciseName('')
          }}
          isDangerous
        />
      )}
    </div>
  )
}