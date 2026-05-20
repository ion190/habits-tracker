import React, { useMemo, useState } from 'react'
import { dateKeyForPeriod } from '../db/database'
import type { JournalPeriod } from '../db/database'

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseISODateKey(dayISO: string) {
  return new Date(dayISO + 'T00:00:00')
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function startOfWeekMon(date: Date) {
  // ISO week: Monday start
  const d = new Date(date)
  const day = d.getDay() // 0 Sun
  const offset = (day + 6) % 7
  d.setDate(d.getDate() - offset)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfWeekSun(date: Date) {
  const d = startOfWeekMon(date)
  d.setDate(d.getDate() + 6)
  return d
}

function getRangeForKey(period: JournalPeriod, key: string): { start: Date; end: Date } | null {
  const y = (s: string) => parseInt(s, 10)

  if (period === 'daily') {
    const start = parseISODateKey(key)
    return { start, end: start }
  }

  if (period === 'weekly') {
    // YYYY-Www where ww is ISO week number
    const [yearStr, weekStr] = key.split('-W')
    const year = y(yearStr)
    const week = y(weekStr)
    // Find Monday of ISO week 1
    const jan4 = new Date(year, 0, 4)
    const startWeek1 = startOfWeekMon(jan4)
    const start = addDays(startWeek1, (week - 1) * 7)
    const end = endOfWeekSun(start)
    return { start, end }
  }

  if (period === 'monthly') {
    const [yearStr, monthStr] = key.split('-')
    const year = y(yearStr)
    const month = y(monthStr) // 1-12
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }

  if (period === 'quarterly') {
    const [yearStr, qStr] = key.split('-Q')
    const year = y(yearStr)
    const q = y(qStr) // 1-4
    const monthStart = (q - 1) * 3
    const start = new Date(year, monthStart, 1)
    const endMonth = monthStart + 2
    const end = new Date(year, endMonth + 1, 0)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }

  if (period === 'yearly') {
    const year = y(key)
    const start = new Date(year, 0, 1)
    const end = new Date(year, 11, 31)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }

  if (period === 'decadely') {
    // e.g. 2020s
    const decadeYear = parseInt(key.replace('s', ''), 10)
    const start = new Date(decadeYear, 0, 1)
    const end = new Date(decadeYear + 9, 11, 31)
    start.setHours(0, 0, 0, 0)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }

  return null
}

function rangeContainsDay(start: Date, end: Date, dayISO: string) {
  const d = parseISODateKey(dayISO)
  return d >= start && d <= end
}

function computeDotSet(period: JournalPeriod, keys: string[], monthISO: string) {
  // Only compute dots for visible month days.
  const [yStr, mStr] = monthISO.split('-')
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)
  const daysInMonth = new Date(year, month, 0).getDate()


  const dotDays = new Set<string>()

  const ranges = keys
    .map((k) => getRangeForKey(period, k))
    .filter((r): r is NonNullable<typeof r> => !!r)

  for (let i = 1; i <= daysInMonth; i++) {
    const dayISO = toDateKey(new Date(year, month - 1, i))
    for (const r of ranges) {
      if (rangeContainsDay(r.start, r.end, dayISO)) {
        dotDays.add(dayISO)
        break
      }
    }
  }

  return dotDays
}

export default function JournalMiniCalendar({
  period,
  dateKey,
  allKeys,
  onPick,
}: {
  period: JournalPeriod
  dateKey: string
  allKeys: string[]
  onPick: (pickedDate: string) => void // pickedDate is always YYYY-MM-DD
}) {
  const [viewDate, setViewDate] = useState(() => {
    if (period === 'daily') return parseISODateKey(dateKey)
    // For non-daily, map dateKey to a representative date for month view.
    if (period === 'monthly') {
      const [y, m] = dateKey.split('-').map(Number)
      return new Date(y, m - 1, 1)
    }
    if (period === 'weekly') {
      const [yStr, wStr] = dateKey.split('-W')
      const y = parseInt(yStr, 10)
      const w = parseInt(wStr, 10)
      const jan4 = new Date(y, 0, 4)
      const startWeek1 = startOfWeekMon(jan4)
      return addDays(startWeek1, (w - 1) * 7)
    }
    if (period === 'quarterly') {
      const [yStr, qStr] = dateKey.split('-Q')
      const y = parseInt(yStr, 10)
      const q = parseInt(qStr, 10)
      const month = (q - 1) * 3
      return new Date(y, month, 1)
    }
    if (period === 'yearly') {
      const y = parseInt(dateKey, 10)
      return new Date(y, 0, 1)
    }
    // decadely: "2020s"
    const decade = parseInt(dateKey.replace('s', ''), 10)
    return new Date(decade, 0, 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth() // 0-11
  const monthISO = `${year}-${String(month + 1).padStart(2, '0')}`

  const dotDays = useMemo(() => {
    return computeDotSet(period, allKeys, monthISO)
  }, [period, allKeys, monthISO])

  const selectedDayISO = useMemo(() => {
    if (period === 'daily') return dateKey
    // Pick a representative selected day for highlighting.
    const dKey = dateKeyForPeriod(period, viewDate)
    if (dKey !== dateKey) {
      // fallback: use today's mapped day
      return toDateKey(viewDate)
    }
    return toDateKey(viewDate)
  }, [period, dateKey, viewDate])

  const todayISO = toDateKey(new Date())

  const firstDay = new Date(year, month, 1).getDay() // 0 Sun
  const pad = firstDay === 0 ? 6 : firstDay - 1 // Monday-first grid
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  return (
    <div style={{ userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <button
          className="btn btn-ghost"
          style={{ padding: '2px 8px', fontSize: 13 }}
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
          {viewDate.toLocaleString('en-US', { month: 'short', year: 'numeric' })}
        </span>
        <button
          className="btn btn-ghost"
          style={{ padding: '2px 8px', fontSize: 13 }}
          onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        >
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div key={d} style={{ fontSize: 10, opacity: 0.5, padding: '2px 0', fontWeight: 700 }}>
            {d}
          </div>
        ))}
        {Array(pad)
          .fill(null)
          .map((_, i) => (
            <div key={`p${i}`} />
          ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1
          const dayISO = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isToday = dayISO === todayISO
          const hasDot = dotDays.has(dayISO)

          // highlight selected day only for daily; for other periods, highlight based on mapping.
          const isSel = period === 'daily' ? dayISO === selectedDayISO : dateKeyForPeriod(period, parseISODateKey(dayISO)) === dateKey

          return (
            <div
              key={dayISO}
              onClick={() => onPick(dayISO)}
              style={{
                padding: '4px 2px',
                borderRadius: 6,
                fontSize: 12,
                background: isSel ? 'var(--accent)' : isToday ? 'var(--accent-bg)' : 'transparent',
                color: isSel ? '#fff' : isToday ? 'var(--accent)' : 'var(--text)',
                fontWeight: isSel ? 800 : isToday ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title={hasDot ? 'Journal written' : undefined}
            >
              <div>{day}</div>
              <div style={{ height: 10, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
                {hasDot && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: isSel ? '#fff' : 'var(--accent)',
                      marginTop: 2,
                      display: 'inline-block',
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

