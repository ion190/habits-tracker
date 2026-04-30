import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CompletedWorkout } from '../db/database'
import { toDateKey } from '../utils'
import type { CSSProperties } from 'react'

interface DayData {
  date: string
  count: number
  titles: string[]
}

interface Props {
  workouts: CompletedWorkout[]
  daysBack: number
}

function getCls(count: number): string {
  if (count === 0) return 'hm-0'
  if (count === 1) return 'hm-4'
  return 'hm-4' // 2+ also full intensity
}

function Tooltip({ day, x, y }: {
  day: DayData
  x: number
  y: number
}) {
  const style: CSSProperties = {
    position: 'fixed',
    left: x + 12,
    top: y - 12,
    zIndex: 9999,
    pointerEvents: 'none',
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
      {day.count > 0 ? (
        <>
          <p className="hm-tooltip-label">Workouts completed ({day.count})</p>
          <div className="hm-tooltip-habits">
            {day.titles.slice(0, 5).map((title: string, i: number) => (
              <span key={i} className="hm-tooltip-tag" style={{ 
                background: 'rgba(253, 174, 38, 0.05)', 
                borderColor: 'rgba(253, 174, 38, 0.5)', 
                color: 'var(--workout-color)' 
              }}>
                {title}
              </span>
            ))}
            {day.titles.length > 5 && (
              <span className="hm-tooltip-tag" style={{ background: 'var(--border)', color: 'var(--text)' }}>
                +{day.titles.length - 5} more
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="hm-tooltip-empty">No workouts</p>
      )}
    </div>
  )
}

export default function WorkoutHeatmap({ workouts, daysBack }: Props) {
  const [hovered, setHovered] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to today/right side after mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollTo({
        left: scrollRef.current.scrollWidth,
        behavior: 'smooth'
      })
    }, 100)
    return () => clearTimeout(timeout)
  }, [])

  const days = useMemo(() => {
    // Find earliest workout date, default to 365 days back if no workouts
    let earliestDate: Date
    if (workouts.length === 0) {
      earliestDate = new Date()
      earliestDate.setDate(earliestDate.getDate() - 365)
    } else {
      earliestDate = new Date(Math.min(...workouts.map(w => new Date(w.startedAt).getTime())))
    }

    const arr: string[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const current = new Date(earliestDate)
    current.setHours(0, 0, 0, 0)
    
    while (arr.length < daysBack && current <= today) {
      arr.push(toDateKey(current.toISOString()))
      current.setDate(current.getDate() + 1)
    }
    return arr
  }, [workouts, daysBack])

  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const dayKey of days) {
      map.set(dayKey, { date: dayKey, count: 0, titles: [] })
    }
    for (const workout of workouts) {
      const key = toDateKey(workout.startedAt)
      const entry = map.get(key)
      if (entry) {
        entry.count++
        entry.titles.push(workout.workoutPlanName)
      }
    }
    return map
  }, [days, workouts])

  const firstDayOfWeek = new Date(days[0]).getDay()
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const totalCols = Math.ceil((pad + days.length) / 7)

  const labels = useMemo(() => {
const labelArr: Array<{ month: string; col: number }> = []
    let currentMonth = -1
    days.forEach((d, i) => {
      const date = new Date(d + 'T00:00:00')
      const m = date.getMonth()
      if (m !== currentMonth) {
        currentMonth = m
        const absPos = pad + i
        const col = (absPos % 7 === 0) ? Math.floor(absPos / 7) : Math.floor(absPos / 7) + 1
        labelArr.push({ month: date.toLocaleString('en-US', { month: 'short' }), col })
      }
    })
    return labelArr
  }, [days, pad])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div className="unified-heatmap" style={{ marginTop: 16 }} onMouseMove={handleMouseMove}>
      <div className="hm-scroll" ref={scrollRef}>
        <div
          className="hm-grid"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, 14px)`,
            gridTemplateRows: 'auto repeat(7, 14px)',
            gridAutoFlow: 'unset',
          }}
        >
          {/* Row 0: month labels */}
          {Array.from({ length: totalCols }).map((_, col) => {
            const label = labels.find((l) => l.col === col)
            return (
              <div
                key={`m${col}`}
                className="hm-month"
                style={{
                  gridRow: 1,
                  gridColumn: col + 1,
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                {label?.month ?? ''}
              </div>
            )
          })}

          {/* Padding cells */}
          {Array(pad).fill(null).map((_, i) => (
            <div
              key={`p${i}`}
              className="hm-cell hm-empty"
              style={{ gridRow: i + 2, gridColumn: 1 }}
            />
          ))}

          {/* Day cells */}
          {days.map((d, i) => {
            const day = dayMap.get(d)!
            const col = Math.floor((pad + i) / 7) + 1
            const row = ((pad + i) % 7) + 2
            return (
              <div
                key={d}
                className={`hm-cell ${getCls(day.count)}`}
                style={{ borderRadius: 3, cursor: 'pointer', gridRow: row, gridColumn: col }}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                role="button"
                tabIndex={0}
                aria-label={`${d}: ${day.count} workouts`}
              />
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="hm-legend-row">
        <div className="hm-legend-item">
          <div className="hm-legend-dot hm-0" />
          <span>None</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot hm-4" />
          <span>1+</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <Tooltip day={hovered} x={mousePos.x} y={mousePos.y} />
      )}
    </div>
  )
}
