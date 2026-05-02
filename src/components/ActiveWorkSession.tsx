import { useEffect, useState, useCallback, useRef } from 'react'
import { db, generateId } from '../db/database'
import { sync } from '../db/sync'
import { formatDuration, formatCountdown } from '../utils'
import type { ActiveWorkSession, CompletedWorkSession } from '../db/database'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import ModalPortal from './ModalPortal'
import { IconPause, IconPlay, IconStop } from './Icons'

interface Props {
  onFinished: () => void
  onDiscard: () => void
}

// ─── Unified elapsed calculation ─────────────────────────
// Use this function EVERYWHERE. Never inline-calculate elapsed.
// Model:
//   startedAt         = start of the current (or latest) run segment
//   totalElapsedSeconds = sum of all COMPLETED run segments before this one
//   pausedAt          = if set, session is paused; segment ended at pausedAt
//   durationSeconds   = NEVER mutated - user's planned duration
export function getElapsed(s: ActiveWorkSession): number {
  const segStart = new Date(s.startedAt).getTime()
  const segEnd   = s.pausedAt ? new Date(s.pausedAt).getTime() : Date.now()
  const segSecs  = Math.max(0, Math.floor((segEnd - segStart) / 1000))
  return (s.totalElapsedSeconds ?? 0) + segSecs
}

