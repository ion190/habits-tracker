// src/components/SyncBadge.tsx
import { useSyncStatus } from '../hooks/useSyncStatus'

const CONFIG = {
  synced:  { label: 'Synced',   dot: '#22c55e' },
  syncing: { label: 'Syncing…', dot: '#f59e0b' },
  offline: { label: 'Offline',  dot: '#6b7280' },
  error:   { label: 'Error',    dot: '#ef4444' },
}

export default function SyncBadge() {
  const { status, pending } = useSyncStatus()
  const cfg = CONFIG[status]

  return (
    <div className="sync-badge">
      <span className="sync-dot" style={{ background: cfg.dot }} />
      <span className="sync-label">
        {cfg.label}
        {pending > 0 && status !== 'synced' && ` (${pending} pending)`}
      </span>
    </div>
  )
}
