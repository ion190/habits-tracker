import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db, generateId, dateKeyForPeriod, labelForDateKey } from '../db/database'
import type { JournalEntry, JournalPeriod } from '../db/database'
import { sync } from '../db/sync'
import JournalMiniCalendar from './JournalMiniCalendar'

const PERIODS: { value: JournalPeriod; label: string; icon: string; desc: string }[] = [
  { value: 'daily',     label: 'Daily',     icon: '📅', desc: "Today's reflections" },
  { value: 'weekly',    label: 'Weekly',    icon: '📆', desc: "This week's summary" },
  { value: 'monthly',   label: 'Monthly',   icon: '🗓️', desc: 'Monthly reflection' },
  { value: 'quarterly', label: 'Quarterly', icon: '📊', desc: 'Quarterly review' },
  { value: 'yearly',    label: 'Yearly',    icon: '📖', desc: 'Year in review' },
  { value: 'decadely',  label: 'Decadely',  icon: '📜', desc: 'Decade reflection' },
]

const MOODS = ['', '😫', '😕', '😐', '😊', '🤩']
const MOOD_LABELS = ['', 'Terrible', 'Bad', 'Neutral', 'Good', 'Amazing']

function prevKey(period: JournalPeriod, dateKey: string): string {
  switch (period) {
    case 'daily': {
      const d = new Date(dateKey + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      return dateKeyForPeriod('daily', d)
    }
    case 'weekly': {
      const [y, w] = dateKey.split('-W').map(Number)
      return dateKeyForPeriod('weekly', new Date(y, 0, 1 + (w - 2) * 7))
    }
    case 'monthly': {
      const [y, m] = dateKey.split('-').map(Number)
      return dateKeyForPeriod('monthly', new Date(y, m - 2, 1))
    }
    case 'quarterly': {
      const [y, q] = dateKey.split('-Q').map(Number)
      return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`
    }
    case 'yearly':    return String(+dateKey - 1)
    case 'decadely':  return `${+dateKey.replace('s', '') - 10}s`
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
      return dateKeyForPeriod('weekly', new Date(y, 0, 1 + w * 7))
    }
    case 'monthly': {
      const [y, m] = dateKey.split('-').map(Number)
      return dateKeyForPeriod('monthly', new Date(y, m, 1))
    }
    case 'quarterly': {
      const [y, q] = dateKey.split('-Q').map(Number)
      return q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`
    }
    case 'yearly':    return String(+dateKey + 1)
    case 'decadely':  return `${+dateKey.replace('s', '') + 10}s`
  }
}

function isFuture(period: JournalPeriod, dateKey: string): boolean {
  return dateKey > dateKeyForPeriod(period)
}

function getPrompts(period: JournalPeriod): string[] {
  const map: Record<JournalPeriod, string[]> = {
    daily: [
      'What am I grateful for today?',
      "What's one thing I want to accomplish?",
      'How am I feeling right now?',
      "What's on my mind?",
      'What would make today great?',
      'What did I learn today?',
      'What challenged me today?',
    ],
    weekly: [
      'What were my wins this week?',
      'What did I struggle with?',
      'What am I proud of?',
      'What should I do differently next week?',
      'What drained my energy this week?',
      'What gave me energy this week?',
    ],
    monthly: [
      'What were the highlights of this month?',
      'Did I make progress on my goals?',
      'What did I learn this month?',
      'What do I want to focus on next month?',
      'What habits am I building?',
      'What relationships did I nurture?',
    ],
    quarterly: [
      'How am I progressing toward my yearly goals?',
      'What major changes happened this quarter?',
      "What habits stuck? Which ones didn't?",
      'What should I stop, start, or continue?',
      'What surprised me this quarter?',
    ],
    yearly: [
      'What were the defining moments of this year?',
      'Who did I become this year?',
      'What am I most proud of achieving?',
      'What do I want next year to look like?',
      'What relationships changed this year?',
      'What would I do differently?',
    ],
    decadely: [
      'How have I changed over this decade?',
      'What were the most important decisions I made?',
      'What wisdom would I share with my past self?',
      'What legacy am I building?',
      'Who were the most influential people in my life?',
    ],
  }
  return map[period]
}

function getTemplate(period: JournalPeriod): string {
  const sections: Record<JournalPeriod, string[]> = {
    daily:     ['## Notes', '## Learnings', '## Gratitude'],
    weekly:    ['Look back on all the diary I wrote for that week. See my mistakes. Make a restart of the mind', '## Goals for This Week', '## This week\'s main topics', '## Wins', '## Challenges', '## Reflections', '## Next Week'],
    monthly:   ['## Monthly Goals', '## Highlights', '## What I Learned', '## Habits & Progress', "## Next Month's Focus"],
    quarterly: ['## Quarterly Goals', '## Progress Review', '## What Worked', "## What Didn't", '## Next Quarter Focus'],
    yearly:    ['## Year Theme', '## Major Achievements', '## Lessons Learned', '## Personal Growth', '## Goals for Next Year'],
    decadely:  ['## Decade Theme', '## Defining Moments', '## Who I Became', '## Wisdom Gained', '## Vision for Next Decade'],
  }
  return sections[period].map(s => `${s}\n`).join('\n\n')
}

export default function JournalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [period, setPeriod] = useState<JournalPeriod>(
    (searchParams.get('period') as JournalPeriod) || 'daily'
  )
  const [dateKey, setDateKey] = useState(
    searchParams.get('key') || dateKeyForPeriod('daily')
  )
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [allKeys, setAllKeys] = useState<string[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [promptsExpanded, setPromptsExpanded] = useState(true)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to textarea so we can insert text at cursor position
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // True when the textarea shows the auto-inserted template but user hasn't typed yet.
  // We display it as real content so they can see the structure, but skip auto-saving
  // until they actually write something.
  const isTemplateOnlyRef = useRef(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 800)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadAllKeys = useCallback(async (p: JournalPeriod) => {
    const entries = await db.journalEntries.where('period').equals(p).toArray()
    const keys = entries.map(e => e.dateKey).sort((a, b) => b.localeCompare(a))
    setAllKeys(keys)
  }, [])

  const loadEntry = useCallback(async (p: JournalPeriod, key: string) => {
    const existing =
      await db.journalEntries.where('[period+dateKey]').equals([p, key]).first() ??
      await db.journalEntries.filter(e => e.period === p && e.dateKey === key).first()

    if (existing) {
      setEntry(existing)
      setContent(existing.content)
      setTitle(existing.title ?? '')
      setMood(existing.mood ?? 0)
      isTemplateOnlyRef.current = false
    } else {
      setEntry(null)
      setContent(getTemplate(p))
      setTitle('')
      setMood(0)
      isTemplateOnlyRef.current = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await Promise.all([loadEntry(period, dateKey), loadAllKeys(period)])
      if (cancelled) return
      setSearchParams({ period, key: dateKey }, { replace: true })
    })()
    return () => { cancelled = true }
  }, [period, dateKey, loadEntry, loadAllKeys, setSearchParams])

  const autoSave = useCallback(async (c: string, t: string, m: number) => {
    if (isTemplateOnlyRef.current) return   // don't persist untouched template
    if (!c.trim() && !t.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    const updated: JournalEntry = entry
      ? { ...entry, content: c, title: t || undefined, mood: m || undefined, updatedAt: now }
      : { id: generateId(), period, dateKey, content: c, title: t || undefined, mood: m || undefined, createdAt: now, updatedAt: now }
    await sync.put('journalEntries', updated as unknown as Record<string, unknown>)
    setEntry(updated)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    loadAllKeys(period)
    window.dispatchEvent(new CustomEvent('journalUpdated'))
  }, [entry, period, dateKey, loadAllKeys])

  const handleChange = (c: string) => {
    isTemplateOnlyRef.current = false   // user has started editing — allow saving now
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

  // Insert a prompt question at the current cursor position in the textarea.
  // If cursor isn't inside textarea, appends to end. Always focuses the textarea after.
  const insertPrompt = useCallback((prompt: string) => {
    const textarea = textareaRef.current
    const text = `${prompt}\n\n`

    if (!textarea) {
      const next = content ? `${content}\n\n${text}` : text
      handleChange(next)
      return
    }

    const start = textarea.selectionStart ?? content.length
    const end = textarea.selectionEnd ?? content.length
    const before = content.slice(0, start)
    const after = content.slice(end)

    // Add a blank line separator if needed
    const prefix = before.length > 0 && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
    const next = before + prefix + text + after

    handleChange(next)

    // Restore focus and move cursor to just after the inserted text
    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = before.length + prefix.length + text.length
      textarea.setSelectionRange(newPos, newPos)
    })
  }, [content, handleChange])

  const handleDelete = async () => {
    if (!entry || !window.confirm('Delete this journal entry?')) return
    await sync.delete('journalEntries', entry.id)
    setEntry(null); setContent(''); setTitle(''); setMood(0)
    loadAllKeys(period)
    window.dispatchEvent(new CustomEvent('journalUpdated'))
  }

  const goTo = (key: string) => setDateKey(key)
  const goToCurrent = () => setDateKey(dateKeyForPeriod(period))

  const currentKey = dateKeyForPeriod(period)
  const isToday = dateKey === currentKey
  const isFutureKey = isFuture(period, dateKey)

  const prompts = useMemo(() => getPrompts(period), [period])

  // Ghost placeholder text: show all prompts for current period when textarea is empty
  const placeholderLines = useMemo(() => {
    if (content.trim()) return null
    return prompts.slice(0, 4).map((p, i) => `${i === 0 ? '✦ ' : '  '}${p}`)
  }, [content, prompts])

  return (
    <div
      className="page"
      style={{
        display: 'flex',
        gap: 24,
        maxWidth: 1200,
        padding: '24px 24px 48px',
        flexDirection: isMobile ? 'column' : 'row',
      }}
    >
      {/* ── Main editor ── */}
      <div style={{ flex: 1, minWidth: 0 }}>

        {/* Navigation header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => goTo(prevKey(period, dateKey))}>←</button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{labelForDateKey(period, dateKey)}</h1>
            {isToday && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>• current period</span>}
          </div>

          <button
            className="btn btn-ghost"
            style={{ padding: '6px 10px' }}
            onClick={() => goTo(nextKey(period, dateKey))}
            disabled={isFuture(period, nextKey(period, dateKey))}
          >→</button>

          {!isToday && (
            <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={goToCurrent}>
              Jump to current
            </button>
          )}

          <span style={{ fontSize: 12, opacity: 0.6, minWidth: 60, textAlign: 'right' }}>
            {saving ? '⏳ Saving…' : saved ? '✓ Saved' : entry ? '✓ Saved' : ''}
          </span>
        </div>

        {/* Future warning */}
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
            borderRadius: 10, color: 'var(--text-h)', fontSize: 17, fontWeight: 600,
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Mood */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Mood:</span>
          {[1, 2, 3, 4, 5].map(m => (
            <button
              key={m}
              onClick={() => handleMoodChange(mood === m ? 0 : m)}
              title={MOOD_LABELS[m]}
              style={{
                fontSize: 22, border: 'none', background: 'transparent', cursor: 'pointer',
                opacity: mood === m ? 1 : 0.35,
                transform: mood === m ? 'scale(1.25)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            >
              {MOODS[m]}
            </button>
          ))}
          {mood > 0 && <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{MOOD_LABELS[mood]}</span>}
        </div>

        {/* Textarea with ghost overlay */}
        <div style={{ position: 'relative' }}>
          {/* Ghost placeholder — stays visible while entry is empty */}
          {placeholderLines && (
            <div
              style={{
                position: 'absolute',
                top: isMobile ? 14 : 16,
                left: isMobile ? 14 : 16,
                right: isMobile ? 14 : 16,
                pointerEvents: 'none',
                color: 'var(--text-h)',
                opacity: 0.3,
                fontSize: isMobile ? 14 : 15,
                lineHeight: 1.9,
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Prompts for {period} reflection
              </span>
              {'\n\n'}
              {placeholderLines.join('\n')}
              {prompts.length > 4 && `\n  + ${prompts.length - 4} more below ↓`}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            style={{
              width: '100%',
              minHeight: isMobile ? 420 : 520,
              padding: isMobile ? '14px' : '16px',
              background: 'var(--code-bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text-h)',
              fontSize: isMobile ? 15 : 16,
              lineHeight: 1.7,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              whiteSpace: 'pre-wrap',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent-border)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Word count + delete */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 12, opacity: 0.5 }}>
            {content.trim() ? `${content.trim().split(/\s+/).length} words` : 'Start writing…'}
          </span>
          {entry && (
            <button className="btn btn-ghost" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={handleDelete}>
              🗑 Delete entry
            </button>
          )}
        </div>

        {/* ── Prompt panel — always visible, collapsible ── */}
        <div
          style={{
            background: 'var(--code-bg)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* Panel header */}
          <button
            onClick={() => setPromptsExpanded(v => !v)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}>✦</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Prompts</span>
              <span
                style={{
                  fontSize: 11,
                  opacity: 0.55,
                  background: 'var(--border)',
                  borderRadius: 99,
                  padding: '1px 7px',
                }}
              >
                click any to insert at cursor
              </span>
            </div>
            <span style={{ fontSize: 12, opacity: 0.5 }}>{promptsExpanded ? '▲' : '▼'}</span>
          </button>

          {/* Prompt chips */}
          {promptsExpanded && (
            <div style={{ padding: '0 14px 14px', display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {prompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => insertPrompt(prompt)}
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-bg)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
                  }}
                >
                  + {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar: period tabs + calendar + history ── */}
      <div style={{ width: isMobile ? '100%' : 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Journal</h2>

        {/* Calendar */}
        <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 700, letterSpacing: '0.4px' }}>Journal calendar</div>
          <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>
            {new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div style={{ marginTop: 8 }}>
            <JournalMiniCalendar
              period={period}
              dateKey={dateKey}
              allKeys={allKeys}
              onPick={(pickedDate: string) => {
                if (period === 'daily') setDateKey(pickedDate)
                else setDateKey(dateKeyForPeriod(period, new Date(pickedDate + 'T00:00:00')))
              }}
            />
          </div>
        </div>

        {/* Period tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => { setPeriod(p.value); setDateKey(dateKeyForPeriod(p.value)) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8, border: 'none',
                background: period === p.value ? 'var(--accent-bg)' : 'transparent',
                color: period === p.value ? 'var(--accent)' : 'var(--text)',
                cursor: 'pointer',
                fontWeight: period === p.value ? 600 : 400,
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
          <>
            {isMobile ? (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'space-between', padding: '10px 12px' }}
                  onClick={() => setShowHistory(v => !v)}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>History ({allKeys.length})</span>
                  <span style={{ opacity: 0.6 }}>{showHistory ? '▲' : '▼'}</span>
                </button>
                {showHistory && (
                  <div style={{ marginTop: 10, background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                      {allKeys.map(key => (
                        <button
                          key={key}
                          onClick={() => { goTo(key); setShowHistory(false) }}
                          style={{
                            padding: '8px 10px', borderRadius: 10, border: 'none', textAlign: 'left',
                            background: key === dateKey ? 'var(--accent-bg)' : 'transparent',
                            color: key === dateKey ? 'var(--accent)' : 'var(--text)',
                            fontSize: 12, cursor: 'pointer', fontWeight: key === dateKey ? 700 : 500,
                          }}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
          </>
        )}
      </div>
    </div>
  )
}