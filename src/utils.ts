/** Format seconds → '45m' or '1h 23m' */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/** ISO date string → 'YYYY-MM-DD' */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10)
}

/** Start of current ISO week (Monday) */
export function startOfWeek(): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1 // adjust so Mon=0
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Generate a simple unique id */
export function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Format date in 24h format with GMT+3 timezone */
export function formatDateGMT3(isoString: string, options?: { dateOnly?: boolean; timeOnly?: boolean }): string {
  const date = new Date(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo', // GMT+3
    ...(options?.timeOnly ? {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    } : options?.dateOnly ? {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    } : {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  })
  return formatter.format(date)
}

/** Format time only in 24h format with GMT+3 timezone */
export function formatTimeGMT3(isoString: string): string {
  return formatDateGMT3(isoString, { timeOnly: true })
}

/** Format date only with GMT+3 timezone */
export function formatDateOnlyGMT3(isoString: string): string {
  return formatDateGMT3(isoString, { dateOnly: true })
}