import { useMemo, useState, useCallback, type CSSProperties } from 'react'
import { toDateKey } from '../utils'
import type { Habit, HabitLog, CompletedWorkout } from '../db/database'

interface Props {
  habits: Habit[]
  logs: HabitLog[]
  workouts: CompletedWorkout[]
}

interface DayData {
  date: string
  habitIds: string[]
  workoutNames: string[]
  totalWorkoutSeconds: number
}

/** Build a map of date -> DayData for the last 364 days */
function buildDayMap(
  _habits: Habit[],
  logs: HabitLog[],
  workouts: CompletedWorkout[]
): Map<string, DayData> {
  const map = new Map<string, DayData>()

  // Initialize last 364 days
  for (let i = 0; i < 364; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (363 - i))
    const key = toDateKey(d.toISOString())
    map.set(key, { date: key, habitIds: [], workoutNames: [], totalWorkoutSeconds: 0 })
  }

  // Fill habits
  for (const log of logs) {
    const key = toDateKey(log.completedAt)
    const entry = map.get(key)
    if (entry && !entry.habitIds.includes(log.habitId)) {
      entry.habitIds.push(log.habitId)
    }
  }

  // Fill workouts
  for (const w of workouts) {
    const key = toDateKey(w.startedAt)
    const entry = map.get(key)
    if (entry) {
      entry.workoutNames.push(w.workoutPlanName)
      entry.totalWorkoutSeconds += w.totalDurationSeconds
    }
  }

  return map
}

/** Month labels for the heatmap */
function monthLabels(days: string[]): { month: string; col: number }[] {
  const labels: { month: string; col: number }[] = []
  let currentMonth = -1
  days.forEach((d, i) => {
    const date = new Date(d + 'T00:00:00')
    const m = date.getMonth()
    if (m !== currentMonth) {
      currentMonth = m
      const col = Math.floor(i / 7)
      labels.push({ month: date.toLocaleString('en-US', { month: 'short' }), col })
    }
  })
  return labels
}

function Tooltip({
  day,
  habits,
  x,
  y,
  visible,
}: {
  day: DayData
  habits: Habit[]
  x: number
  y: number
  visible: boolean
}) {
  if (!visible) return null

  const completedHabits = day.habitIds
    .map((hid) => habits.find((h) => h.id === hid))
    .filter(Boolean) as Habit[]

  // Prevent tooltip from going off screen
  const style: CSSProperties = {
    position: 'fixed',
    left: x + 12,
    top: y - 12,
    zIndex: 9999,
    pointerEvents: 'none',
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.1s',
  }

  const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="hm-tooltip" style={style}>
      <p className="hm-tooltip-date">{dateStr}</p>

      {completedHabits.length > 0 && (
        <div className="hm-tooltip-section">
          <p className="hm-tooltip-label">Habits ({completedHabits.length})</p>
          <div className="hm-tooltip-habits">
            {completedHabits.map((h) => (
              <span key={h.id} className="hm-tooltip-tag" style={{ background: h.color + '22', borderColor: h.color + '55', color: h.color }}>
                <span className="hm-tooltip-dot" style={{ background: h.color }} />
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {day.workoutNames.length > 0 && (
        <div className="hm-tooltip-section">
          <p className="hm-tooltip-label">Workouts ({day.workoutNames.length})</p>
          <div className="hm-tooltip-workouts">
            {day.workoutNames.map((name, i) => (
              <span key={i} className="hm-tooltip-tag" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e' }}>
                🏋️ {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {day.habitIds.length === 0 && day.workoutNames.length === 0 && (
        <p className="hm-tooltip-empty">No activity</p>
      )}
    </div>
  )
}

export default function UnifiedHeatmap({ habits, logs, workouts }: Props) {
  const [hovered, setHovered] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [touchDay, setTouchDay] = useState<DayData | null>(null)

  const dayMap = useMemo(() => buildDayMap(habits, logs, workouts), [habits, logs, workouts])

  const days = useMemo(() => {
    const arr: string[] = []
    for (let i = 0; i < 364; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (363 - i))
      arr.push(toDateKey(d.toISOString()))
    }
    return arr
  }, [])

  const firstDayOfWeek = new Date(days[0]).getDay() // 0=Sun, 1=Mon...6=Sat
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Monday-first padding

  const labels = useMemo(() => monthLabels(days), [days])

  const handleMouseMove = useCallback((e: { clientX: number; clientY: number }) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleTouch = useCallback((day: DayData) => {
    setTouchDay((prev: DayData | null) => (prev?.date === day.date ? null : day))
  }, [])

  return (
    <div className="unified-heatmap" onMouseMove={handleMouseMove}>
      {/* Month labels */}
      <div className="hm-months">
        {Array.from({ length: 52 }).map((_, col) => {
          const label = labels.find((l: { month: string; col: number }) => l.col === col)
          return (
            <div key={col} className="hm-month">
              {label?.month ?? ''}
            </div>
          )
        })}
      </div>

      <div className="hm-scroll">
        <div className="hm-grid">
          {Array(pad)
            .fill(null)
            .map((_, i) => (
              <div key={`p${i}`} className="hm-cell hm-empty" />
            ))}
          {days.map((d: string) => {
            const day = dayMap.get(d)!
            const hasActivity = day.habitIds.length > 0 || day.workoutNames.length > 0

            return (
              <div
                key={d}
                className={`hm-cell ${hasActivity ? 'hm-active' : 'hm-inactive'}`}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleTouch(day)}
                role="button"
                tabIndex={0}
                aria-label={`${d}: ${day.habitIds.length} habits, ${day.workoutNames.length} workouts`}
              >
                {/* Inner mini segments */}
                {hasActivity && (
    <div className="hm-segments">
      {day.habitIds.map((hid: string) => {
        const h = habits.find((x) => x.id === hid)
        if (!h) return null
        return <div key={hid} className="hm-seg" style={{ background: h.color }} />
      })}
      {day.workoutNames.length > 0 && (
        <div className="hm-seg hm-seg-workout" />
      )}
    </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="hm-legend-row">
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: 'var(--border)' }} />
          <span>None</span>
        </div>
        {habits.slice(0, 5).map((h) => (
          <div className="hm-legend-item" key={h.id}>
            <div className="hm-legend-dot" style={{ background: h.color }} />
            <span>{h.name}</span>
          </div>
        ))}
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: '#22c55e' }} />
          <span>Workout</span>
        </div>
      </div>

      {/* Hover tooltip (desktop) */}
      {hovered && (
        <Tooltip day={hovered} habits={habits} x={mousePos.x} y={mousePos.y} visible={!!hovered && !touchDay} />
      )}

      {/* Touch detail (mobile) */}
      {touchDay && (
        <div className="hm-touch-detail" onClick={() => setTouchDay(null)}>
          <div className="hm-touch-card" onClick={(e) => e.stopPropagation()}>
            <Tooltip day={touchDay} habits={habits} x={0} y={0} visible />
            <button className="hm-touch-close" onClick={() => setTouchDay(null)}>✕ Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

