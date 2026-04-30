import { useMemo, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { toDateKey } from '../utils'

interface DayData {
  date: string
  // Custom data per implementation
}

interface GridHeatmapProps<T extends DayData> {
  daysBack?: number
  getDayData: (days: string[]) => Map<string, T>
  renderCell: (day: T, date: string, props: { row: number; col: number }) => ReactNode
  renderTooltip?: (day: T, position: { x: number; y: number }) => ReactNode
  renderLegend?: () => ReactNode
  className?: string
}

export default function GridHeatmap<T extends DayData>({
  daysBack = 364,
  getDayData,
  renderCell,
  renderTooltip,
  renderLegend,
  className = '',
}: GridHeatmapProps<T>) {
  const [hovered, setHovered] = useState<T | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [touchDay, setTouchDay] = useState<T | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    const arr: string[] = []
    for (let i = 0; i < daysBack; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (daysBack - 1 - i))
      arr.push(toDateKey(d.toISOString()))
    }
    return arr
  }, [daysBack])

  // Scroll to today
  useEffect(() => {
    if (!scrollRef.current || days.length === 0) return
    
    const todayStr = toDateKey(new Date().toISOString())
    const todayCell = scrollRef.current.querySelector(`[data-date="${todayStr}"]`) as HTMLElement | null
    if (todayCell) {
      const rect = scrollRef.current.getBoundingClientRect()
      const cellRect = todayCell.getBoundingClientRect()
      const scrollLeft = Math.max(0, todayCell.offsetLeft - rect.width + cellRect.width + 20)
      scrollRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  }, [days])

  const dayMap = useMemo(() => getDayData(days), [days, getDayData])

  const firstDayOfWeek = new Date(days[0]).getDay() // 0=Sun, 1=Mon...6=Sat
  const pad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Monday-first padding
  const totalCells = pad + days.length
  const totalCols = Math.ceil(totalCells / 7)

  const monthLabels = useMemo(() => {
    const labels: Array<{ month: string; col: number }> = []
    let currentMonth = -1
    days.forEach((d, i) => {
      const date = new Date(d + 'T00:00:00')
      const m = date.getMonth()
      if (m !== currentMonth) {
        currentMonth = m
        const absPos = pad + i
        const col = Math.floor(absPos / 7) + 1
        labels.push({ month: date.toLocaleString('en-US', { month: 'short' }), col })
      }
    })
    return labels
  }, [days, pad])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleTouch = useCallback((day: T) => {
    setTouchDay((prev) => (prev?.date === day.date ? null : day))
  }, [])

  return (
    <div className={`unified-heatmap ${className}`} onMouseMove={handleMouseMove}>
      {/* Month labels (row 1) */}
      <div className="hm-months">
        {Array.from({ length: totalCols }, (_, col) => {
          const label = monthLabels.find((l) => l.col === col + 1)
          return (
            <div key={col} className="hm-month">
              {label?.month ?? ''}
            </div>
          )
        })}
      </div>

      <div className="hm-scroll" ref={scrollRef}>
        <div
          className="hm-grid"
          style={{
            gridTemplateColumns: `repeat(${totalCols}, 14px)`,
            gridTemplateRows: 'repeat(8, 14px)', // row1=months (hidden), rows2-8=week days
            gridAutoFlow: 'unset',
          }}
        >
          {/* Padding cells (top-left) */}
          {Array(pad).fill(null).map((_, i) => (
            <div
              key={`pad-${i}`}
              className="hm-cell hm-empty"
              style={{ gridRow: 2 + i, gridColumn: 1 }}
              aria-hidden="true"
            />
          ))}

          {/* Day cells */}
          {days.map((date, i) => {
            const day = dayMap.get(date)!
            const absPos = pad + i
            const col = Math.floor(absPos / 7) + 1
            const row = (absPos % 7) + 2
            return (
              <div
                key={date}
                data-date={date}
                className="hm-cell"
                style={{ gridRow: row, gridColumn: col }}
                onMouseEnter={() => setHovered(day)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleTouch(day)}
                role="button"
                tabIndex={0}
                aria-label={`${date}: activity`}
              >
                {renderCell(day, date, { row, col })}
              </div>
            )
          })}
        </div>
      </div>

      {renderLegend && renderLegend()}

      {/* Desktop tooltip */}
      {renderTooltip && hovered && (
        renderTooltip(hovered, mousePos)
      )}

      {/* Mobile touch overlay */}
      {touchDay && renderTooltip && (
        <div className="hm-touch-detail" onClick={() => setTouchDay(null)}>
          <div className="hm-touch-card" onClick={(e) => e.stopPropagation()}>
            {renderTooltip(touchDay, { x: 0, y: 0 })}
            <button className="hm-touch-close" onClick={() => setTouchDay(null)}>
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

