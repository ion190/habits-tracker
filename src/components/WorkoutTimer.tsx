import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDuration } from '../utils'

export default function WorkoutTimer() {
  const navigate = useNavigate()
  const [elapsed, setElapsed] = useState(0)
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('activeWorkout')
    setIsActive(!!raw)

    if (!raw) return

    const session = JSON.parse(raw)
    const start = new Date(session.startedAt).getTime()
    
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    
    return () => clearInterval(id)
  }, [])

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const raw = localStorage.getItem('activeWorkout')
      setIsActive(!!raw)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  if (!isActive) return null

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '12px 24px',
        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
        color: 'white',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 6px rgba(34, 197, 94, 0.3)',
      }}
      onClick={() => navigate('/workouts')}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 12px rgba(34, 197, 94, 0.4)'
        e.currentTarget.style.transform = 'scale(1.02)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(34, 197, 94, 0.3)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      <span style={{ fontSize: 18 }}>🏋️</span>
      <span>Workout in progress</span>
      <span style={{ 
        fontSize: 16, 
        fontWeight: 700,
        padding: '4px 12px',
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 6,
        minWidth: 70,
        textAlign: 'center',
      }}>
        {formatDuration(elapsed)}
      </span>
    </div>
  )
}
