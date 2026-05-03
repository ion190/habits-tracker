import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import Sidebar from './components/Sidebar'
import RightSidebar from './components/RightSidebar'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import HabitDetail from './pages/HabitDetail'
import Tasks from './pages/Tasks'
import Workouts from './pages/Workouts'
import Settings from './pages/Settings'
import AuthPage from './pages/AuthPage'
import WorkoutTimer from './components/WorkoutTimer'
import WorkSessionTimer from './components/WorkSessionTimer'
import ActiveWorkSession from './components/ActiveWorkSession'
import { sync } from './db/sync'
import React from 'react'
import { useEffect, lazy, Suspense, useState, useRef, useCallback } from 'react'
import ErrorBoundary from './components/ErrorBoundary'

function DashboardPage() {
  return (
    <div className="dashboard-layout">
      <Dashboard />
      <RightSidebar />
    </div>
  )
}

import WorkSessions from './pages/WorkSessions'
const JournalPage  = lazy(() => import('./pages/JournalPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))

function ActiveSessionOverlay() {
  const navigate = useNavigate()
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const isInitialMount = useRef(true)
  const hasRedirected  = useRef(false)

  useEffect(() => {
    const checkActive = () => {
      const activeSession = localStorage.getItem('activeWorkSession')
      if (activeSession) {
        if (isInitialMount.current && !hasRedirected.current) {
          hasRedirected.current = true
          navigate('/work-sessions', { replace: true })
        } else {
          setHasActiveSession(true)
        }
      }
    }
    checkActive()
    isInitialMount.current = false
    window.addEventListener('workSessionStatusChange', checkActive)
    return () => window.removeEventListener('workSessionStatusChange', checkActive)
  }, [navigate])

  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem('activeWorkSession')) setHasActiveSession(true)
    }
    window.addEventListener('showEndWorkSessionModal', handler)
    return () => window.removeEventListener('showEndWorkSessionModal', handler)
  }, [])

  if (!hasActiveSession) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) setHasActiveSession(false) }}
    >
      <ActiveWorkSession
        onFinished={() => setHasActiveSession(false)}
        onDiscard={() => setHasActiveSession(false)}
      />
    </div>
  )
}

const PageFallback = () => <div className="page-loading">Loading…</div>

function AppShell() {
  const { user, loading } = useAuth()
  const [hasActiveTimer, setHasActiveTimer] = useState(false)

  // ── SYNC ROOT CAUSE FIX ───────────────────────────────
  // Call sync.init() whenever the authenticated user changes.
  // Without this, sync.uid is always null → every write is queued
  // locally forever and never reaches Firestore.
  useEffect(() => {
    if (user?.uid) {
      sync.init(user.uid)
      sync.hydrate().catch(console.error)
    } else {
      sync.reset()
    }
  }, [user?.uid])

  // ── Active timer detection ───────────────────────────────
  const checkActiveTimers = useCallback(() => {
    const hasWorkout = !!localStorage.getItem('activeWorkout')
    const hasSession = !!localStorage.getItem('activeWorkSession')
    setHasActiveTimer(hasWorkout || hasSession)
  }, [])

  useEffect(() => {
    const handleStatusChange = () => checkActiveTimers()
    
    // Initial check
    handleStatusChange()
    
    window.addEventListener('storage', handleStatusChange)
    window.addEventListener('workoutStatusChange', handleStatusChange)
    window.addEventListener('workSessionStatusChange', handleStatusChange)

    return () => {
      window.removeEventListener('storage', handleStatusChange)
      window.removeEventListener('workoutStatusChange', handleStatusChange)
      window.removeEventListener('workSessionStatusChange', handleStatusChange)
    }
  }, [checkActiveTimers])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh' }}>
        <div className="page-loading">Loading…</div>
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
<div className="app-layout" style={{ '--header-height': hasActiveTimer ? '50px' : '0px' } as React.CSSProperties}>
{hasActiveTimer && (
        <div className="header-navbar">
          <WorkoutTimer />
          <WorkSessionTimer />
        </div>
      )}
      <Sidebar />
      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/"               element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"      element={<DashboardPage />} />
            <Route path="/habits"         element={<Habits />} />
            <Route path="/habits/:habitId" element={<HabitDetail />} />
            <Route path="/tasks"          element={<Tasks />} />
            <Route path="/workouts"       element={<Workouts />} />
            <Route path="/work-sessions"  element={<WorkSessions />} />
            <Route path="/journal"        element={
              <Suspense fallback={<PageFallback />}><JournalPage /></Suspense>
            } />
            <Route path="/calendar"       element={
              <Suspense fallback={<PageFallback />}><CalendarPage /></Suspense>
            } />
            <Route path="/settings"       element={<Settings />} />
            <Route path="*"               element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <ActiveSessionOverlay />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}