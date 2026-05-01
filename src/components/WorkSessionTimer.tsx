import { useEffect, useState, useCallback } from 'react'
import { formatCountdown } from '../utils'
import type { ActiveWorkSession } from '../db/database'

interface SessionData {
  session: ActiveWorkSession
  elapsed: number
  isPaused: boolean
}

export default function WorkSessionTimer() {
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isActive, setIsActive] = useState(false)

  const checkActive = useCallback(() => {
    const raw = localStorage.getItem('activeWorkSession')
    if (raw) {
      try {
        const session = JSON.parse(raw) as ActiveWorkSession
        const isPaused = !!session.pausedAt
        let elapsed: number
        if (isPaused) {
          elapsed = Math.floor((new Date(session.pausedAt!).getTime() - new Date(session.startedAt).getTime()) / 1000)
        } else {
          elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
        }
        const remaining = isPaused ? session.durationSeconds : Math.max(0, session.durationSeconds - elapsed)
        setSessionData({ session, elapsed: Math.max(0, remaining), isPaused })
        setIsActive(true)
        return true
      } catch (e) {
        console.warn('Invalid activeWorkSession:', e)
        localStorage.removeItem('activeWorkSession')
      }
    } else {
      setIsActive(false)
      setSessionData(null)
    }
    return false
  }, [])

  useEffect(() => {
    checkActive()
  }, [checkActive])

  useEffect(() => {
    const handleChange = () => checkActive()
    window.addEventListener('storage', handleChange)
    window.addEventListener('workSessionStatusChange', handleChange)
    const int = setInterval(checkActive, 1000)
    return () => {
      window.removeEventListener('storage', handleChange)
      window.removeEventListener('workSessionStatusChange', handleChange)
      clearInterval(int)
    }
  }, [checkActive])

  if (!isActive || !sessionData) return null

  const { session, elapsed: remaining, isPaused } = sessionData
  const isLow = remaining < 10 && !isPaused
  const totalDuration = session.durationSeconds
  const progressPct = totalDuration > 0 ? ((totalDuration - remaining) / totalDuration) * 100 : 0

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('showEndWorkSessionModal'))
  }

  return (
    <div 
      className="header-timer work-session-timer"
      style={{ 
        color: isPaused ? '#f59e0b' : '#a5b4fc',
        border: `1px solid ${isPaused ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`,
        fontWeight: 600,
        padding: '6px 14px',
        borderRadius: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: isLow 
          ? '0 0 20px rgba(248, 113, 113, 0.3)' 
          : isPaused
            ? '0 0 15px rgba(245, 158, 11, 0.2)'
            : '0 0 15px rgba(99, 102, 241, 0.2)',
        animation: isLow ? 'blink 1s infinite' : 'none'
      }}
      onClick={handleClick}
      title="Click to manage session"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
        <circle 
          cx="10" cy="10" r="8" 
          fill="none" 
          stroke={isPaused ? 'rgba(245, 158, 11, 0.3)' : 'rgba(99, 102, 241, 0.3)'} 
          strokeWidth="2" 
        />
        <circle 
          cx="10" cy="10" r="8" 
          fill="none" 
          stroke={isLow ? '#f87171' : isPaused ? '#f59e0b' : '#818cf8'} 
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${progressPct * 0.5} 100`}
          transform="rotate(-90 10 10)"
          style={{ transition: 'stroke-dasharray 1s linear' }}
        />
      </svg>
      <span style={{ 
        fontFamily: 'JetBrains Mono, Monaco, monospace',
        fontSize: 14,
        fontWeight: 700,
        color: isLow ? '#f87171' : isPaused ? '#f59e0b' : '#a5b4fc'
      }}>
        {isPaused ? 'PAUSED' : formatCountdown(remaining)}
      </span>
    </div>
  )
}
