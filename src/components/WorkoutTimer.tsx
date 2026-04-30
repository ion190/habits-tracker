import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'


export default function WorkoutTimer() {
  const navigate = useNavigate()
  const [elapsed, setElapsed] = useState(0)
  const [isActive, setIsActive] = useState(false)

  // Central active workout checker - called on mount and events
  const checkActive = useCallback(() => {
    const raw = localStorage.getItem('activeWorkout')
    const isActiveWorkout = !!raw
    
    setIsActive(isActiveWorkout)
    if (isActiveWorkout && raw) {
      try {
        const session = JSON.parse(raw)
        const elapsedSeconds = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
        setElapsed(elapsedSeconds)
      } catch (e) {
        console.warn('Invalid activeWorkout data:', e)
        localStorage.removeItem('activeWorkout')
      }
    } else {
      setElapsed(0)
    }
    return isActiveWorkout
  }, [])

  // Initial check on mount
  useEffect(() => {
    checkActive()
  }, [checkActive])


  // Listen for status changes (cross-tab + custom events)
  useEffect(() => {
    const handleStatusChange = () => checkActive()

    window.addEventListener('storage', handleStatusChange)
    window.addEventListener('workoutStatusChange', handleStatusChange)
    return () => {
      window.removeEventListener('storage', handleStatusChange)
      window.removeEventListener('workoutStatusChange', handleStatusChange)
    }
  }, [checkActive])

  if (!isActive) return null

  const hh = Math.floor(elapsed / 3600).toString().padStart(2, '0')
  const mm = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const ss = (elapsed % 60).toString().padStart(2, '0')
  const timerText = `${hh}:${mm}:${ss}`

  return (
    <div 
      className="header-timer"
      onClick={() => navigate('/workouts')}
      title="Click to go to workouts (ActiveWorkout)"
    >
      {timerText}
    </div>
  )

}
