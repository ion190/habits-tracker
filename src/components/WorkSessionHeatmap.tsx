import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CompletedWorkSession } from '../db/database'
import { toDateKey } from '../utils'
import type { CSSProperties } from 'react'

interface DayData {
  date: string
  totalSessions: number
  avgProductivity: number
  titles: string[]
  colors: string[]
}

interface Props {
  sessions: CompletedWorkSession[]
  daysBack: number
}

function getCls(avgPct: number): string {
  if (avgPct === 0) return 'hm-0'
  if (avgPct < 50) return 'hm-1'
  if (avgPct < 80) return 'hm-3'
  return 'hm-4'
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
      {day.totalSessions > 0 ? (
        <>
          <p className="hm-tooltip-label">
            {day.totalSessions} session{day.totalSessions !== 1 ? 's' : ''} • {Math.round(day.avgProductivity)}% avg
          </p>
          <div className="hm-tooltip-habits">
            {day.titles.slice(0, 3).map((title, i) => (
              <span 
                key={i} 
                className="hm-tooltip-tag" 
                style={{ 
                  backgroundColor: day.colors[i % day.colors.length] + '12',
                  borderColor: day.colors[i % day.colors.length] + '35',
                  color: day.colors[i % day.colors.length]
                }}
              >
                {title}
              </span>
            ))}
            {day.titles.length > 3 && (
              <span className="hm-tooltip-tag" style={{ background: 'var(--border)', color: 'var(--text)' }}>
                +{day.titles.length - 3} more
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="hm-tooltip-empty">No sessions</p>
      )}
    </div>
  )
}

export default function WorkSessionHeatmap({ sessions, daysBack }: Props) {
  const [hovered, setHovered] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

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
    let earliestDate: Date
    if (sessions.length === 0) {
      earliestDate = new Date()
      earliestDate.setDate(earliestDate.getDate() - daysBack)
    } else {
      earliestDate = new Date(Math.min(...sessions.map(s => new Date(s.startedAt).getTime())))
      const daysAgo = Math.floor((Date.now() - earliestDate.getTime()) / (24 * 60 * 60 * 1000))
      if (daysAgo > daysBack) {
        earliestDate = new Date()
        earliestDate.setDate(earliestDate.getDate() - daysBack)
      }
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
  }, [sessions, daysBack])

  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const dayKey of days) {
      map.set(dayKey, { date: dayKey, totalSessions: 0, avgProductivity: 0, titles: [], colors: [] })
    }

for (const session of sessions) {
      const key = toDateKey(session.startedAt)
      const entry = map.get(key)
      // Only filter out obviously bad data (NaN, Infinity) - allow 0 duration sessions
      const actual = session.actualDurationSeconds ?? 0
      const productivity = session.productivityPct ?? 100
      if (entry && actual >= 0 && Number.isFinite(actual) && Number.isFinite(productivity)) {
        entry.totalSessions++
        entry.titles.push(session.categoryName)
        entry.colors.push(session.categoryColor)
        entry.avgProductivity = (entry.avgProductivity * (entry.totalSessions - 1) + productivity) / entry.totalSessions
      }
    }

    return map
  }, [days, sessions])

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
    <div className="workout-heatmap" style={{ marginTop: 16 }} onMouseMove={handleMouseMove}>
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
                className={`hm-cell ${getCls(day.avgProductivity)}`}
                style={{ 
                  gridRow: row, 
                  gridColumn: col,
                  cursor: 'pointer',
                  borderRadius: 3
                }}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                role="button"
                tabIndex={0}
                aria-label={`${d}: ${day.totalSessions} sessions, ${Math.round(day.avgProductivity)}% avg`}
              />
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="hm-legend-row">
        <div className="hm-legend-item">
          <div className="hm-legend-dot hm-0" />
          <span>No sessions</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot hm-1" />
          <span>50%</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot hm-3" />
          <span>50-79%</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot hm-4" />
          <span>80+%</span>
        </div>
      </div>

      {/* Tooltip */}
      {hovered && <Tooltip day={hovered} x={mousePos.x} y={mousePos.y} />}
    </div>
  )
}

