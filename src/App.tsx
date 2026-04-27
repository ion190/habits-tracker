// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import HabitDetail from './pages/HabitDetail'
import Tasks from './pages/Tasks'
import Workouts from './pages/Workouts'
import Settings from './pages/Settings'
import AuthPage from './pages/AuthPage'

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
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/"                     element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"            element={<Dashboard />} />
          <Route path="/habits"               element={<Habits />} />
          <Route path="/habits/:habitId"      element={<HabitDetail />} />
          <Route path="/tasks"                element={<Tasks />} />
          <Route path="/workouts"             element={<Workouts />} />
          <Route path="/settings"             element={<Settings />} />
          <Route path="*"                     element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/habits-tracker">
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  )
}