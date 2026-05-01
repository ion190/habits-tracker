import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { WorkSessionCategory, CompletedWorkSession } from '../db/database'
import { db } from '../db/database'
import { sync } from '../db/sync'
import { formatDuration, formatDateGMT3 } from '../utils'
import Modal from '../components/Modal'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import ActiveWorkSession from '../components/ActiveWorkSession'
import WorkSessionHeatmap from '../components/WorkSessionHeatmap'
import { IconPlus } from '../components/Icons'
import ModalPortal from '../components/ModalPortal'
import StartWorkSessionModal from '../components/StartWorkSessionModal'

function ProductivityCircle({ pct }: { pct: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const color = pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ flexShrink: 0 }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeLinecap="round" strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct / 100)} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fill={color} fontSize="10" fontWeight="600">{Math.round(pct)}%</text>
    </svg>
  )
}

function SessionDetailModal({ session, onClose }: { session: CompletedWorkSession; onClose: () => void }) {
  const productiveTime = session.actualDurationSeconds * (session.productivityPct / 100)
  return (
    <Modal title={`${session.categoryName} session`} onClose={onClose} width={600}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <ProductivityCircle pct={session.productivityPct} />
        <div>
          <p className="item-name">{new Date(session.startedAt).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
          })}</p>
          <p className="item-sub">
            {formatDuration(session.actualDurationSeconds)} actual ·{' '}
            {formatDuration(productiveTime)} productive ·{' '}
            {formatDuration(session.distractionSeconds)} distracted
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto' }}>
        {session.tasks.length > 0 ? (
          <>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tasks</h4>
            {session.tasks.map((task, i) => (
              <div key={i} style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>{task.title}</p>
                {task.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {task.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--accent-bg)', borderRadius: 4 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
          <p style={{ opacity: 0.6 }}>No tasks selected</p>
        )}
        {session.notes && (
          <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Notes</h4>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{session.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}

function SessionRow({ session, onDetail, onDeleted }: {
  session: CompletedWorkSession
  onDetail: () => void
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <div className="item-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span className="habit-dot" style={{ backgroundColor: session.categoryColor }} />
            <p className="item-name">{session.categoryName}</p>
            <span className="item-sub">{formatDuration(session.actualDurationSeconds)}</span>
          </div>
          <p className="item-sub">
            {formatDateGMT3(session.startedAt, { dateOnly: true })}
            {' · '}{Math.round(session.productivityPct)}% productivity
            {' · '}{session.tasks.length} task{session.tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <ProductivityCircle pct={session.productivityPct} />
      </div>
      {open && (
        <div style={{ padding: '12px 12px 12px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={onDetail}>Details →</button>
            <button className="btn btn-ghost danger" style={{ fontSize: 13 }} onClick={async () => {
              await sync.delete('completedWorkSessions', session.id)
              onDeleted()  // ← triggers reload in parent
            }}>Delete</button>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Planned: {formatDuration(session.plannedDurationSeconds)} · Distracted: {formatDuration(session.distractionSeconds)}
          </div>
        </div>
      )}
    </li>
  )
}

type TimeFilter = 'today' | 'week' | 'month' | '3months' | 'year' | 'all'

// Filter out sessions with obviously corrupted data (NaN, Infinity, negative values)
// Allow sessions with 0 duration or undefined fields (edge cases)
function isValidSession(s: CompletedWorkSession): boolean {
  // Only filter out actual bad values: NaN, Infinity, or negative
  // Let sessions with 0 or undefined pass through - they'll display as "0m" or similar
  const actual = s.actualDurationSeconds ?? 0
  const distraction = s.distractionSeconds ?? 0
  const productivity = s.productivityPct ?? 100
  
  if (!Number.isFinite(actual)) return false
  if (!Number.isFinite(distraction)) return false
  if (!Number.isFinite(productivity) && productivity !== 0) return false
  if (actual < 0 || distraction < 0) return false
  if (productivity < 0) return false
  
  return true
}

function filterSessions(sessions: CompletedWorkSession[], filter: TimeFilter, categoryFilter: string): CompletedWorkSession[] {
  // First filter by validity (exclude corrupted data like NaN/Infinity)
  let filtered = sessions.filter(s => isValidSession(s))
  // Then apply category and time filters
  filtered = filtered.filter(s => !categoryFilter || s.categoryId === categoryFilter)
  const days: Record<TimeFilter, number> = { today: 1, week: 7, month: 30, '3months': 90, year: 365, all: Infinity }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (days[filter] || 365))
  if (filter !== 'all') filtered = filtered.filter(s => new Date(s.startedAt) >= cutoff)
  return filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

export default function WorkSessions() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<WorkSessionCategory[]>([])
  const [sessions, setSessions] = useState<CompletedWorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showActive, setShowActive] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [detailSession, setDetailSession] = useState<CompletedWorkSession | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<CompletedWorkSession | null>(null)

  async function reload() {
    const [cats, sess] = await Promise.all([
      db.workSessionCategories.orderBy('name').toArray(),
      db.completedWorkSessions.orderBy('startedAt').reverse().toArray(),
    ])
    setCategories(cats)
    setSessions(sess)
    setLoading(false)
  }

useEffect(() => {
    reload()
    const handleStatusChange = () => {
      setShowActive(!!localStorage.getItem('activeWorkSession'))
    }
    handleStatusChange()
    window.addEventListener('workSessionStatusChange', handleStatusChange)
    
    // Listen for timer click from header - ensure we show active session
    const handleShowEndModal = () => {
      if (localStorage.getItem('activeWorkSession')) {
        setShowActive(true)
      }
    }
    window.addEventListener('showEndWorkSessionModal', handleShowEndModal)
    
    // Check for pending modal from overlay
    const pendingModal = localStorage.getItem('workSessionPendingModal')
    if (pendingModal === 'time') {
      setShowTimeModal(true)
      localStorage.removeItem('workSessionPendingModal')
    } else if (pendingModal === 'end') {
      setShowEndModal(true)
      localStorage.removeItem('workSessionPendingModal')
    }
    
    return () => {
      window.removeEventListener('workSessionStatusChange', handleStatusChange)
      window.removeEventListener('showEndWorkSessionModal', handleShowEndModal)
    }
  }, [])

  const filteredSessions = useMemo(() =>
    filterSessions(sessions, timeFilter, categoryFilter)
      .filter(s => s.categoryName.toLowerCase().includes(searchTerm.toLowerCase())),
    [sessions, timeFilter, categoryFilter, searchTerm]
  )

  const weekSessions = filterSessions(sessions, 'week', '')
  const totalWeekTime = weekSessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0)
  const avgProductivity = weekSessions.length > 0
    ? Math.round(weekSessions.reduce((sum, s) => sum + s.productivityPct, 0) / weekSessions.length)
    : 0

  if (loading) return <div className="page-loading">Loading...</div>

  if (showActive) return (
    <ActiveWorkSession
      onFinished={() => { setShowActive(false); reload() }}
      onDiscard={() => setShowActive(false)}
    />
  )

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1>Work Sessions</h1>
          <p className="page-sub">Focused work with productivity tracking</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowStartModal(true)}>
          <IconPlus /> Start session
        </button>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <p className="stat-label">Sessions</p>
          <p className="stat-value">{weekSessions.length}</p>
          <p className="stat-sub">this week</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total time</p>
          <p className="stat-value">{formatDuration(totalWeekTime)}</p>
          <p className="stat-sub">this week</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Avg productivity</p>
          <p className="stat-value">{avgProductivity}%</p>
          <p className="stat-sub">this week</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <select className="field" style={{ flex: 1, minWidth: 140 }} value={timeFilter} onChange={e => setTimeFilter(e.target.value as TimeFilter)}>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="3months">3 months</option>
          <option value="year">This year</option>
          <option value="all">All time</option>
        </select>
        <select className="field" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>
        <input className="field" placeholder="Search..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button className="btn btn-ghost" onClick={() => { setTimeFilter('week'); setCategoryFilter(''); setSearchTerm('') }}>Clear</button>
      </div>

      <section className="card heatmap-card">
        <h2 className="card-title">Productivity heatmap</h2>
        <WorkSessionHeatmap sessions={filteredSessions} daysBack={365} />
      </section>

      <section className="card">
        <h2 className="card-title">Sessions ({filteredSessions.length})</h2>
        {filteredSessions.length === 0 ? (
          <p className="empty-hint">
            No sessions yet.{' '}
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowStartModal(true)}>
              Start one
            </button>
          </p>
        ) : (
          <ul className="item-list">
            {filteredSessions.slice(0, 20).map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onDetail={() => setDetailSession(session)}
                onDeleted={reload}  // ← wired up now
              />
            ))}
            {filteredSessions.length > 20 && (
              <p style={{ textAlign: 'center', padding: 20, opacity: 0.6 }}>
                Showing 20 most recent of {filteredSessions.length}
              </p>
            )}
          </ul>
        )}
      </section>

      {detailSession && <SessionDetailModal session={detailSession} onClose={() => setDetailSession(null)} />}

      {deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete session"
          message="Permanently delete this work session?"
          itemName={`${deleteConfirm.categoryName} - ${formatDateGMT3(deleteConfirm.startedAt)}`}
          onConfirm={async () => { await sync.delete('completedWorkSessions', deleteConfirm.id); reload(); setDeleteConfirm(null) }}
          onCancel={() => setDeleteConfirm(null)}
          isDangerous
        />
      )}

      {showStartModal && (
        <ModalPortal title="Start Work Session" onClose={() => setShowStartModal(false)}>
<StartWorkSessionModal
            onClose={() => setShowStartModal(false)}
            onStarted={() => { 
              setShowStartModal(false); 
              navigate('/work-sessions', { replace: true }) 
            }}
          />
        </ModalPortal>
      )}
    </div>
  )
}