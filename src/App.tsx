import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Habits from './pages/Habits'
import HabitDetail from './pages/HabitDetail'
import Workouts from './pages/Workouts'
import Settings from './pages/Settings'

export default function App() {
  return (
    <BrowserRouter basename="/habits-tracker">
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/"                 element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"        element={<Dashboard />} />
            <Route path="/habits"           element={<Habits />} />
            <Route path="/habits/:habitId"  element={<HabitDetail />} />
            <Route path="/workouts"         element={<Workouts />} />
            <Route path="/settings"         element={<Settings />} />
            <Route path="*"                 element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}