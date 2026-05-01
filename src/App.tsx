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
import { useEffect, lazy, Suspense, useState, useRef } from 'react'

function DashboardPage() {
  return (
    <div className="dashboard-layout">
      <Dashboard />
      <RightSidebar />
    </div>
  )
}

const WorkSessions = lazy(() => import('./pages/WorkSessions'))

function ActiveSessionOverlay() {
  const navigate = useNavigate()
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const isInitialMount = useRef(true)
  const hasRedirected = useRef(false)
  
  useEffect(() => {
    const checkActive = () => {
      const activeSession = localStorage.getItem('activeWorkSession')
      if (activeSession) {
        // On initial page load with active session, redirect to work sessions page
        if (isInitialMount.current && !hasRedirected.current) {
          hasRedirected.current = true
          navigate('/work-sessions', { replace: true })
        } else {
          setHasActiveSession(true)
        }
      }
    }
    checkActive()
    window.addEventListener('workSessionStatusChange', checkActive)
    return () => window.removeEventListener('workSessionStatusChange', checkActive)
  }, [navigate])
  
  useEffect(() => {
    const handleShowEndModal = () => {
      if (localStorage.getItem('activeWorkSession')) {
        setHasActiveSession(true)
      }
    }
    window.addEventListener('showEndWorkSessionModal', handleShowEndModal)
    return () => window.removeEventListener('showEndWorkSessionModal', handleShowEndModal)
  }, [])
  
  const handleSessionFinished = () => {
    setHasActiveSession(false)
  }
  
  const handleSessionDiscard = () => {
    setHasActiveSession(false)
  }
  
  const handleShowTime = () => {
    setHasActiveSession(false)
    navigate('/work-sessions')
  }
  
  const handleShowEnd = () => {
    setHasActiveSession(false)
    navigate('/work-sessions')
  }
  
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setHasActiveSession(false)
    }
  }
  
  if (!hasActiveSession) return null
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={handleBackgroundClick}
    >
      <ActiveWorkSession
        onFinished={handleSessionFinished}
        onDiscard={handleSessionDiscard}
        onShowTime={handleShowTime}
        onShowEnd={handleShowEnd}
      />
    </div>
  )
}

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh' }}>
        <div className="page-loading">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <div className="app-layout">
      <div className="header-navbar">
        <WorkoutTimer />
        <WorkSessionTimer />
      </div>
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/"                     element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"            element={<DashboardPage />} />
          <Route path="/habits"               element={<Habits />} />
          <Route path="/habits/:habitId"      element={<HabitDetail />} />
          <Route path="/tasks"               element={<Tasks />} />
          <Route path="/workouts"             element={<Workouts />} />
          <Route path="/work-sessions"       element={
            <Suspense fallback={<div className="page-loading">Loading Work Sessions...</div>}>
              <WorkSessions />
            </Suspense>
          } />
          <Route path="/settings"           element={<Settings />} />
          <Route path="*"                   element={<Navigate to="/dashboard" replace />} />
        </Routes>
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
