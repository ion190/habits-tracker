import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { db } from '../db/database'
import type { Habit } from '../db/database'
import { IconGrid, IconCheck, IconDumbbell, IconSettings } from './Icons'
import SyncBadge from './SyncBadge'

const IconChecklist = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </svg>
)

const IconTimer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
)


export default function Sidebar() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitsOpen, setHabitsOpen] = useState(true)
  const [isWorkoutActive, setIsWorkoutActive] = useState(false)
  const [isWorkSessionActive, setIsWorkSessionActive] = useState(false)

  useEffect(() => {
    const handleStorageChange = () => {
      const workoutRaw = localStorage.getItem('activeWorkout')
      const sessionRaw = localStorage.getItem('activeWorkSession')
      setIsWorkoutActive(!!workoutRaw)
      setIsWorkSessionActive(!!sessionRaw)
    }
    const handleStatusChange = () => {
      handleStorageChange()
      // Also listen for work session events
      window.dispatchEvent(new CustomEvent('workSessionStatusChange'))
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('workoutStatusChange', handleStatusChange)
    window.addEventListener('workSessionStatusChange', handleStorageChange)
    handleStorageChange() // Initial
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('workoutStatusChange', handleStatusChange)
      window.removeEventListener('workSessionStatusChange', handleStorageChange)
    }
  }, [])

  useEffect(() => {
    db.habits.filter(h => !h.archivedAt).toArray().then(setHabits)
  }, [])


  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        {/* <div className="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <rect width="28" height="28" rx="8" fill="var(--accent)" />
            <path d="M9 14h10M14 9v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span>Journal</span>
        </div> */}

        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconGrid /> Dashboard
          </NavLink>

          <div>
            <div className="sidebar-link sidebar-parent">
              <NavLink
                to="/habits"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                style={{ flex: 1, padding: 0, background: 'none' }}
              >
                <IconCheck /> Habits
              </NavLink>
              <span
                style={{ fontSize:10, opacity:0.5, cursor:'pointer', padding:'4px 8px', borderRadius:4 }}
                onClick={() => setHabitsOpen(o => !o)}
              >
                {habitsOpen ? '▲' : '▼'}
              </span>
            </div>

            {habitsOpen && (
              <div className="sidebar-children">
                {habits.map(h => (
                  <NavLink key={h.id} to={`/habits/${h.id}`} className={({ isActive }) => `sidebar-link sidebar-child ${isActive ? 'active' : ''}`}>
                    <span className="habit-dot-sm" style={{ background: h.color }} />
                    {h.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          <NavLink to="/tasks" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconChecklist /> Tasks
          </NavLink>

          <NavLink to="/workouts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isWorkoutActive ? 'ongoing-workout' : ''}`}>
            <IconDumbbell /> Workouts
          </NavLink>

          <NavLink to="/work-sessions" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isWorkSessionActive ? 'ongoing-workout' : ''}`}>
            <IconTimer /> Work Sessions
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconSettings /> Settings
          </NavLink>
        </nav>

        <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <SyncBadge />
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconGrid />
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/habits" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconCheck />
          <span>Habits</span>
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconChecklist />
          <span>Tasks</span>
        </NavLink>
        <NavLink to="/workouts" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconDumbbell />
          <span>Workouts</span>
        </NavLink>
        <NavLink to="/work-sessions" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconTimer />
          <span>Sessions</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconSettings />
          <span>Settings</span>
        </NavLink>
      </nav>
    </>
  )
}

