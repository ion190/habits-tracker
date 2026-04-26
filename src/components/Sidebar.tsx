import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { db } from '../db/database'
import type { Habit } from '../db/database'
import { IconGrid, IconCheck, IconDumbbell, IconSettings } from './Icons'
import SyncBadge from './SyncBadge'

export default function Sidebar() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitsOpen, setHabitsOpen] = useState(true)

  useEffect(() => {
    db.habits.filter(h => !h.archivedAt).toArray().then(setHabits)
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28">
          <rect width="28" height="28" rx="8" fill="var(--accent)" />
          <path d="M9 14h10M14 9v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>Rituals</span>
      </div>

      <nav className="sidebar-nav">
        <p className="sidebar-section">Menu</p>

        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <IconGrid /> Dashboard
        </NavLink>

        <div>
          <div className="sidebar-link sidebar-parent" onClick={() => setHabitsOpen(o => !o)}>
            <span style={{ display:'flex', alignItems:'center', gap:10 }}>
              <IconCheck /> Habits
            </span>
            <span style={{ fontSize:10, opacity:0.5 }}>{habitsOpen ? '▲' : '▼'}</span>
          </div>

          {habitsOpen && (
            <div className="sidebar-children">
              <NavLink to="/habits" end className={({ isActive }) => `sidebar-link sidebar-child ${isActive ? 'active' : ''}`}>
                All habits
              </NavLink>
              {habits.map(h => (
                <NavLink key={h.id} to={`/habits/${h.id}`} className={({ isActive }) => `sidebar-link sidebar-child ${isActive ? 'active' : ''}`}>
                  <span className="habit-dot-sm" style={{ background: h.color }} />
                  {h.name}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <NavLink to="/workouts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <IconDumbbell /> Workouts
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <IconSettings /> Settings
        </NavLink>
      </nav>

      <div style={{ marginTop:'auto', paddingTop:12, borderTop:'1px solid var(--border)' }}>
        <SyncBadge />
      </div>
    </aside>
  )
}