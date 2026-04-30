import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { toDateKey } from '../utils'
import type { Task } from '../db/database'

interface DayData {
  date: string
  count: number
  titles: string[]
}

function Tooltip({ day, x, y }: { day: DayData; x: number; y: number }) {
  const style: CSSProperties = {
    position: 'fixed', left: x + 12, top: y - 12, zIndex: 9999, pointerEvents: 'none',
  }
  const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return (
    <div className="hm-tooltip" style={style}>
      <p className="hm-tooltip-date">{dateStr}</p>
      {day.count > 0 ? (
        <>
          <p className="hm-tooltip-label">Tasks completed ({day.count})</p>
          <div className="hm-tooltip-habits">
            {day.titles.slice(0, 5).map((title, i) => (
              <span key={i} className="hm-tooltip-tag" style={{
                background: 'rgba(170, 59, 255, 0.12)',
                borderColor: 'rgba(170, 59, 255, 0.35)',
                color: 'var(--accent)',
              }}>{title}</span>
            ))}
            {day.titles.length > 5 && (
              <span className="hm-tooltip-tag" style={{ background: 'var(--border)', color: 'var(--text)' }}>
                +{day.titles.length - 5} more
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="hm-tooltip-empty">No tasks completed</p>
      )}
    </div>
  )
}

function getCls(count: number): string {
  if (count === 0) return 'hm-task-0'
  if (count === 1) return 'hm-task-1'
  if (count === 2) return 'hm-task-2'
  if (count === 3) return 'hm-task-3'
  return 'hm-task-4'
}

export default function TaskHeatmap({ tasks }: { tasks: Task[] }) {
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

  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>()
    for (const key of days) map.set(key, { date: key, count: 0, titles: [] })
    
    // Only completed tasks contribute to heatmap
    const completedTasks = tasks.filter(task => !!task.completedAt)
    for (const task of completedTasks) {
      const key = toDateKey(task.completedAt!)
      const entry = map.get(key)
      if (entry) { 
        entry.count++; 
        entry.titles.push(task.title) 
      }
    }
    return map
  }, [days, tasks])

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

  const completedCount = tasks.filter(t => t.completedAt).length

  console.log('📊 TaskHeatmap data:', { 
    totalTasks: tasks.length,
    completedCount,
    daysWithCompletions: Array.from(dayMap.values()).filter(d => d.count > 0).length
  })

  return (
    <div className="unified-heatmap" style={{ marginTop: 16 }} onMouseMove={handleMouseMove}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text)' }}>{completedCount} completed tasks</span>
      </div>

      <div className="hm-scroll" ref={scrollRef}>
        <div
          className="hm-grid"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, 14px)`,
            gridTemplateRows: 'auto repeat(7, 14px)',
            gridAutoFlow: 'unset',
          }}
        >
          {Array.from({ length: totalCols }).map((_, col) => {
            const label = labels.find(l => l.col === col)
            return (
              <div key={`m${col}`} className="hm-month" style={{
                gridRow: 1, gridColumn: col + 1,
                textAlign: 'left', whiteSpace: 'nowrap', fontSize: 11, color: 'var(--text-muted)',
              }}>
                {label?.month ?? ''}
              </div>
            )
          })}

          {Array(pad).fill(null).map((_, i) => (
            <div key={`p${i}`} className="hm-cell hm-empty" style={{ gridRow: i + 2, gridColumn: 1 }} />
          ))}

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
                aria-label={`${d}: ${day.count} tasks`}
              />
            )
          })}
        </div>
      </div>

      <div className="hm-legend-row">
        {[['None', 'hm-task-0'], ['1', 'hm-task-1'], ['2', 'hm-task-2'], ['3', 'hm-task-3'], ['4+', 'hm-task-4']].map(([label, cls]) => (
          <div key={cls} className="hm-legend-item">
            <div className={`hm-legend-dot ${cls}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {hovered && <Tooltip day={hovered} x={mousePos.x} y={mousePos.y} />}
    </div>
  )
}