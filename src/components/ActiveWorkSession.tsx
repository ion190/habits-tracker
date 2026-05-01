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
  onShowTime?: () => void
  onShowEnd?: () => void
}

export default function ActiveWorkSession({ onFinished, onDiscard }: Props) {
const [session, setSession] = useState<ActiveWorkSession | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [showEndModal, setShowEndModal] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [newDuration, setNewDuration] = useState(25)
  const [distractionInputMinutes, setDistractionInputMinutes] = useState(0)
  // Track completed tasks during session
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set())
  // Track original duration to restore on resume
  const originalDurationRef = useRef(0)
  // Track if we've already handled completion to avoid double-handling
  const completionHandledRef = useRef(false)

// Load session from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('activeWorkSession')
    if (!raw) return onDiscard()
    const s: ActiveWorkSession = JSON.parse(raw)
    setSession(s) 
    setNewDuration(Math.round(s.durationSeconds / 60))
    originalDurationRef.current = s.durationSeconds
  }, [onDiscard])

// Timer - reads fresh from localStorage each tick to get latest pause state
  // Also syncs the session state from localStorage when it changes
  // AND handles natural completion
  useEffect(() => {
    const tick = () => {
      const raw = localStorage.getItem('activeWorkSession')
      if (!raw) return
      const s: ActiveWorkSession = JSON.parse(raw)
      
      // Keep session state in sync with localStorage
      if (session && session.pausedAt !== s.pausedAt) {
        setSession(s)
      }
      
let currentElapsed: number
      if (s.pausedAt) {
        // When paused, show elapsed up to pausedAt (frozen) + cumulative from previous cycles
        const pausedDuration = Math.floor((new Date(s.pausedAt).getTime() - new Date(s.startedAt).getTime()) / 1000)
        currentElapsed = (s.totalElapsedSeconds || 0) + pausedDuration
      } else {
        // When not paused, calculate elapsed from start (counting up) + cumulative from previous cycles
        const currentSessionElapsed = Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000)
        currentElapsed = (s.totalElapsedSeconds || 0) + currentSessionElapsed
      }
      setElapsed(currentElapsed)
      
      // Check for natural completion (timer ran out)
      const remaining = Math.max(0, s.durationSeconds - currentElapsed)
      const isComplete = remaining <= 0 && !s.pausedAt
      
      if (isComplete && !completionHandledRef.current) {
        completionHandledRef.current = true
        
// Play continuous alarm sound for 12 seconds
        const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const playContinuousAlarm = () => {
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain); gain.connect(audioCtx.destination)
          osc.frequency.value = 800; osc.type = 'sine'
          // Start at 0.3 volume, ramp down gradually over 12 seconds
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 12)
          osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 12)
        }
playContinuousAlarm()
        // The oscillator plays for 12 seconds and then stops automatically
        // No need to clear it - the auto-save happens at 3 seconds anyway
        
        // Show browser notification
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Work Session Complete!', {
              body: `${s.categoryName} session finished. Time to take a break!`,
              icon: '/favicon.svg',
              tag: 'work-session-complete',
              requireInteraction: true,
            })
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification('Work Session Complete!', {
                  body: `${s.categoryName} session finished. Time to take a break!`,
                  icon: '/favicon.svg',
                  tag: 'work-session-complete',
                  requireInteraction: true,
                })
              }
            })
          }
        }
        
// Show end modal instead of auto-saving - let user input data
        // The modal will handle saving when user confirms
        setShowEndModal(true)
        
// Return cleanup (no interval to clear anymore)
        return () => {}
      }
    }
    
    // Run immediately
    tick()
    
    // Then every second
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session, onFinished])

  const persist = useCallback((updates: Partial<ActiveWorkSession>) => {
    if (!session) return
    const updated = { ...session, ...updates }
    localStorage.setItem('activeWorkSession', JSON.stringify(updated))
    setSession(updated)
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
  }, [session])

