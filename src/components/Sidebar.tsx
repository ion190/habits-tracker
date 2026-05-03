import { useEffect, useState, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { db } from '../db/database'
import { sync } from '../db/sync'
import type { Habit, JournalEntry } from '../db/database'
import { dateKeyForPeriod } from '../db/database'
import { IconGrid, IconCheck, IconChecklist, IconCalendar, IconTimer, IconBook, IconDumbbell, IconSettings, IconUpload } from './Icons'
import SyncBadge from './SyncBadge'
import { useMatch } from 'react-router-dom'



export default function Sidebar() {
  const [habits,            setHabits]            = useState<Habit[]>([])
  const [recentJournal,     setRecentJournal]      = useState<JournalEntry[]>([])
  const [habitsOpen,        setHabitsOpen]         = useState(false)
  const [journalOpen,       setJournalOpen]        = useState(false)
  const [isWorkoutActive,   setIsWorkoutActive]    = useState(false)
  const [isSessionActive,   setIsSessionActive]    = useState(false)
  const [isSyncing,         setIsSyncing]          = useState(false)
  const [pendingCount,      setPendingCount]       = useState(0)
  const [todayHasNote,      setTodayHasNote]       = useState(false)
  const habitsMatch = useMatch('/habits/:id?')
  const journalMatch = useMatch('/journal')

  const loadData = useCallback(async () => {
    const [h, journal] = await Promise.all([
      db.habits.filter(h => !h.archivedAt).toArray(),
      db.journalEntries.toArray().then(all =>
        all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
      ),
    ])
    setHabits(h)
    setRecentJournal(journal)

    const todayKey = dateKeyForPeriod('daily')
    const todayEntry = await db.journalEntries
      .where('dateKey').equals(todayKey).first()
    setTodayHasNote(!!todayEntry?.content)

    const count = await sync.getPendingCount()
    setPendingCount(count)
  }, [])

  useEffect(() => {
    loadData()

    const handleStorage = () => {
      setIsWorkoutActive(!!localStorage.getItem('activeWorkout'))
      setIsSessionActive(!!localStorage.getItem('activeWorkSession'))
    }
    const handleSession = () => { handleStorage(); loadData() }

    window.addEventListener('storage',               handleStorage)
    window.addEventListener('workoutStatusChange',   handleSession)
    window.addEventListener('workSessionStatusChange', handleSession)
    handleStorage()

    // Refresh pending count every 10s
    const interval = setInterval(() => sync.getPendingCount().then(setPendingCount), 10_000)
    return () => {
      window.removeEventListener('storage',               handleStorage)
      window.removeEventListener('workoutStatusChange',   handleSession)
      window.removeEventListener('workSessionStatusChange', handleSession)
      clearInterval(interval)
    }
  }, [loadData])

  const handleManualSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    await sync.manualFlush()
    const count = await sync.getPendingCount()
    setPendingCount(count)
    setIsSyncing(false)
  }

  const periodEmoji: Record<string, string> = {
    daily: '📅', weekly: '📆', monthly: '🗓️', quarterly: '📊', yearly: '📖', decadely: '📜',
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconGrid /> Dashboard
          </NavLink>

<NavLink to="/tasks" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconChecklist /> Tasks
          </NavLink>

          
          {/* Calendar */}
          <NavLink to="/calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconCalendar /> Calendar
          </NavLink>

          {/* Habits (collapsible) */}
          <div>
            <div className={`sidebar-parent ${(habitsMatch ? 'active' : '')}`}>
              <NavLink to="/habits" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} style={{ flex: 1 }}>
                <IconCheck /> Habits
              </NavLink>
              <span className="sidebar-toggle" onClick={() => setHabitsOpen(o => !o)}>
                {habitsOpen ? '▲' : '▼'}
              </span>
            </div>
            {habitsOpen && (
              <div className="sidebar-children">
                {habits.map(h => (
                  <NavLink key={h.id} to={`/habits/${h.id}`}
                    className={({ isActive }) => `sidebar-link sidebar-child ${isActive ? 'active' : ''}`}>
                    <span className="habit-dot-sm" style={{ background: h.color }} />
                    {h.name}
                  </NavLink>
                ))}
              </div>
            )}
          </div>

                    <NavLink to="/work-sessions"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isSessionActive ? 'ongoing-workout' : ''}`}>
            <IconTimer /> Work Sessions
          </NavLink>

          <NavLink to="/workouts"
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isWorkoutActive ? 'ongoing-workout' : ''}`}>
            <IconDumbbell /> Workouts
          </NavLink>





          {/* Journal (collapsible with preview) */}
          <div>
            <div className={`sidebar-parent ${(journalMatch ? 'active' : '')}`}>
              <NavLink to="/journal" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} style={{ flex: 1 }}>
                <IconBook />
                <span>Journal</span>
                {todayHasNote && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
                    flexShrink: 0, marginLeft: 2,
                  }} title="Today's note written" />
                )}
              </NavLink>
              <span className="sidebar-toggle" onClick={() => setJournalOpen(o => !o)}>
                {journalOpen ? '▲' : '▼'}
              </span>
            </div>
            {journalOpen && recentJournal.length > 0 && (
              <div className="sidebar-children">
                {recentJournal.map(entry => (
                  <NavLink key={entry.id} to={`/journal?period=${entry.period}&key=${entry.dateKey}`}
                    className={({ isActive }) => `sidebar-link sidebar-child ${isActive ? 'active' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                      <span style={{ fontSize: 12 }}>{periodEmoji[entry.period]}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.title || entry.dateKey}
                      </span>
                    </div>
                    <span style={{ fontSize: 10.5, opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', paddingLeft: 18 }}>
                      {entry.content.slice(0, 45)}{entry.content.length > 45 ? '…' : ''}
                    </span>
                  </NavLink>
                ))}
              </div>
            )}
            {journalOpen && recentJournal.length === 0 && (
              <div className="sidebar-children">
                <p className="sidebar-empty">No entries yet</p>
              </div>
            )}
          </div>

          <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <IconSettings /> Settings
          </NavLink>
        </nav>

        {/* Bottom: sync badge + manual push button */}
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <SyncBadge />
          </div>
          {pendingCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              title={`Push ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} to cloud`}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 9px', borderRadius: 7,
                background: isSyncing ? 'var(--accent-bg)' : 'var(--code-bg)',
                border: '1px solid var(--accent-border)',
                color: 'var(--accent)', cursor: isSyncing ? 'not-allowed' : 'pointer',
                fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                animation: isSyncing ? 'none' : undefined,
              }}
            >
              <span style={{ display: 'flex', animation: isSyncing ? 'spin 1s linear infinite' : 'none' }}>
                <IconUpload />
              </span>
              {isSyncing ? 'Pushing…' : `Push ${pendingCount}`}
            </button>
          )}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconGrid /><span>Home</span>
        </NavLink>
        <NavLink to="/habits" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconCheck /><span>Habits</span>
        </NavLink>
        <NavLink to="/tasks" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconChecklist /><span>Tasks</span>
        </NavLink>
        <NavLink to="/workouts" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconDumbbell /><span>Gym</span>
        </NavLink>
        <NavLink to="/work-sessions" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconTimer /><span>Focus</span>
        </NavLink>
        <NavLink to="/journal" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconBook /><span>Journal</span>
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconCalendar /><span>Calendar</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `bottom-nav-link ${isActive ? 'active' : ''}`}>
          <IconSettings /><span>Settings</span>
        </NavLink>
      </nav>
    </>
  )
}