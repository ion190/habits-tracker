import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
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

function buildDayMap(habits: Habit[], logs: HabitLog[], workouts: CompletedWorkout[]): Map<string, DayData> {
  const map = new Map<string, DayData>()
  for (let i = 0; i < 364; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (363 - i))
    const key = toDateKey(d.toISOString())
    map.set(key, { date: key, habitIds: [], workoutNames: [], totalWorkoutSeconds: 0 })
  }
  for (const log of logs) {
    const key = toDateKey(log.completedAt)
    const entry = map.get(key)
    if (entry && !entry.habitIds.includes(log.habitId)) entry.habitIds.push(log.habitId)
  }
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

function Tooltip({ day, habits, x, y }: { day: DayData; habits: Habit[]; x: number; y: number }) {
  const style: CSSProperties = {
    position: 'fixed', left: x + 12, top: y - 12, zIndex: 9999, pointerEvents: 'none',
  }
  const completedHabits = day.habitIds.map(hid => habits.find(h => h.id === hid)).filter(Boolean) as Habit[]
  const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return (
    <div className="hm-tooltip" style={style}>
      <p className="hm-tooltip-date">{dateStr}</p>
      {completedHabits.length > 0 && (
        <div className="hm-tooltip-section">
          <p className="hm-tooltip-label">Habits ({completedHabits.length})</p>
          <div className="hm-tooltip-habits">
            {completedHabits.map(h => (
              <span key={h.id} className="hm-tooltip-tag" style={{ background: h.color + '22', borderColor: h.color + '55', color: h.color }}>
                <span className="hm-tooltip-dot" style={{ background: h.color }} />{h.name}
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

function CellContent({ day, habits }: { day: DayData; habits: Habit[] }) {
  const hasActivity = day.habitIds.length > 0 || day.workoutNames.length > 0
  if (!hasActivity) return null
  return (
    <div className="hm-segments">
      {day.habitIds.map(hid => {
        const h = habits.find(x => x.id === hid)
        if (!h) return null
        return <div key={hid} className="hm-seg" style={{ background: h.color }} />
      })}
      {day.workoutNames.length > 0 && <div className="hm-seg hm-seg-workout" />}
    </div>
  )
}

export default function UnifiedHeatmap({ habits, logs, workouts }: Props) {
  const [hovered, setHovered] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(t)
  }, [])

  const days = useMemo(() => {
    const arr: string[] = []
    for (let i = 0; i < 364; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (363 - i))
      arr.push(toDateKey(d.toISOString()))
    }
    return arr
  }, [])

  const dayMap = useMemo(() => buildDayMap(habits, logs, workouts), [habits, logs, workouts])

  const firstDayOfWeek = new Date(days[0]).getDay()
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const totalCols = Math.ceil((pad + days.length) / 7)

  const labels = useMemo(() => {
    const arr: { month: string; col: number }[] = []
    let currentMonth = -1
    days.forEach((d, i) => {
      const date = new Date(d + 'T00:00:00')
      const m = date.getMonth()
      if (m !== currentMonth) {
        currentMonth = m
        const absPos = pad + i
        const col = absPos % 7 === 0 ? Math.floor(absPos / 7) : Math.floor(absPos / 7) + 1
        arr.push({ month: date.toLocaleString('en-US', { month: 'short' }), col })
      }
    })
    return arr
  }, [days, pad])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div className="unified-heatmap" onMouseMove={handleMouseMove}>
      <div className="hm-scroll" ref={scrollRef}>
        <div
          className="hm-grid"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, 14px)`,
            gridTemplateRows: 'auto repeat(7, 14px)',
            gridAutoFlow: 'unset',
          }}
        >
          {/* Month labels */}
          {Array.from({ length: totalCols }).map((_, col) => {
            const label = labels.find(l => l.col === col)
            return (
              <div key={`m${col}`} className="hm-month" style={{
                gridRow: 1, gridColumn: col + 1,
                textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text)',
              }}>
                {label?.month ?? ''}
              </div>
            )
          })}

          {/* Padding */}
          {Array(pad).fill(null).map((_, i) => (
            <div key={`p${i}`} className="hm-cell hm-empty" style={{ gridRow: i + 2, gridColumn: 1 }} />
          ))}

          {/* Day cells */}
          {days.map((d, i) => {
            const day = dayMap.get(d)!
            const hasActivity = day.habitIds.length > 0 || day.workoutNames.length > 0
            const col = Math.floor((pad + i) / 7) + 1
            const row = ((pad + i) % 7) + 2
            return (
              <div
                key={d}
                className={`hm-cell ${hasActivity ? 'hm-active' : 'hm-inactive'}`}
                style={{ gridRow: row, gridColumn: col, cursor: 'pointer' }}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                role="button"
                tabIndex={0}
                aria-label={`${d}: ${day.habitIds.length} habits, ${day.workoutNames.length} workouts`}
              >
                <CellContent day={day} habits={habits} />
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
        {habits.slice(0, 5).map(h => (
          <div key={h.id} className="hm-legend-item">
            <div className="hm-legend-dot" style={{ background: h.color }} />
            <span>{h.name}</span>
          </div>
        ))}
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: 'var(--workout-color)' }} />
          <span>Workout</span>
        </div>
      </div>

      {hovered && <Tooltip day={hovered} habits={habits} x={mousePos.x} y={mousePos.y} />}
    </div>
  )
}