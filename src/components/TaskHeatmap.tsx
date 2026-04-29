import { useMemo, useState, useCallback, type CSSProperties } from 'react'
import { toDateKey } from '../utils'
import type { Task } from '../db/database'

interface Props {
  tasks: Task[]
}

interface DayData {
  date: string
  count: number
  titles: string[]
}

/** Build a map of date -> DayData for the last 364 days */
function buildDayMap(tasks: Task[]): Map<string, DayData> {
  const map = new Map<string, DayData>()

  // Initialize last 364 days
  for (let i = 0; i < 364; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (363 - i))
    const key = toDateKey(d.toISOString())
    map.set(key, { date: key, count: 0, titles: [] })
  }

  // Fill completed tasks
  for (const task of tasks) {
    if (!task.completedAt) continue
    const key = toDateKey(task.completedAt)
    const entry = map.get(key)
    if (entry) {
      entry.count++
      entry.titles.push(task.title)
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

function getIntensityColor(count: number): string {
  if (count === 0) return 'var(--border)'
  if (count === 1) return 'rgba(170, 59, 255, 0.35)'
  if (count === 2) return 'rgba(170, 59, 255, 0.55)'
  if (count === 3) return 'rgba(170, 59, 255, 0.75)'
  return 'rgba(170, 59, 255, 0.95)'
}

function Tooltip({
  day,
  x,
  y,
  visible,
}: {
  day: DayData
  x: number
  y: number
  visible: boolean
}) {
  if (!visible) return null

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
      {day.count > 0 ? (
        <div className="hm-tooltip-section">
          <p className="hm-tooltip-label">Tasks completed ({day.count})</p>
          <div className="hm-tooltip-habits">
            {day.titles.slice(0, 5).map((title, i) => (
              <span key={i} className="hm-tooltip-tag" style={{ background: 'rgba(170, 59, 255, 0.12)', borderColor: 'rgba(170, 59, 255, 0.35)', color: 'var(--accent)' }}>
                {title}
              </span>
            ))}
            {day.titles.length > 5 && (
              <span className="hm-tooltip-tag" style={{ background: 'var(--border)', color: 'var(--text)' }}>
                +{day.titles.length - 5} more
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="hm-tooltip-empty">No tasks completed</p>
      )}
    </div>
  )
}

export default function TaskHeatmap({ tasks }: Props) {
  const [hovered, setHovered] = useState<DayData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [touchDay, setTouchDay] = useState<DayData | null>(null)

  const dayMap = useMemo(() => buildDayMap(tasks), [tasks])

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

  const completedTasks = tasks.filter(t => t.completedAt).length

  return (
    <div className="unified-heatmap" onMouseMove={handleMouseMove}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>
          {completedTasks} completed tasks
        </span>
      </div>

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
            return (
              <div
                key={d}
                className="hm-cell"
                style={{
                  background: getIntensityColor(day.count),
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleTouch(day)}
                role="button"
                tabIndex={0}
                aria-label={`${d}: ${day.count} tasks completed`}
              />
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
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: 'rgba(170, 59, 255, 0.35)' }} />
          <span>1</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: 'rgba(170, 59, 255, 0.55)' }} />
          <span>2</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: 'rgba(170, 59, 255, 0.75)' }} />
          <span>3</span>
        </div>
        <div className="hm-legend-item">
          <div className="hm-legend-dot" style={{ background: 'rgba(170, 59, 255, 0.95)' }} />
          <span>4+</span>
        </div>
      </div>

      {/* Hover tooltip (desktop) */}
      {hovered && (
        <Tooltip day={hovered} x={mousePos.x} y={mousePos.y} visible={!!hovered && !touchDay} />
      )}

      {/* Touch detail (mobile) */}
      {touchDay && (
        <div className="hm-touch-detail" onClick={() => setTouchDay(null)}>
          <div className="hm-touch-card" onClick={(e) => e.stopPropagation()}>
            <Tooltip day={touchDay} x={0} y={0} visible />
            <button className="hm-touch-close" onClick={() => setTouchDay(null)}>✕ Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

