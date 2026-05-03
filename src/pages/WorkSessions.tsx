import { useEffect, useState, useMemo } from 'react'
import type { WorkSessionCategory, CompletedWorkSession } from '../db/database'
import { db } from '../db/database'
import { sync } from '../db/sync'
import { formatDuration, formatDateGMT3 } from '../utils'
import Modal from '../components/Modal'
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

function SessionDetailModal({ session, onClose, onDeleted }: {
  session: CompletedWorkSession
  onClose: () => void
  onDeleted: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const productiveTime = session.actualDurationSeconds * (session.productivityPct / 100)
  const pctColor = session.productivityPct >= 80 ? 'var(--accent)' : session.productivityPct >= 50 ? 'var(--warning)' : 'var(--danger)'

  const handleDelete = async () => {
    setDeleting(true)
    await sync.delete('completedWorkSessions', session.id)
    onDeleted()
    onClose()
  }

  return (
    <Modal title={`${session.categoryName} session`} onClose={onClose} width={600}>
      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <ProductivityCircle pct={session.productivityPct} />
        <div style={{ flex: 1 }}>
          <p className="item-name">{new Date(session.startedAt).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
          })}</p>
          <p className="item-sub">
            {formatDuration(session.actualDurationSeconds)} actual ·{' '}
            <span style={{ color: pctColor }}>{formatDuration(productiveTime)} productive</span> ·{' '}
            {formatDuration(session.distractionSeconds)} distracted
          </p>
        </div>
      </div>

      {/* Duration details */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Planned', value: formatDuration(session.plannedDurationSeconds) },
          { label: 'Actual',  value: formatDuration(session.actualDurationSeconds) },
          { label: 'Focused', value: formatDuration(productiveTime), color: pctColor },
          { label: 'Distracted', value: formatDuration(session.distractionSeconds) },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, minWidth: 100, background: 'var(--code-bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
            <p style={{ margin: 0, fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontWeight: 700, color: color ?? 'var(--text-h)' }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
{session.tags && session.tags.length > 0 && (
            <>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tags ({session.tags.length})</h4>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                {session.tags.map(tag => (
                  <span key={tag} style={{ 
                    fontSize: 11, 
                    padding: '4px 8px', 
                    background: 'var(--accent-bg)', 
                    color: 'var(--accent)',
                    borderRadius: 6,
                    border: '1px solid var(--accent-border)'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </>
          )}
        {session.tasks.length > 0 ? (
          <>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tasks ({session.tasks.length})</h4>
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

      {/* Delete area */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        {!confirmDelete ? (
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', fontSize: 13 }}
            onClick={() => setConfirmDelete(true)}>
            🗑 Delete session
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, opacity: 0.8 }}>Permanently delete this session?</span>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
            <button className="btn" style={{ background: 'var(--danger)', color: '#fff', padding: '6px 16px', borderRadius: 8 }}
              onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

// Clicking a row opens the detail modal directly
function SessionRow({ session, onDetail }: {
  session: CompletedWorkSession
  onDetail: () => void
}) {
  return (
    <li>
      <div className="item-row" style={{ cursor: 'pointer' }} onClick={onDetail}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span className="habit-dot" style={{ backgroundColor: session.categoryColor }} />
<p className="item-name">{session.categoryName ?? 'Unknown'}</p>
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
    </li>
  )
}




type TimeFilter = 'today' | 'week' | 'month' | '3months' | 'year' | 'all'

// Filter out sessions with obviously corrupted data (NaN, Infinity, negative values)
// Allow sessions with 0 duration or undefined fields (edge cases)
function isValidSession(s: CompletedWorkSession): boolean {
  // Filter invalid category sessions first
  if (!s.categoryId || !s.categoryName) return false;
  
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

function filterSessions(sessions: CompletedWorkSession[], filter: TimeFilter, selectedCategoryIds: string[]): CompletedWorkSession[] {
  // First filter by validity (exclude corrupted data like NaN/Infinity)
  let filtered = sessions.filter(s => isValidSession(s))
  // Then apply category and time filters
  filtered = filtered.filter(s => selectedCategoryIds.length === 0 || selectedCategoryIds.includes(s.categoryId))
  const days: Record<TimeFilter, number> = { today: 1, week: 7, month: 30, '3months': 90, year: 365, all: Infinity }
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (days[filter] || 365))
  if (filter !== 'all') filtered = filtered.filter(s => new Date(s.startedAt) >= cutoff)
  return filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

export default function WorkSessions() {
  const [categories, setCategories] = useState<WorkSessionCategory[]>([])
  const [sessions, setSessions] = useState<CompletedWorkSession[]>([])
  const [loading, setLoading] = useState(true)
  const [showActive, setShowActive] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  // const [showTimeModal, setShowTimeModal] = useState(false)
  // const [showEndModal, setShowEndModal] = useState(false)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [detailSession, setDetailSession] = useState<CompletedWorkSession | null>(null)

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
    reload().then(() => {
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
        // setShowTimeModal(true)
        localStorage.removeItem('workSessionPendingModal')
      } else if (pendingModal === 'end') {
        // setShowEndModal(true)
        localStorage.removeItem('workSessionPendingModal')
      }
      
      return () => {
        window.removeEventListener('workSessionStatusChange', handleStatusChange)
        window.removeEventListener('showEndWorkSessionModal', handleShowEndModal)
      }
    })
  }, [])

  const filteredSessionsForList = useMemo(() =>
    filterSessions(sessions, timeFilter, selectedCategoryIds)
      .filter(s => s.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false),
    [sessions, timeFilter, selectedCategoryIds, searchTerm]
  )



  const allCategories = useMemo(() => {
    const predefined = categories
    const custom = Array.from(new Set(sessions.map(s => s.categoryId))).map(id => {
      const session = sessions.find(s => s.categoryId === id)
      return session && session.categoryName ? {
        id: session.categoryId,
        name: session.categoryName,
        color: session.categoryColor,
      } : null
    }).filter(Boolean) as any[]
    return [...predefined, ...custom]
  }, [categories, sessions])

  const filteredSessions = filterSessions(sessions, timeFilter, selectedCategoryIds)
  const totalTime = filteredSessions.reduce((sum, s) => sum + s.actualDurationSeconds, 0)
  const avgProductivity = filteredSessions.length > 0
    ? Math.round(filteredSessions.reduce((sum, s) => sum + s.productivityPct, 0) / filteredSessions.length)
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

      {/* Time + Search Row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
        <select className="field" style={{ flex: 1, minWidth: 140 }} value={timeFilter} onChange={e => setTimeFilter(e.target.value as TimeFilter)}>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="3months">3 months</option>
          <option value="year">This year</option>
          <option value="all">All time</option>
        </select>
        <input className="field" placeholder="Search sessions..." value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn btn-ghost" onClick={() => { setTimeFilter('week'); setSelectedCategoryIds([]); setSearchTerm('') }}>Reset</button>
      </div>

      {/* Category Tags Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8, marginBottom: 16, overflowX: 'auto' }}>
        Categories ({selectedCategoryIds.length}): 
        {allCategories.map(cat => (
          <button
            key={cat.id}
            className="btn btn-ghost"
            style={{
              padding: '4px 8px',
              fontSize: 12,
              background: selectedCategoryIds.includes(cat.id) ? cat.color + '20' : 'var(--bg)',
              borderColor: selectedCategoryIds.includes(cat.id) ? cat.color : 'var(--border)',
              color: selectedCategoryIds.includes(cat.id) ? cat.color : 'var(--text)',
              flexShrink: 0,
            }}
            onClick={() => {
              setSelectedCategoryIds(prev =>
                prev.includes(cat.id)
                  ? prev.filter(id => id !== cat.id)
                  : [...prev, cat.id]
              )
            }}
          >
            {cat.name}
          </button>
        ))}
        {selectedCategoryIds.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, flexShrink: 0 }}
            onClick={() => setSelectedCategoryIds([])}
          >
            × Clear categories
          </button>
        )}
      </div>

      <section className="card heatmap-card">
        <h2 className="card-title">Productivity heatmap</h2>
        <WorkSessionHeatmap sessions={filteredSessions} daysBack={365} />
      </section>



      <section className="card">
        <h2 className="card-title">Sessions ({filteredSessionsForList.length})</h2>
        {filteredSessionsForList.length === 0 ? (
          <p className="empty-hint">
            No sessions yet.{' '}
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => setShowStartModal(true)}>
              Start one
            </button>
          </p>
        ) : (
          <ul className="item-list">
            {filteredSessionsForList.slice(0, 20).map(session => (
              <SessionRow
                key={session.id}
                session={session}
                onDetail={() => setDetailSession(session)}
              />
            ))}
            {filteredSessionsForList.length > 20 && (
              <p style={{ textAlign: 'center', padding: 20, opacity: 0.6 }}>
              Showing 20 most recent of {filteredSessionsForList.length}
            </p>
            )}
          </ul>
        )}
      </section>

      {detailSession && (
        <SessionDetailModal session={detailSession} onClose={() => setDetailSession(null)} onDeleted={reload} />
      )}

{showStartModal && (
        <ModalPortal title="Start Work Session" onClose={() => setShowStartModal(false)}>
          <StartWorkSessionModal
            onClose={() => setShowStartModal(false)}
            onStarted={() => {
              setShowStartModal(false)
              setShowActive(true)
            }}
          />
        </ModalPortal>
      )}
    </div>
  )
}