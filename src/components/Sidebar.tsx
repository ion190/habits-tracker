import { NavLink } from 'react-router-dom'
import { IconGrid, IconCheck, IconDumbbell, IconSettings } from './Icons'

const links = [
  { to: '/',         label: 'Dashboard', Icon: IconGrid },
  { to: '/habits',   label: 'Habits',    Icon: IconCheck },
  { to: '/workouts', label: 'Workouts',  Icon: IconDumbbell },
  { to: '/settings', label: 'Settings',  Icon: IconSettings },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28">
          <rect width="28" height="28" rx="8" fill="var(--accent)" />
          <path d="M9 14h10M14 9v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <span>Rituals</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <p className="sidebar-section">Menu</p>
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}