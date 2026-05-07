import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { toDateKey } from '../utils'
import type { Habit, HabitLog, CompletedWorkout } from '../db/database'

interface Props {
  habits: Habit[]
  logs: HabitLog[]
  workouts: CompletedWorkout[]
}

// Multi-select filter: empty habitIds + workout=false means "show all"
interface LegendFilter {
  habitIds: string[]
  workout: boolean
}

const FILTER_ALL: LegendFilter = { habitIds: [], workout: false }
const isFilterAll = (f: LegendFilter) => f.habitIds.length === 0 && !f.workout

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

/** Resolve which habit IDs and whether workouts are visible for a given day + filter. */
function resolveVisible(day: DayData, habits: Habit[], filter: LegendFilter) {
  const showAll = isFilterAll(filter)
  const existingIds = new Set(habits.map((h) => h.id))
  // Always strip IDs for habits that no longer exist (deleted habits leave orphan log entries)
  const validDayHabitIds = day.habitIds.filter((id) => existingIds.has(id))
  const habitIds = showAll
    ? validDayHabitIds
    : validDayHabitIds.filter((id) => filter.habitIds.includes(id))
  const showWorkout = showAll ? day.workoutNames.length > 0 : filter.workout && day.workoutNames.length > 0
  return { habitIds, showWorkout }
}

function Tooltip({
  day,
  habits,
  x,
  y,
  filter,
}: {
  day: DayData
  habits: Habit[]
  x: number
  y: number
  filter: LegendFilter
}) {
  const style: CSSProperties = {
    position: 'fixed', left: x + 12, top: y - 12, zIndex: 9999, pointerEvents: 'none',
  }

  const { habitIds, showWorkout } = resolveVisible(day, habits, filter)

  const visibleHabits = habitIds
    .map((hid) => habits.find((h) => h.id === hid))
    .filter((h): h is Habit => h !== undefined)

  const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const hasAnything = visibleHabits.length > 0 || showWorkout

  return (
    <div className="hm-tooltip" style={style}>
      <p className="hm-tooltip-date">{dateStr}</p>
      {visibleHabits.length > 0 && (
        <div className="hm-tooltip-section">
          <p className="hm-tooltip-label">Habits ({visibleHabits.length})</p>
          <div className="hm-tooltip-habits">
            {visibleHabits.map((h) => (
              <span
                key={h.id}
                className="hm-tooltip-tag"
                style={{ background: h.color + '22', borderColor: h.color + '55', color: h.color }}
              >
                <span className="hm-tooltip-dot" style={{ background: h.color }} />
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {showWorkout && (
        <div className="hm-tooltip-section">
          <p className="hm-tooltip-label">Workouts ({day.workoutNames.length})</p>
          <div className="hm-tooltip-workouts">
            {day.workoutNames.map((name, i) => (
              <span
                key={i}
                className="hm-tooltip-tag"
                style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)', color: '#22c55e' }}
              >
                🏋️ {name}
              </span>
            ))}
          </div>
        </div>
      )}
      {!hasAnything && (
        <p className="hm-tooltip-empty">No activity</p>
      )}
    </div>
  )
}

function CellContent({
  day,
  habits,
  filter,
}: {
  day: DayData
  habits: Habit[]
  filter: LegendFilter
}) {
  const { habitIds, showWorkout } = resolveVisible(day, habits, filter)

  // One color entry per individual activity — deleted habits already excluded by resolveVisible
  const colors: string[] = [
    ...habitIds.map((hid) => habits.find((h) => h.id === hid)!.color),
    ...(showWorkout ? day.workoutNames.map(() => 'var(--workout-color)') : []),
  ]

  const n = colors.length
  if (n === 0) return null
  if (n === 1) return <div style={{ backgroundColor: colors[0], width: '100%', height: '100%' }} />

  // n equal pizza slices — exactly one per activity, no clamping or modulo
  const step = 360 / n
  const gradient = colors
    .map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`)
    .join(', ')

  return (
    <div
      style={{
        backgroundImage: `conic-gradient(${gradient})`,
        width: '100%',
        height: '100%',
        borderRadius: 3,
      }}
    />
  )
}

export default function UnifiedHeatmap({ habits, logs, workouts }: Props) {
  const [hovered, setHovered] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [legendFilter, setLegendFilter] = useState<LegendFilter>(FILTER_ALL)

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

  /** Toggle a single habit in the multi-select filter. */
  const toggleHabit = useCallback((habitId: string) => {
    setLegendFilter((prev) => {
      const already = prev.habitIds.includes(habitId)
      const nextHabitIds = already
        ? prev.habitIds.filter((id) => id !== habitId)
        : [...prev.habitIds, habitId]
      return { habitIds: nextHabitIds, workout: prev.workout }
    })
  }, [])

  /** Toggle workout in the multi-select filter. */
  const toggleWorkout = useCallback(() => {
    setLegendFilter((prev) => ({ habitIds: prev.habitIds, workout: !prev.workout }))
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
            const label = labels.find((l) => l.col === col)
            return (
              <div
                key={`m${col}`}
                className="hm-month"
                style={{
                  gridRow: 1, gridColumn: col + 1,
                  textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text)',
                }}
              >
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
            const { habitIds, showWorkout } = resolveVisible(day, habits, legendFilter)
            const hasActivity = habitIds.length > 0 || showWorkout
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
                <CellContent day={day} habits={habits} filter={legendFilter} />
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="hm-legend-row" role="group" aria-label="Unified heatmap legend">
        {/* "All" resets the filter */}
        <button
          type="button"
          className="hm-legend-item hm-legend-button"
          onClick={() => setLegendFilter(FILTER_ALL)}
          aria-pressed={isFilterAll(legendFilter)}
        >
          <div className="hm-legend-dot" style={{ background: 'var(--border)' }} />
          <span>All</span>
        </button>

        {habits.slice(0, 5).map((h) => {
          const active = legendFilter.habitIds.includes(h.id)
          return (
            <button
              key={h.id}
              type="button"
              className={`hm-legend-item hm-legend-button ${active ? 'hm-legend-button-active' : ''}`}
              onClick={() => toggleHabit(h.id)}
              aria-pressed={active}
            >
              <div className="hm-legend-dot" style={{ background: h.color }} />
              <span>{h.name}</span>
            </button>
          )
        })}

        {(() => {
          const active = legendFilter.workout
          return (
            <button
              type="button"
              className={`hm-legend-item hm-legend-button ${active ? 'hm-legend-button-active' : ''}`}
              onClick={toggleWorkout}
              aria-pressed={active}
            >
              <div className="hm-legend-dot" style={{ background: 'var(--workout-color)' }} />
              <span>Workout</span>
            </button>
          )
        })()}
      </div>

      {hovered && (
        <Tooltip day={hovered} habits={habits} x={mousePos.x} y={mousePos.y} filter={legendFilter} />
      )}
    </div>
  )
}