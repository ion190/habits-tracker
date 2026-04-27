import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import type { Habit, HabitLog } from '../db/database'
import { toDateKey, formatDateOnlyGMT3, formatTimeGMT3 } from '../utils'

type Range = '7d' | '30d' | '90d' | '365d' | 'all'
const RANGES: Range[] = ['7d', '30d', '90d', '365d', 'all']
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365, 'all': 730 }

function buildHeatmap(logs: HabitLog[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const log of logs) {
    const d = toDateKey(log.completedAt)
    map.set(d, (map.get(d) ?? 0) + 1)
  }
  return map
}

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i))
    return toDateKey(d.toISOString())
  })
}

function Heatmap({ logs, color }: { logs: HabitLog[]; color: string }) {
  const days = getLastNDays(364)
  const map  = buildHeatmap(logs)
  const firstDayOfWeek = new Date(days[0]).getDay() // 0=Sun, 1=Mon...6=Sat
  const pad  = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Convert to Monday-first: 0=Mon, 6=Sun
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        {Array(pad).fill(null).map((_, i) => <div key={`p${i}`} className="hm-cell hm-0" />)}
        {days.map(day => (
          <div key={day} className="hm-cell"
            style={{
              background: map.has(day) ? color : 'var(--border)',
              opacity: map.has(day) ? Math.min(0.25 + map.get(day)! * 0.2, 1) : 1,
            }}
            title={`${day}: ${map.get(day) ?? 0}`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0.25, 0.45, 0.65, 0.85, 1].map(o => (
          <div key={o} className="hm-cell" style={{ background: color, opacity: o }} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}

export default function HabitDetail() {
  const { habitId } = useParams<{ habitId: string }>()
  const navigate    = useNavigate()
  const [habit,   setHabit]   = useState<Habit | null>(null)
  const [logs,    setLogs]    = useState<HabitLog[]>([])
  const [range,   setRange]   = useState<Range>('90d')
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!habitId) return
    const [h, l] = await Promise.all([
      db.habits.get(habitId),
      db.habitLogs.where('habitId').equals(habitId).toArray(),
    ])
    if (!h) { navigate('/habits'); return }
    setHabit(h)
    setLogs(l.sort((a, b) => b.completedAt.localeCompare(a.completedAt)))
    setLoading(false)
  }

  useEffect(() => { reload() }, [habitId])

  async function toggleToday() {
    if (!habitId) return
    const today = toDateKey(new Date().toISOString())
    const existing = await db.habitLogs.where('habitId').equals(habitId)
      .filter(l => toDateKey(l.completedAt) === today).first()
    if (existing) {
      await sync.delete('habitLogs', existing.id)
    } else {
      const log: HabitLog = { id: generateId(), habitId, completedAt: new Date().toISOString() }
      await sync.put('habitLogs', log as unknown as Record<string, unknown>)
    }
    reload()
  }

  if (loading || !habit) return <div className="page-loading">Loading…</div>

  const today     = toDateKey(new Date().toISOString())
  const doneToday = logs.some(l => toDateKey(l.completedAt) === today)
  const cutoff    = new Date(); cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range])
  const filtered  = range === 'all' ? logs : logs.filter(l => new Date(l.completedAt) >= cutoff)
  const pct       = Math.round((filtered.length / RANGE_DAYS[range]) * 100)

  // Current streak
  let streak = 0
  const logSet = new Set(logs.map(l => toDateKey(l.completedAt)))
  const cur = new Date()
  while (logSet.has(toDateKey(cur.toISOString()))) { streak++; cur.setDate(cur.getDate() - 1) }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ width:14, height:14, borderRadius:'50%', background:habit.color, flexShrink:0, display:'inline-block' }} />
          <div>
            <h1>{habit.name}</h1>
            <p className="page-sub">{habit.frequency}</p>
          </div>
        </div>
        <button className={`btn ${doneToday ? 'btn-secondary' : 'btn-primary'}`} style={{ marginTop:12 }} onClick={toggleToday}>
          {doneToday ? '✓ Done today — undo' : 'Mark done today'}
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card"><p className="stat-label">Streak</p><p className="stat-value">{streak}d</p></div>
        <div className="stat-card"><p className="stat-label">Total</p><p className="stat-value">{logs.length}</p><p className="stat-sub">completions</p></div>
        <div className="stat-card"><p className="stat-label">Rate</p><p className="stat-value">{pct}%</p><p className="stat-sub">in range</p></div>
      </div>

      <div className="seg-group" style={{ width:'fit-content' }}>
        {RANGES.map(r => (
          <button key={r} className={`seg-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
            {r === 'all' ? 'All' : r}
          </button>
        ))}
      </div>

      <section className="card">
        <h2 className="card-title">Activity heatmap</h2>
        {logs.length === 0 ? <p className="empty-hint">No completions yet.</p> : <Heatmap logs={filtered} color={habit.color} />}
      </section>

      <section className="card">
        <h2 className="card-title">History</h2>
        {filtered.length === 0
          ? <p className="empty-hint">Nothing logged in this period.</p>
          : (
            <ul className="item-list" style={{ maxHeight:320, overflowY:'auto' }}>
              {filtered.map(l => (
                <li key={l.id} className="item-row">
                  <p className="item-name">
                    {formatDateOnlyGMT3(l.completedAt)}
                  </p>
                  <p className="item-sub">
                    {formatTimeGMT3(l.completedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )
        }
      </section>
    </div>
  )
}