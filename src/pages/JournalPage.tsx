import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db, generateId, dateKeyForPeriod, labelForDateKey } from '../db/database'
import type { JournalEntry, JournalPeriod } from '../db/database'
import { sync } from '../db/sync'

const PERIODS: { value: JournalPeriod; label: string; icon: string; desc: string }[] = [
  { value: 'daily',     label: 'Daily',     icon: '📅', desc: 'Today\'s reflections' },
  { value: 'weekly',    label: 'Weekly',    icon: '📆', desc: 'This week\'s summary' },
  { value: 'monthly',   label: 'Monthly',   icon: '🗓️', desc: 'Monthly reflection' },
  { value: 'quarterly', label: 'Quarterly', icon: '📊', desc: 'Quarterly review' },
  { value: 'yearly',    label: 'Yearly',    icon: '📖', desc: 'Year in review' },
  { value: 'decadely',  label: 'Decadely',  icon: '📜', desc: 'Decade reflection' },
]

const MOODS = ['', '😫', '😕', '😐', '😊', '🤩']
const MOOD_LABELS = ['', 'Terrible', 'Bad', 'Neutral', 'Good', 'Amazing']

// Navigate backward/forward through period keys
function prevKey(period: JournalPeriod, dateKey: string): string {
  switch (period) {
    case 'daily': {
      const d = new Date(dateKey + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      return dateKeyForPeriod('daily', d)
    }
    case 'weekly': {
      const [y, w] = dateKey.split('-W').map(Number)
      const d = new Date(y, 0, 1 + (w - 2) * 7)
      return dateKeyForPeriod('weekly', d)
    }
    case 'monthly': {
      const [y, m] = dateKey.split('-').map(Number)
      return dateKeyForPeriod('monthly', new Date(y, m - 2, 1))
    }
    case 'quarterly': {
      const [y, q] = dateKey.split('-Q').map(Number)
      if (q === 1) return `${y - 1}-Q4`
      return `${y}-Q${q - 1}`
    }
    case 'yearly':   return String(+dateKey - 1)
    case 'decadely': return `${+dateKey.replace('s','') - 10}s`
  }
}

function nextKey(period: JournalPeriod, dateKey: string): string {
  switch (period) {
    case 'daily': {
      const d = new Date(dateKey + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      return dateKeyForPeriod('daily', d)
    }
    case 'weekly': {
      const [y, w] = dateKey.split('-W').map(Number)
      const d = new Date(y, 0, 1 + w * 7)
      return dateKeyForPeriod('weekly', d)
    }
    case 'monthly': {
      const [y, m] = dateKey.split('-').map(Number)
      return dateKeyForPeriod('monthly', new Date(y, m, 1))
    }
    case 'quarterly': {
      const [y, q] = dateKey.split('-Q').map(Number)
      if (q === 4) return `${y + 1}-Q1`
      return `${y}-Q${q + 1}`
    }
    case 'yearly':   return String(+dateKey + 1)
    case 'decadely': return `${+dateKey.replace('s','') + 10}s`
  }
}

function isFuture(period: JournalPeriod, dateKey: string): boolean {
  const now = dateKeyForPeriod(period)
  return dateKey > now
}

export default function JournalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [period,   setPeriod]   = useState<JournalPeriod>(
    (searchParams.get('period') as JournalPeriod) || 'daily'
  )
  const [dateKey,  setDateKey]  = useState(
    searchParams.get('key') || dateKeyForPeriod('daily')
  )
  const [entry,    setEntry]    = useState<JournalEntry | null>(null)
  const [content,  setContent]  = useState('')
  const [title,    setTitle]    = useState('')
  const [mood,     setMood]     = useState<number>(0)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [allKeys,  setAllKeys]  = useState<string[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load all keys for this period (for the sidebar list)
  const loadAllKeys = useCallback(async (p: JournalPeriod) => {
    const entries = await db.journalEntries
      .where('period').equals(p).toArray()
    const keys = entries.map(e => e.dateKey).sort((a, b) => b.localeCompare(a))
    setAllKeys(keys)
  }, [])

  // Load entry for current period+dateKey
  const loadEntry = useCallback(async (p: JournalPeriod, key: string) => {
    const existing = await db.journalEntries
      .where('[period+dateKey]').equals([p, key]).first()
      ?? await db.journalEntries.filter(e => e.period === p && e.dateKey === key).first()
    if (existing) {
      setEntry(existing)
      setContent(existing.content)
      setTitle(existing.title ?? '')
      setMood(existing.mood ?? 0)
    } else {
      setEntry(null)
      setContent('')
      setTitle('')
      setMood(0)
    }
  }, [])

  useEffect(() => {
    loadEntry(period, dateKey)
    loadAllKeys(period)
    setSearchParams({ period, key: dateKey }, { replace: true })
  }, [period, dateKey, loadEntry, loadAllKeys, setSearchParams])

  // Auto-save with debounce
  const autoSave = useCallback(async (c: string, t: string, m: number) => {
    if (!c.trim() && !t.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    const updated: JournalEntry = entry
      ? { ...entry, content: c, title: t || undefined, mood: m || undefined, updatedAt: now }
      : {
          id: generateId(), period, dateKey,
          content: c, title: t || undefined, mood: m || undefined,
          createdAt: now, updatedAt: now,
        }
    await sync.put('journalEntries', updated as unknown as Record<string, unknown>)
    setEntry(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadAllKeys(period)
    window.dispatchEvent(new CustomEvent('journalUpdated'))
  }, [entry, period, dateKey, loadAllKeys])

  const handleChange = (c: string) => {
    setContent(c)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => autoSave(c, title, mood), 1200)
  }

  const handleTitleChange = (t: string) => {
    setTitle(t)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => autoSave(content, t, mood), 1200)
  }

  const handleMoodChange = (m: number) => {
    setMood(m)
    if (content.trim() || title.trim()) autoSave(content, title, m)
  }

  const handleDelete = async () => {
    if (!entry) return
    if (!window.confirm('Delete this journal entry?')) return
    await sync.delete('journalEntries', entry.id)
    setEntry(null); setContent(''); setTitle(''); setMood(0)
    loadAllKeys(period)
    window.dispatchEvent(new CustomEvent('journalUpdated'))
  }

  const goTo = (key: string) => setDateKey(key)
  const goToCurrent = () => setDateKey(dateKeyForPeriod(period))

  const currentKey  = dateKeyForPeriod(period)
  const isToday     = dateKey === currentKey
  const isFutureKey = isFuture(period, dateKey)

  return (
    <div className="page" style={{ display: 'flex', gap: 24, maxWidth: 1200, padding: '24px 24px 48px' }}>

      {/* Left: period + history list */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Journal</h2>

        {/* Period tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => {
                setPeriod(p.value)
                setDateKey(dateKeyForPeriod(p.value))
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8, border: 'none',
                background: period === p.value ? 'var(--accent-bg)' : 'transparent',
                color: period === p.value ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer', fontWeight: period === p.value ? 600 : 400,
                fontSize: 13, textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{p.icon}</span>
              <div>
                <div>{p.label}</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>{p.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* History list */}
        {allKeys.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.6px', opacity: 0.5, margin: '0 0 6px' }}>
              {allKeys.length} entr{allKeys.length !== 1 ? 'ies' : 'y'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 400, overflowY: 'auto' }}>
              {allKeys.map(key => (
                <button
                  key={key}
                  onClick={() => goTo(key)}
                  style={{
                    padding: '5px 8px', borderRadius: 6, border: 'none', textAlign: 'left',
                    background: key === dateKey ? 'var(--accent-bg)' : 'transparent',
                    color: key === dateKey ? 'var(--accent)' : 'var(--text)',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main editor */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Navigation header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }}
            onClick={() => goTo(prevKey(period, dateKey))}>←</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
              {labelForDateKey(period, dateKey)}
            </h1>
            {isToday && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>• current period</span>}
          </div>

          <button className="btn btn-ghost" style={{ padding: '6px 10px' }}
            onClick={() => goTo(nextKey(period, dateKey))}
            disabled={isFuture(period, nextKey(period, dateKey))}>→</button>

          {!isToday && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={goToCurrent}>
              Jump to current
            </button>
          )}

          {/* Save indicator */}
          <span style={{ fontSize: 12, opacity: 0.6, minWidth: 60, textAlign: 'right' }}>
            {saving ? '⏳ Saving…' : saved ? '✓ Saved' : entry ? '✓ Saved' : ''}
          </span>
        </div>

        {/* Warning for future entries */}
        {isFutureKey && (
          <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>
            ⚠️ You're writing a future entry. That's fine — plan ahead!
          </div>
        )}

        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Entry title (optional)"
          style={{
            width: '100%', marginBottom: 12, padding: '10px 14px',
            background: 'var(--code-bg)', border: '1px solid var(--border)',
            borderRadius: 10, color: 'var(--text-h)', fontSize: 17,
            fontWeight: 600, outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Mood */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Mood:</span>
          {[1, 2, 3, 4, 5].map(m => (
            <button
              key={m}
              onClick={() => handleMoodChange(mood === m ? 0 : m)}
              title={MOOD_LABELS[m]}
              style={{
                fontSize: 22, border: 'none', background: 'transparent',
                cursor: 'pointer', opacity: mood === m ? 1 : 0.35,
                transform: mood === m ? 'scale(1.25)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            >
              {MOODS[m]}
            </button>
          ))}
          {mood > 0 && (
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              {MOOD_LABELS[mood]}
            </span>
          )}
        </div>

        {/* Content editor */}
        <textarea
          value={content}
          onChange={e => handleChange(e.target.value)}
          placeholder={`Write your ${period} reflection here…\n\nMarkdown-style text is fine. Your thoughts are auto-saved.`}
          style={{
            width: '100%', minHeight: 420, padding: '16px',
            background: 'var(--code-bg)', border: '1px solid var(--border)',
            borderRadius: 10, color: 'var(--text-h)', fontSize: 15,
            lineHeight: 1.7, resize: 'vertical', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent-border)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />

        {/* Word count + delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 12, opacity: 0.5 }}>
            {content.trim() ? `${content.trim().split(/\s+/).length} words` : 'Start writing…'}
          </span>
          {entry && (
            <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }}
              onClick={handleDelete}>
              🗑 Delete entry
            </button>
          )}
        </div>

        {/* Prompt suggestions for empty entries */}
        {!content.trim() && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 12 }}>Writing prompts:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {getPrompts(period).map((prompt, i) => (
                <button
                  key={i}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '6px 12px', textAlign: 'left' }}
                  onClick={() => handleChange(prompt + '\n\n')}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getPrompts(period: JournalPeriod): string[] {
  const map: Record<JournalPeriod, string[]> = {
    daily: [
      'What am I grateful for today?',
      'What\'s one thing I want to accomplish?',
      'How am I feeling right now?',
      'What\'s on my mind?',
    ],
    weekly: [
      'What were my wins this week?',
      'What did I struggle with?',
      'What am I proud of?',
      'What should I do differently next week?',
    ],
    monthly: [
      'What were the highlights of this month?',
      'Did I make progress on my goals?',
      'What did I learn this month?',
      'What do I want to focus on next month?',
    ],
    quarterly: [
      'How am I progressing toward my yearly goals?',
      'What major changes happened this quarter?',
      'What habits stuck? Which ones didn\'t?',
      'What should I stop, start, or continue?',
    ],
    yearly: [
      'What were the defining moments of this year?',
      'Who did I become this year?',
      'What am I most proud of achieving?',
      'What do I want next year to look like?',
    ],
    decadely: [
      'How have I changed over this decade?',
      'What were the most important decisions I made?',
      'What wisdom would I share with my past self?',
      'What legacy am I building?',
    ],
  }
  return map[period]
}
