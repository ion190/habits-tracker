import { useEffect } from 'react';

/**
 * useEnterSave - React hook to call a callback when Enter is pressed in an input or textarea.
 * @param onSave - function to call when Enter is pressed
 * @param enabled - set to false to disable (default true)
 */
export function useEnterSave(onSave: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    function handler(e: KeyboardEvent) {
      // Only trigger for Enter, not Shift+Enter (for textarea newlines)
      if (e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey || e.metaKey)) {
        // Only fire if the target is an input or textarea
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          e.preventDefault();
          onSave();
        }
      }
    }
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onSave, enabled]);
}
