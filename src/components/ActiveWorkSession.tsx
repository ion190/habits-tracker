import { useEffect, useState, useCallback } from 'react'
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

export default function ActiveWorkSession({ onFinished, onDiscard }: Props) {
  const [session, setSession] = useState<ActiveWorkSession | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [distractionInput, setDistractionInput] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem('activeWorkSession')
    if (!raw) return onDiscard()
    const s: ActiveWorkSession = JSON.parse(raw)
    setSession(s)
  }, [onDiscard])

  useEffect(() => {
    if (!session) return
    let startTime = new Date(session.startedAt).getTime()
    if (session.pausedAt) {
      const pauseTime = new Date(session.pausedAt).getTime() - startTime
      startTime += pauseTime
    }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }
    const interval = setInterval(tick, 1000)
    tick()
    return () => clearInterval(interval)
  }, [session])

  const persist = useCallback((updates: Partial<ActiveWorkSession>) => {
    if (!session) return
    const updated = { ...session, ...updates }
    localStorage.setItem('activeWorkSession', JSON.stringify(updated))
    setSession(updated)
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
  }, [session])

  if (!session) return null

  const remaining = Math.max(0, session.durationSeconds - elapsed)
  const isComplete = remaining <= 0

  const handlePauseResume = () => {
    persist(isPaused ? { pausedAt: undefined } : { pausedAt: new Date().toISOString() })
    setIsPaused(!isPaused)
  }

  const handleModifyTime = () => {
    const val = prompt('New duration (seconds):', session.durationSeconds.toString())
    if (val && !isNaN(+val)) persist({ durationSeconds: +val })
  }

  const confirmEnd = async () => {
    const distraction = +distractionInput
    const productivePct = Math.round(((elapsed - distraction) / elapsed) * 100) || 0
    const completed: CompletedWorkSession = {
      id: generateId(),
      categoryId: session.categoryId,
      categoryName: session.categoryName,
      categoryColor: session.categoryColor,
      plannedDurationSeconds: session.durationSeconds,
      actualDurationSeconds: elapsed,
      distractionSeconds: distraction,
      productivityPct: productivePct,
      notes: session.notes,
      tasks: session.tasks,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
    }
    await sync.put('completedWorkSessions', completed as unknown as Record<string, unknown>)
    localStorage.removeItem('activeWorkSession')
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    if (isComplete) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain); gain.connect(audioCtx.destination)
      osc.frequency.value = 800; osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1)
      osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime + 1)
    }
    onFinished()
  }

  const confirmDiscard = () => {
    localStorage.removeItem('activeWorkSession')
    window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    setShowDiscardConfirm(false)
    onDiscard()
  }

  return (
    <div className="active-workout" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:24, borderBottom:'2px solid #fecaca', marginBottom:24 }}>
        <div>
          <h2 style={{ margin:0, fontSize:28, color:'#dc2626' }}>{session.categoryIcon} {session.categoryName}</h2>
          <p style={{ margin:'4px 0 0 0', opacity:0.8, fontSize:14 }}>{formatDuration(elapsed)} elapsed • {session.notes || 'No notes'}</p>
        </div>
        <div style={{ fontSize:48, fontWeight:900, color: remaining <= 30 ? '#dc2626' : '#ef4444' }}>
          {formatCountdown(remaining)}
        </div>
      </div>

      {session.tasks.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <h3 style={{ margin:'0 0 12px 0', fontSize:16 }}>Tasks</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {session.tasks.map((task, i) => (
              <div key={i} style={{ padding:12, background:'rgba(254,242,242,0.5)', borderRadius:8, border:'1px solid #fecaca' }}>
                <p style={{ margin:0, fontWeight:500 }}>{task.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="btn" style={{ background: isPaused ? '#22c55e' : '#f59e0b', color:'white' }} onClick={handlePauseResume}>
          {isPaused ? <IconPlay /> : <IconPause />} {isPaused ? 'Resume' : 'Pause'}
        </button>
        <button className="btn btn-secondary" onClick={handleModifyTime}>
          ✏️ Modify Time
        </button>
        <button className={`btn btn-danger ${isComplete ? 'pulse' : ''}`} onClick={() => setShowEndModal(true)}>
          <IconStop /> {isComplete ? 'Complete!' : 'End Early'}
        </button>
        <button className="btn btn-ghost" onClick={() => setShowDiscardConfirm(true)}>
          Discard
        </button>
      </div>

      {showEndModal && (
        <ModalPortal title="End Session" onClose={() => setShowEndModal(false)}>
          <div style={{ maxWidth:400 }}>
            <div className="form-label">
              Total distracted time (seconds)
              <input type="number" className="field" min="0" max={elapsed}
                value={distractionInput} onChange={e => setDistractionInput(+e.target.value)} />
              <p style={{ fontSize:12, opacity:0.7, marginTop:4 }}>
                Planned: {formatDuration(session.durationSeconds)} • Actual: {formatDuration(elapsed)}
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