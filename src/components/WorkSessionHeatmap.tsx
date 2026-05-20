import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { CompletedWorkSession } from '../db/database'
import { toDateKey } from '../utils'
import type { CSSProperties } from 'react'

interface DayData {
  date:            string
  totalSessions:   number
  avgProductivity: number
  titles:          string[]
  colors:          string[]
}

interface Props {
  sessions: CompletedWorkSession[]
  daysBack: number
}

// ─── Color scale based on productivity % ─────────────────
// hm-ws-0  gray  — no sessions
// hm-ws-1  red   — 0–20 %
// hm-ws-2  orange— 21–50 %
// hm-ws-3  amber — 51–79 %
// hm-ws-4  green — 80–100 %
function getCls(day: DayData): string {
  if (day.totalSessions === 0) return 'hm-ws-0'
  const p = day.avgProductivity
  if (p <= 20)  return 'hm-ws-1'
  if (p <= 50)  return 'hm-ws-2'
  if (p <= 79)  return 'hm-ws-3'
  return 'hm-ws-4'
}

function Tooltip({ day, x, y }: { day: DayData; x: number; y: number }) {
  const style: CSSProperties = {
    position: 'fixed', left: x + 12, top: y - 12, zIndex: 9999, pointerEvents: 'none',
  }
  const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const pct = Math.round(day.avgProductivity)
  const pctColor = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#ef4444' : undefined

  return (
    <div className="hm-tooltip" style={style}>
      <p className="hm-tooltip-date">{dateStr}</p>
      {day.totalSessions > 0 ? (
        <>
          <p className="hm-tooltip-label">
            {day.totalSessions} session{day.totalSessions !== 1 ? 's' : ''} •{' '}
            <span style={{ color: pctColor, fontWeight: 600 }}>{pct}% productivity</span>
          </p>
          <div className="hm-tooltip-habits">
            {day.titles.slice(0, 3).map((title, i) => (
              <span key={i} className="hm-tooltip-tag" style={{
                backgroundColor: day.colors[i % day.colors.length] + '12',
                borderColor:     day.colors[i % day.colors.length] + '35',
                color:           day.colors[i % day.colors.length],
              }}>{title}</span>
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
  const [hovered,  setHovered]  = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(t)
  }, [])



  // Build array of date strings covering [earliest session | daysBack ago] → today
    const days = useMemo(() => {
    // Always generate last N days including today - simplest fix
    const arr: string[] = []
    const today = new Date(); today.setHours(23, 59, 59, 999)
    let cur = new Date(today)
    cur.setDate(cur.getDate() - daysBack + 1) // +1 to include today
    while (cur <= today) {
      arr.push(toDateKey(cur.toISOString()))
      cur.setDate(cur.getDate() + 1)
    }
    return arr
  }, [daysBack])

  // Build day-keyed map with aggregated session data
  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    const todayStr = toDateKey(new Date().toISOString())
    for (const d of days) map.set(d, { date: d, totalSessions: 0, avgProductivity: 0, titles: [], colors: [] })

    for (const s of sessions) {
      const key   = toDateKey(s.startedAt)
      const entry = map.get(key)
      const actual      = s.actualDurationSeconds ?? 0
      const productivity = s.productivityPct ?? 100
      if (entry && actual >= 0 && Number.isFinite(actual) && Number.isFinite(productivity)) {
        entry.totalSessions++
        entry.titles.push(s.categoryName)
        entry.colors.push(s.categoryColor)
        // Running average
        entry.avgProductivity = (entry.avgProductivity * (entry.totalSessions - 1) + productivity) / entry.totalSessions
      }
    }

    return map
  }, [days, sessions])

  // Grid layout
  const firstDayOfWeek = new Date(days[0]).getDay()
  const pad      = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
  const totalCols = Math.ceil((pad + days.length) / 7)

  const labels = useMemo(() => {
    const arr: Array<{ month: string; col: number }> = []
    let cur = -1
    days.forEach((d, i) => {
      const m = new Date(d + 'T00:00:00').getMonth()
      if (m !== cur) {
        cur = m
        const abs = pad + i
        const col = abs % 7 === 0 ? Math.floor(abs / 7) : Math.floor(abs / 7) + 1
        arr.push({ month: new Date(d + 'T00:00:00').toLocaleString('en-US', { month: 'short' }), col })
      }
    })
    return arr
  }, [days, pad])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div className="workout-heatmap" style={{ marginTop: 16 }} onMouseMove={handleMouseMove}>
      <div className="hm-scroll" ref={scrollRef}>
        <div className="hm-grid" style={{
          gridTemplateColumns: `repeat(${totalCols}, 14px)`,
          gridTemplateRows:    'auto repeat(7, 14px)',
          gridAutoFlow:        'unset',
        }}>
          {/* Month labels */}
          {Array.from({ length: totalCols }).map((_, col) => {
            const lbl = labels.find(l => l.col === col)
            return (
              <div key={`m${col}`} className="hm-month" style={{
                gridRow: 1, gridColumn: col + 1,
                textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)',
              }}>
                {lbl?.month ?? ''}
              </div>
            )
          })}

          {/* Padding cells */}
          {Array(pad).fill(null).map((_, i) => (
            <div key={`p${i}`} className="hm-cell hm-empty" style={{ gridRow: i + 2, gridColumn: 1 }} />
          ))}

          {/* Day cells */}
          {days.map((d, i) => {
            const day = dayMap.get(d)!
            const col = Math.floor((pad + i) / 7) + 1
            const row = ((pad + i) % 7) + 2
            return (
              <div
                key={d}
                data-date={d}
                className={`hm-cell ${getCls(day)}`}
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
                aria-label={`${d}: ${day.totalSessions} sessions, ${Math.round(day.avgProductivity)}% productivity`}
              />
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="hm-legend-row">
        <div className="hm-legend-item"><div className="hm-legend-dot hm-ws-0" /><span>None</span></div>
        <div className="hm-legend-item"><div className="hm-legend-dot hm-ws-1" /><span>≤20%</span></div>
        <div className="hm-legend-item"><div className="hm-legend-dot hm-ws-2" /><span>21–50%</span></div>
        <div className="hm-legend-item"><div className="hm-legend-dot hm-ws-3" /><span>51–79%</span></div>
        <div className="hm-legend-item"><div className="hm-legend-dot hm-ws-4" /><span>80%+</span></div>
      </div>

      {hovered && <Tooltip day={hovered} x={mousePos.x} y={mousePos.y} />}
    </div>
  )
}