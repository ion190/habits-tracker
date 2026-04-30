
import { useEffect, useState, useCallback } from 'react'
import { formatCountdown } from '../utils'

export default function WorkSessionTimer() {
  const [remaining, setRemaining] = useState(0)
  const [isActive, setIsActive] = useState(false)

  const checkActive = useCallback(() => {
    const raw = localStorage.getItem('activeWorkSession')
    if (raw) {
      try {
        const session = JSON.parse(raw) as any
        const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
        const remaining = session.durationSeconds - elapsed
        setRemaining(Math.max(0, remaining))
        setIsActive(true)
        return true
      } catch (e) {
        console.warn('Invalid activeWorkSession:', e)
        localStorage.removeItem('activeWorkSession')
      }
    } else {
      setIsActive(false)
      setRemaining(0)
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

  if (!isActive || remaining === 0) return null

  const isLow = remaining < 10
  const blinkStyle = isLow ? { animation: 'blink 1s infinite' } : {}

  return (
    <div 
      className="header-timer work-session-timer"
      style={{ 
        ...blinkStyle,
        background: 'rgba(239,68,68,0.2)',
        color: 'var(--danger)',
        border: '1px solid var(--danger)',
        fontWeight: 600
      }}
      onClick={() => {
        if (confirm('End work session early?')) {
          localStorage.removeItem('activeWorkSession')
          window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
        }
      }}
      title="Click to end early"
    >
      {formatCountdown(remaining)}
    </div>
  )
}

