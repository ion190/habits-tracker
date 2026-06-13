import { useEffect } from 'react'

/**
 * useEnterSave - calls onSave when user presses Enter while focused on an input/textarea.
 *
 * - Only triggers for Enter key (no Shift/Ctrl/Alt/Meta).
 * - Prevents default form submission/newline behavior.
 */
export function useEnterSave(onSave: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function handler(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return

      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return

      e.preventDefault()
      onSave()
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [onSave, enabled])
}