if (!session) return null

  // Calculate remaining time accounting for cumulative elapsed
  const totalElapsedSoFar = session.pausedAt
    ? (session.totalElapsedSeconds || 0) + Math.floor((new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
    : (session.totalElapsedSeconds || 0) + elapsed
  const remaining = session.pausedAt 
    ? session.durationSeconds 
    : Math.max(0, session.durationSeconds - totalElapsedSoFar)
  const isComplete = remaining <= 0 && !session.pausedAt
  const currentSessionIsPaused = session.pausedAt !== undefined

const handlePauseResume = () => {
    if (session.pausedAt) {
      // Resume - calculate total elapsed time across all resume periods
      // totalElapsedSoFar tracks all time worked (not paused time)
      const pausedDuration = Math.floor((new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
      const totalElapsedSoFar = (session.totalElapsedSeconds || 0) + pausedDuration
      const remainingWhenPaused = Math.max(0, session.durationSeconds - pausedDuration)
      
      // Update with new startedAt to "restart" the timer with remaining time
      // Also save totalElapsedSoFar to track cumulative time
      persist({ 
        pausedAt: undefined, 
        startedAt: new Date().toISOString(),
        durationSeconds: remainingWhenPaused,
        totalElapsedSeconds: totalElapsedSoFar
      })
    } else {
      // Pause - save current total elapsed before pausing
      const currentPausedDuration = elapsed
      const totalElapsedSoFar = (session.totalElapsedSeconds || 0) + currentPausedDuration
      originalDurationRef.current = session.durationSeconds
      persist({ 
        pausedAt: new Date().toISOString(),
        totalElapsedSeconds: totalElapsedSoFar
      })
    }
  }

const handleSaveNewTime = () => {
    const newSeconds = newDuration * 60
    persist({ durationSeconds: newSeconds })
    originalDurationRef.current = newSeconds
    setShowTimeModal(false)
  }

const toggleTaskComplete = (taskId: string) => {
    setCompletedTaskIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

// Direct end - saves immediately without opening modal (fallback for when modal doesn't work)
  const handleDirectEnd = async () => {
    // Calculate total elapsed including all previous resume cycles
    let totalElapsed: number
    if (session.pausedAt) {
      const pausedDuration = Math.floor((new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
      totalElapsed = (session.totalElapsedSeconds || 0) + pausedDuration
    } else {
      totalElapsed = (session.totalElapsedSeconds || 0) + elapsed
    }
    const actualSeconds = Math.floor(totalElapsed / 1000)
    const productivePct = 100 // Default to full productivity for direct end
    
    const completed: CompletedWorkSession = {
      id: generateId(),
      categoryId: session.categoryId,
      categoryName: session.categoryName,
      categoryColor: session.categoryColor,
      plannedDurationSeconds: session.durationSeconds,
      actualDurationSeconds: actualSeconds,
      distractionSeconds: 0,
      productivityPct: productivePct,
      notes: session.notes,
      tasks: session.tasks,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
    }
    
    // Mark completed tasks in the database
    for (const task of session.tasks) {
      const taskData = await db.tasks.get(task.taskId)
      if (taskData && !taskData.completedAt) {
        await sync.put('tasks', {
          ...taskData,
          completedAt: new Date().toISOString()
        } as unknown as Record<string, unknown>)
      }
    }
    
    await sync.put('completedWorkSessions', completed as unknown as Record<string, unknown>)
    localStorage.removeItem('activeWorkSession')
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    onFinished()
  }

const confirmEnd = async () => {
    const distractionMinutes = distractionInputMinutes
    const distractionSeconds = distractionMinutes * 60
    // Calculate total elapsed including all previous resume cycles
    let totalElapsed: number
    if (session.pausedAt) {
      const pausedDuration = Math.floor((new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
      totalElapsed = (session.totalElapsedSeconds || 0) + pausedDuration
    } else {
      totalElapsed = (session.totalElapsedSeconds || 0) + elapsed
    }
    const actualSeconds = Math.floor(totalElapsed / 1000)
    // Productivity = focused time / planned time * 100
    // Focused time = actual time - distraction time
    // Denominator should be PLANNED duration, not actual duration
    const plannedSeconds = session.durationSeconds
    const focusedSeconds = Math.max(0, actualSeconds - distractionSeconds)
    const productivePct = plannedSeconds > 0 
      ? Math.round((focusedSeconds / plannedSeconds) * 100)
      : 100
    
    const completed: CompletedWorkSession = {
      id: generateId(),
      categoryId: session.categoryId,
      categoryName: session.categoryName,
      categoryColor: session.categoryColor,
      plannedDurationSeconds: session.durationSeconds,
      actualDurationSeconds: actualSeconds,
      distractionSeconds: distractionSeconds,
      productivityPct: productivePct,
      notes: session.notes,
      tasks: session.tasks,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
    }
    
    // Mark completed tasks in the database
    for (const task of session.tasks) {
      const taskData = await db.tasks.get(task.taskId)
      if (taskData && !taskData.completedAt) {
        await sync.put('tasks', {
          ...taskData,
          completedAt: new Date().toISOString()
        } as unknown as Record<string, unknown>)
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

const displayElapsed = session.pausedAt
    ? (session.totalElapsedSeconds || 0) + Math.floor((new Date(session.pausedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
    : (session.totalElapsedSeconds || 0) + elapsed
  const progressPct = session.durationSeconds > 0 
    ? (displayElapsed / session.durationSeconds) * 100 
    : 0

return (
    <div className="active-workout" style={{ 
      backgroundColor: 'var(--bg)', 
      color: 'var(--text-h)',
      borderRadius: 16,
      padding: 32,
      boxShadow: 'var(--shadow)',
      maxWidth: 600,
      margin: '0 auto'
    }}>
      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingBottom: 24, 
        borderBottom: '2px solid var(--accent-border)', 
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 32 }}>{session.categoryIcon}</span>
            <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
              {session.categoryName}
            </h2>
          </div>
          <p style={{ margin: 0, opacity: 0.6, fontSize: 14 }}>
            {formatDuration(displayElapsed)} elapsed
            {session.notes && <span> • {session.notes}</span>}
          </p>
        </div>
        <div style={{ 
          fontSize: 56, 
          fontWeight: 800, 
          color: remaining <= 30 && !currentSessionIsPaused ? 'var(--danger)' : 'var(--accent)',
          fontFamily: 'var(--mono)',
          textShadow: remaining <= 30 && !currentSessionIsPaused ? '0 0 20px var(--danger-bg)' : '0 0 20px var(--accent-bg)',
          animation: remaining <= 30 && !currentSessionIsPaused ? 'pulse 1s infinite' : 'none'
        }}>
          {currentSessionIsPaused ? 'PAUSED' : formatCountdown(remaining)}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, opacity: 0.7 }}>
          <span>Progress</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div style={{ 
          height: 8, 
          background: 'var(--accent-bg)', 
          borderRadius: 4, 
          overflow: 'hidden' 
        }}>
          <div style={{ 
            height: '100%', 
            width: `${Math.min(100, progressPct)}%`,
            background: 'var(--accent)',
            borderRadius: 4,
            transition: 'width 1s linear'
          }} />
        </div>
      </div>

{session.tasks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 14, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5 }}>
            Tasks {completedTaskIds.size > 0 && <span style={{ fontWeight: 400, opacity: 0.7 }}>• {completedTaskIds.size}/{session.tasks.length} done</span>}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {session.tasks.map((task, i) => {
              const isCompleted = completedTaskIds.has(task.taskId)
              return (
                <div 
                  key={i} 
                  style={{ 
                    padding: 14, 
                    background: isCompleted ? 'var(--accent-bg)' : 'var(--code-bg)', 
                    borderRadius: 10, 
                    border: `1px solid ${isCompleted ? 'var(--accent-border)' : 'var(--border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => toggleTaskComplete(task.taskId)}
                >
                  <div style={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: '50%', 
                    border: `2px solid ${isCompleted ? 'var(--accent)' : 'var(--border)'}`,
                    background: isCompleted ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#fff',
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <p style={{ margin: 0, fontWeight: 500, flex: 1, textDecoration: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.6 : 1 }}>{task.title}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

<div style={{ 
        display: 'flex', 
        gap: 12, 
        justifyContent: 'center', 
        flexWrap: 'wrap',
        paddingTop: 8
      }}>
        <button 
          className="btn" 
          style={{ 
            background: currentSessionIsPaused 
              ? 'var(--accent)' 
              : 'var(--warning)', 
            color: 'white',
            padding: '12px 24px',
            borderRadius: 10,
            fontWeight: 600,
            boxShadow: currentSessionIsPaused 
              ? '0 4px 12px var(--accent-bg)' 
              : '0 4px 12px var(--warning-bg)'
          }} 
          onClick={handlePauseResume}
        >
          {currentSessionIsPaused ? <IconPlay /> : <IconPause />} {currentSessionIsPaused ? 'Resume' : 'Pause'}
        </button>
<button 
          className="btn btn-secondary" 
          onClick={() => setShowTimeModal(true)}
          style={{ padding: '12px 20px', borderRadius: 10 }}
        >
          ✏️ Time
        </button>
<button 
          className={`btn ${isComplete ? 'pulse' : ''}`} 
          onClick={() => setShowEndModal(true)}
          style={{
            background: isComplete 
              ? 'var(--accent)' 
              : 'var(--accent)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: 10,
            fontWeight: 600,
            boxShadow: '0 4px 12px var(--accent-bg)'
          }}
        >
          <IconStop /> {isComplete ? 'Complete!' : 'End Early'}
        </button>
        <button 
          className="btn btn-ghost" 
          onClick={() => setShowDiscardConfirm(true)}
          style={{ padding: '12px 20px', borderRadius: 10, opacity: 0.6 }}
        >
          Discard
        </button>
        <button 
          className="btn btn-ghost" 
          onClick={handleDirectEnd}
          style={{ padding: '8px 16px', borderRadius: 10, opacity: 0.5, fontSize: 12 }}
          title="End now without modal"
        >
          End Now
        </button>
      </div>

      {/* Time Edit Modal */}
      {showTimeModal && (
        <ModalPortal title="Edit Duration" onClose={() => setShowTimeModal(false)}>
          <div style={{ maxWidth: 300 }}>
            <div className="form-label">
              New duration (minutes)
              <input 
                type="number" 
                className="field" 
                min="1" 
                max="240"
                value={newDuration} 
                onChange={e => setNewDuration(+e.target.value)} 
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowTimeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNewTime}>Save</button>
            </div>
          </div>
        </ModalPortal>
      )}

{/* End Session Modal */}
      {showEndModal && (
        <ModalPortal title="End Session" onClose={() => setShowEndModal(false)}>
          <div style={{ maxWidth: 400 }}>
            {session.tasks.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Tasks</h4>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{completedTaskIds.size}/{session.tasks.length} completed</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {session.tasks.map((task, i) => {
                    const isCompleted = completedTaskIds.has(task.taskId)
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          padding: '8px 12px', 
                          background: isCompleted ? 'var(--accent-bg)' : 'var(--bg)', 
                          borderRadius: 6, 
                          border: `1px solid ${isCompleted ? 'var(--accent-border)' : 'var(--border)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: 'pointer'
                        }}
                        onClick={() => toggleTaskComplete(task.taskId)}
                      >
                        <span style={{ 
                          width: 18, 
                          height: 18, 
                          borderRadius: '50%', 
                          border: `2px solid ${isCompleted ? 'var(--accent)' : 'var(--border)'}`,
                          background: isCompleted ? 'var(--accent)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          color: '#fff',
                          flexShrink: 0
                        }}>
                          {isCompleted ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 13, textDecoration: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.6 : 1 }}>{task.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="form-label">
              Total distracted time (minutes)
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px' }}
                  onClick={() => setDistractionInputMinutes(Math.max(0, distractionInputMinutes - 5))}
                >
                  -5
                </button>
<input 
                  type="number" 
                  className="field" 
                  min="0" 
                  max={Math.floor(totalElapsedSoFar / 60)}
                  value={distractionInputMinutes}
                  onChange={e => setDistractionInputMinutes(+e.target.value)} 
                  style={{ textAlign: 'center', fontSize: 18, fontWeight: 600 }}
                />
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px' }}
                  onClick={() => setDistractionInputMinutes(distractionInputMinutes + 5)}
                >
                  +5
                </button>
              </div>
<p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                Planned: {formatDuration(session.durationSeconds)} • Actual: {formatDuration(totalElapsedSoFar)}
              </p>
            </div>
            <div className="form-actions">
              <button className="btn btn-ghost" onClick={() => setShowEndModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmEnd}>End & Save</button>
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
