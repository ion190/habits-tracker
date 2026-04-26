// src/hooks/useSyncStatus.ts
import { useEffect, useState } from 'react'
import { sync } from '../db/sync'

type SyncStatus = 'synced' | 'offline' | 'syncing' | 'error'

export function useSyncStatus() {
  const [status,  setStatus]  = useState<SyncStatus>(sync.getStatus())
  const [pending, setPending] = useState(0)

  useEffect(() => {
    // Subscribe to status changes
    const unsub = sync.onStatus(s => {
      setStatus(s)
      // Refresh pending count whenever status changes
      sync.getPendingCount().then(setPending)
    })

    // Also poll pending count every 5s so it stays accurate
    const interval = setInterval(() => {
      sync.getPendingCount().then(setPending)
    }, 5000)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  return { status, pending }
}
