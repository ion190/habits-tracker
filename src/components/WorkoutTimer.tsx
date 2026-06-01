import { useEffect, useState, useCallback } from 'react'


export default function WorkoutTimer() {
  const [elapsed, setElapsed] = useState(0)
  const [isActive, setIsActive] = useState(false)

  // Central active workout checker - recalculates elapsed time from timestamp
  const refresh = useCallback(() => {
    const raw = localStorage.getItem('activeWorkout')
    const isActiveWorkout = !!raw
    
    setIsActive(isActiveWorkout)
    if (isActiveWorkout && raw) {
      try {
        const session = JSON.parse(raw)
        const elapsedSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
        setElapsed(elapsedSeconds)
      } catch (e) {
        // Invalid activeWorkout data
        localStorage.removeItem('activeWorkout')
        setElapsed(0)
      }
    } else {
      setElapsed(0)
    }
    return isActiveWorkout
  }, [])

  // Initial check on mount and set up interval
  useEffect(() => {
    refresh()
    
    // Recalculate elapsed time every second (accounts for app backgrounding)
    const interval = setInterval(refresh, 1000)
    
    return () => clearInterval(interval)
  }, [refresh])

  // Listen for status changes (cross-tab + custom events)
  useEffect(() => {
    const handleStatusChange = () => refresh()

    window.addEventListener('storage', handleStatusChange)
    window.addEventListener('workoutStatusChange', handleStatusChange)
    return () => {
      window.removeEventListener('storage', handleStatusChange)
      window.removeEventListener('workoutStatusChange', handleStatusChange)
    }
  }, [refresh])

  if (!isActive) return null

  const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')
  const timerText = `${hh}:${mm}:${ss}`

  return (
    <div
      className="header-timer"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      title="Click to scroll to top"
    >
      {timerText}
    </div>
  )

}
