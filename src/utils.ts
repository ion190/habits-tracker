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

/** Convert day index from Sunday-first (0=Sun) to Monday-first (0=Mon) */
export function sundayFirstToMondayFirst(sundayFirstIndex: number): number {
  return sundayFirstIndex === 0 ? 6 : sundayFirstIndex - 1
}

/** Convert day index from Monday-first (0=Mon) to Sunday-first (0=Sun) */
export function mondayFirstToSundayFirst(mondayFirstIndex: number): number {
  return mondayFirstIndex === 6 ? 0 : mondayFirstIndex + 1
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

/** Theme management */
export type Theme = 'light' | 'dark' | 'auto'

export function getTheme(): Theme {
  return (localStorage.getItem('theme') ?? 'auto') as Theme
}

export function setTheme(theme: Theme): void {
  localStorage.setItem('theme', theme)
  applyTheme(theme)
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement
  
  if (theme === 'auto') {
    html.style.colorScheme = ''
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.classList.add('light')
      html.classList.remove('dark')
    }
  } else if (theme === 'dark') {
    html.classList.add('dark')
    html.classList.remove('light')
    html.style.colorScheme = 'dark'
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
    html.style.colorScheme = 'light'
  }
}

export function initializeTheme(): void {
  applyTheme(getTheme())
  
  // Listen for system theme changes when in auto mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'auto') {
      applyTheme('auto')
    }
  })
}