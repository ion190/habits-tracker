import { useEffect, useState, useCallback } from 'react'
import { formatCountdown } from '../utils'
import type { ActiveWorkSession } from '../db/database'

// ─── Shared elapsed model (mirrors ActiveWorkSession.tsx) ──
// Must stay in sync with getElapsed() in ActiveWorkSession.tsx
function getElapsed(s: ActiveWorkSession): number {
  const segStart = new Date(s.startedAt).getTime()
  const segEnd   = s.pausedAt ? new Date(s.pausedAt).getTime() : Date.now()
  const segSecs  = Math.max(0, Math.floor((segEnd - segStart) / 1000))
  return (s.totalElapsedSeconds ?? 0) + segSecs
}

interface TimerState {
  session:    ActiveWorkSession
  elapsed:    number   // total seconds elapsed
  remaining:  number   // seconds left
  isPaused:   boolean
  progressPct: number  // 0-100
}

export default function WorkSessionTimer() {
  const [state, setState] = useState<TimerState | null>(null)

  const refresh = useCallback(() => {
    const raw = localStorage.getItem('activeWorkSession')
    if (!raw) { setState(null); return }

    try {
      const session  = JSON.parse(raw) as ActiveWorkSession
      const elapsed  = getElapsed(session)
      const remaining = Math.max(0, session.durationSeconds - elapsed)
      const isPaused  = !!session.pausedAt
      const progressPct = session.durationSeconds > 0
        ? Math.min(100, (elapsed / session.durationSeconds) * 100)
        : 0
      setState({ session, elapsed, remaining, isPaused, progressPct })
    } catch {
      localStorage.removeItem('activeWorkSession')
      setState(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('workSessionStatusChange', refresh)
    const interval = setInterval(refresh, 1000)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('workSessionStatusChange', refresh)
      clearInterval(interval)
    }
  }, [refresh])

  if (!state) return null

  const { session, remaining, isPaused, progressPct } = state
  const isLow = remaining < 60 && !isPaused

  // SVG circle progress
  const r    = 8
  const circ = 2 * Math.PI * r   // ≈ 50.27
  const dash = circ * (progressPct / 100)
  const strokeColor = isLow ? '#f87171' : isPaused ? '#f59e0b' : '#818cf8'

  return (
    <div
      className="header-timer work-session-timer"
      onClick={() => window.dispatchEvent(new CustomEvent('showEndWorkSessionModal'))}
      title={`${session.categoryName} — click to manage`}
      style={{
        color:        strokeColor,
        border:       `1px solid ${strokeColor}66`,
        fontWeight:   600,
        padding:      '6px 14px',
        borderRadius: 20,
        display:      'flex',
        alignItems:   'center',
        gap:          10,
        cursor:       'pointer',
        transition:   'all 0.3s ease',
        boxShadow:    `0 0 15px ${strokeColor}33`,
        animation:    isLow ? 'blink 1s infinite' : 'none',
      }}
    >
      {/* Progress ring */}
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
        <circle cx="10" cy="10" r={r} fill="none" stroke={`${strokeColor}33`} strokeWidth="2" />
        <circle
          cx="10" cy="10" r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 10 10)"
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>

      <span style={{
        fontFamily: 'JetBrains Mono, Monaco, monospace',
        fontSize:   14,
        fontWeight: 700,
        color:      strokeColor,
      }}>
        {isPaused ? 'PAUSED' : formatCountdown(remaining)}
      </span>
    </div>
  )
}