export default function ActiveWorkSession({ onFinished, onDiscard }: Props) {
  const [session, setSession]                     = useState<ActiveWorkSession | null>(null)
  const [elapsed, setElapsed]                     = useState(0)
  const [showEndModal, setShowEndModal]           = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showTimeModal, setShowTimeModal]         = useState(false)
  const [newDuration, setNewDuration]             = useState(25)
  const [distractionInputMinutes, setDistractionInputMinutes] = useState(0)
  const [completedTaskIds, setCompletedTaskIds]   = useState<Set<string>>(new Set())
  const completionHandledRef = useRef(false)

  // Load session from localStorage once on mount
  useEffect(() => {
    const raw = localStorage.getItem('activeWorkSession')
    if (!raw) return onDiscard()
    const s: ActiveWorkSession = JSON.parse(raw)
    setSession(s)
    setNewDuration(Math.round(s.durationSeconds / 60))
  }, [onDiscard])

  // ── persist: always reads fresh from localStorage to avoid stale state ──
  const persist = useCallback((updates: Partial<ActiveWorkSession>) => {
    const raw = localStorage.getItem('activeWorkSession')
    if (!raw) return
    const current: ActiveWorkSession = JSON.parse(raw)
    const updated = { ...current, ...updates }
    localStorage.setItem('activeWorkSession', JSON.stringify(updated))
    setSession(updated)
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
  }, [])

  // ── Timer tick: reads localStorage directly, uses getElapsed ──
  useEffect(() => {
    const tick = () => {
      const raw = localStorage.getItem('activeWorkSession')
      if (!raw) return
      const s: ActiveWorkSession = JSON.parse(raw)
      setSession(s)

      const totalElapsed = getElapsed(s)
      setElapsed(totalElapsed)

      // Natural completion
      const remaining = Math.max(0, s.durationSeconds - totalElapsed)
      if (remaining <= 0 && !s.pausedAt && !completionHandledRef.current) {
        completionHandledRef.current = true

        // Alarm sound
        try {
          const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
          const osc  = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain); gain.connect(audioCtx.destination)
          osc.frequency.value = 800; osc.type = 'sine'
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 12)
          osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 12)
        } catch (_) { /* audio not available */ }

        // Browser notification
        if ('Notification' in window) {
          const notify = () => new Notification('Work Session Complete!', {
            body: `${s.categoryName} session finished. Time to take a break!`,
            icon: '/favicon.svg', tag: 'work-session-complete', requireInteraction: true,
          })
          if (Notification.permission === 'granted') notify()
          else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') notify() })
        }

        setShowEndModal(true)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, []) // no deps — reads localStorage fresh each tick

  if (!session) return null

  const remaining   = Math.max(0, session.durationSeconds - elapsed)
  const isPaused    = !!session.pausedAt
  const isComplete  = remaining <= 0 && !isPaused
  const progressPct = session.durationSeconds > 0 ? Math.min(100, (elapsed / session.durationSeconds) * 100) : 0

  // ── Pause / Resume ────────────────────────────────────────
  const handlePauseResume = () => {
    if (isPaused) {
      // Resume: commit the just-paused segment to totalElapsedSeconds, reset startedAt
      const segStart   = new Date(session.startedAt).getTime()
      const segEnd     = new Date(session.pausedAt!).getTime()
      const segSecs    = Math.max(0, Math.floor((segEnd - segStart) / 1000))
      const newTotal   = (session.totalElapsedSeconds ?? 0) + segSecs
      persist({
        pausedAt:            undefined,
        startedAt:           new Date().toISOString(),
        totalElapsedSeconds: newTotal,
      })
    } else {
      // Pause: just record the timestamp — getElapsed handles the rest
      persist({ pausedAt: new Date().toISOString() })
    }
  }

  // ── Edit duration ─────────────────────────────────────────
  const handleSaveNewTime = () => {
    persist({ durationSeconds: newDuration * 60 })
    setShowTimeModal(false)
  }

  const toggleTaskComplete = (taskId: string) => {
    setCompletedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId)
      return next
    })
  }

  // ── End session (with distraction modal) ─────────────────
  const confirmEnd = async () => {
    // actualDurationSeconds = real time spent (elapsed at this moment)
    const actualSeconds = getElapsed(session)

    // distractionSeconds clamped to actual
    const distractionSeconds = Math.min(distractionInputMinutes * 60, actualSeconds)

    // productivity = (actual - distraction) / actual * 100
    const productivityPct = actualSeconds > 0
      ? Math.round(((actualSeconds - distractionSeconds) / actualSeconds) * 100)
      : 100

    const completed: CompletedWorkSession = {
      id:                       generateId(),
      categoryId:               session.categoryId,
      categoryName:             session.categoryName,
      categoryColor:            session.categoryColor,
      plannedDurationSeconds:   session.durationSeconds,
      actualDurationSeconds:    actualSeconds,
      distractionSeconds,
      productivityPct,
      notes:                    session.notes,
      tasks:                    session.tasks,
      startedAt:                session.startedAt,
      endedAt:                  new Date().toISOString(),
    }

    // Mark selected completed tasks
    for (const task of session.tasks) {
      if (!completedTaskIds.has(task.taskId)) continue
      const taskData = await db.tasks.get(task.taskId)
      if (taskData && !taskData.completedAt) {
        await sync.put('tasks', { ...taskData, completedAt: new Date().toISOString() } as unknown as Record<string, unknown>)
      }
    }

    await sync.put('completedWorkSessions', completed as unknown as Record<string, unknown>)
    localStorage.removeItem('activeWorkSession')
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    setShowEndModal(false)
    onFinished()
  }

  const confirmDiscard = () => {
    localStorage.removeItem('activeWorkSession')
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    setShowDiscardConfirm(false)
    onDiscard()
  }

  return (
    <div className="active-workout" style={{
      backgroundColor: 'var(--bg)',
      color: 'var(--text-h)',
      borderRadius: 16,
      padding: 32,
      boxShadow: 'var(--shadow)',
      maxWidth: 600,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: 24, borderBottom: '2px solid var(--accent-border)', marginBottom: 24,
        flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>{session.categoryIcon}</span>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
              {session.categoryName}
            </h2>
          </div>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>
            {formatDuration(elapsed)} elapsed
            {session.notes && <span> • {session.notes}</span>}
          </p>
        </div>
        <div style={{
          fontSize: 56, fontWeight: 800,
          color: remaining <= 30 && !isPaused ? 'var(--danger)' : 'var(--accent)',
          fontFamily: 'var(--mono)',
          textShadow: remaining <= 30 && !isPaused ? '0 0 20px var(--danger-bg)' : '0 0 20px var(--accent-bg)',
          animation: remaining <= 30 && !isPaused ? 'pulse 1s infinite' : 'none',
        }}>
          {isPaused ? 'PAUSED' : formatCountdown(remaining)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
          <span>Progress</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--accent-bg)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progressPct}%`,
            background: isPaused ? 'var(--warning)' : remaining <= 30 ? 'var(--danger)' : 'var(--accent)',
            borderRadius: 4,
            transition: 'width 1s linear',
          }} />
        </div>
      </div>

      {/* Task list */}
      {session.tasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5 }}>
            Tasks {completedTaskIds.size > 0 && <span style={{ fontWeight: 400, opacity: 0.7 }}>• {completedTaskIds.size}/{session.tasks.length} done</span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {session.tasks.map((task, i) => {
              const done = completedTaskIds.has(task.taskId)
              return (
                <div key={i} onClick={() => toggleTaskComplete(task.taskId)} style={{
                  padding: 14,
                  background: done ? 'var(--accent-bg)' : 'var(--code-bg)',
                  borderRadius: 10,
                  border: `1px solid ${done ? 'var(--accent-border)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                    background: done ? 'var(--accent)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#fff', flexShrink: 0, transition: 'all 0.2s ease',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <p style={{ margin: 0, fontWeight: 500, flex: 1, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                    {task.title}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', paddingTop: 8 }}>
        <button className="btn" onClick={handlePauseResume} style={{
          background: isPaused ? 'var(--accent)' : 'var(--warning)',
          color: 'white', padding: '12px 24px', borderRadius: 10, fontWeight: 600,
          boxShadow: isPaused ? '0 4px 12px var(--accent-bg)' : '0 4px 12px var(--warning-bg)',
        }}>
          {isPaused ? <IconPlay /> : <IconPause />} {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button className="btn btn-secondary" onClick={() => setShowTimeModal(true)} style={{ padding: '12px 20px', borderRadius: 10 }}>
          ✏️ Time
        </button>
        <button className={`btn ${isComplete ? 'pulse' : ''}`} onClick={() => setShowEndModal(true)} style={{
          background: 'var(--accent)', color: 'white',
          padding: '12px 24px', borderRadius: 10, fontWeight: 600,
          boxShadow: '0 4px 12px var(--accent-bg)',
        }}>
          <IconStop /> {isComplete ? 'Complete!' : 'End Early'}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowDiscardConfirm(true)} style={{ padding: '12px 20px', borderRadius: 10, opacity: 0.6 }}>
          Discard
        </button>
      </div>

      {/* Edit Duration Modal */}
      {showTimeModal && (
        <ModalPortal title="Edit Duration" onClose={() => setShowTimeModal(false)}>
          <div style={{ maxWidth: 300 }}>
            <div className="form-label">
              New duration (minutes)
              <input type="number" className="field" min="1" max="240" value={newDuration}
                onChange={e => setNewDuration(+e.target.value)} />
            </div>
            <p style={{ fontSize: 12, opacity: 0.6 }}>
              Elapsed so far: {formatDuration(elapsed)} · Remaining: {formatDuration(remaining)}
            </p>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowTimeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNewTime}>Save</button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* End Session Modal */}
      {showEndModal && (
        <ModalPortal title={isComplete ? '🎉 Session Complete!' : 'End Session'} onClose={() => { if (!isComplete) setShowEndModal(false) }}>
          <div style={{ maxWidth: 420 }}>
            {/* Session summary */}
            <div style={{ background: 'var(--code-bg)', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ opacity: 0.7 }}>Planned</span>
                <strong>{formatDuration(session.durationSeconds)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
                <span style={{ opacity: 0.7 }}>Actual</span>
                <strong style={{ color: 'var(--accent)' }}>{formatDuration(elapsed)}</strong>
              </div>
            </div>

            {/* Task completion */}
            {session.tasks.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Tasks</h4>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{completedTaskIds.size}/{session.tasks.length} completed</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {session.tasks.map((task, i) => {
                    const done = completedTaskIds.has(task.taskId)
                    return (
                      <div key={i} onClick={() => toggleTaskComplete(task.taskId)} style={{
                        padding: '8px 12px', background: done ? 'var(--accent-bg)' : 'var(--bg)',
                        borderRadius: 6, border: `1px solid ${done ? 'var(--accent-border)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                      }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: '50%',
                          border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`,
                          background: done ? 'var(--accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: '#fff', flexShrink: 0,
                        }}>{done ? '✓' : ''}</span>
                        <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
                          {task.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Distraction input */}
            <div className="form-label">
              Distracted time (minutes)
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <button className="btn btn-secondary" style={{ padding: '8px 12px' }}
                  onClick={() => setDistractionInputMinutes(Math.max(0, distractionInputMinutes - 5))}>−5</button>
                <input type="number" className="field" min="0" max={Math.floor(elapsed / 60)}
                  value={distractionInputMinutes}
                  onChange={e => setDistractionInputMinutes(Math.max(0, Math.min(Math.floor(elapsed / 60), +e.target.value)))}
                  style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }} />
                <button className="btn btn-secondary" style={{ padding: '8px 12px' }}
                  onClick={() => setDistractionInputMinutes(Math.min(Math.floor(elapsed / 60), distractionInputMinutes + 5))}>+5</button>
              </div>
            </div>

            {/* Live productivity preview */}
            {(() => {
              const distrSec = Math.min(distractionInputMinutes * 60, elapsed)
              const pct = elapsed > 0 ? Math.round(((elapsed - distrSec) / elapsed) * 100) : 100
              const color = pct >= 80 ? 'var(--accent)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'
              return (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--code-bg)', borderRadius: 8, border: `1px solid ${color}40` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ opacity: 0.7 }}>Productivity</span>
                    <strong style={{ color, fontSize: 16 }}>{pct}%</strong>
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                    ({formatDuration(elapsed)} − {formatDuration(distrSec)} distracted) ÷ {formatDuration(elapsed)}
                  </div>
                </div>
              )
            })()}

            <div className="form-actions" style={{ marginTop: 20 }}>
              {!isComplete && <button className="btn btn-ghost" onClick={() => setShowEndModal(false)}>Cancel</button>}
              <button className="btn btn-primary" onClick={confirmEnd}>
                {isComplete ? '🎉 Save Session' : 'End & Save'}
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {showDiscardConfirm && (
        <ConfirmDeleteModal
          title="Discard session"
          message="Lose all session data?"
          onConfirm={confirmDiscard}
          onCancel={() => setShowDiscardConfirm(false)}
          isDangerous
        />
      )}
    </div>
  )
}