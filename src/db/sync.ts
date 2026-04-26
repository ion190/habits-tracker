// src/db/sync.ts
import {
  doc, setDoc, deleteDoc, collection,
  getDocs, writeBatch,
} from 'firebase/firestore'
import { firestore } from './firebase'
import { db, generateId } from './database'
import type { SyncQueueEntry, SyncOperation } from './database'
import type { Table } from 'dexie'

// Map table names → Dexie table objects
const dexieTables: Record<string, Table> = {
  habits:            db.habits,
  habitLogs:         db.habitLogs,
  tasks:             db.tasks,
  exercises:         db.exercises,
  workoutPlans:      db.workoutPlans,
  completedWorkouts: db.completedWorkouts,
}

type SyncStatus = 'synced' | 'offline' | 'syncing' | 'error'

class SyncEngine {
  private uid: string | null = null
  private status: SyncStatus = 'offline'
  private listeners: Set<(s: SyncStatus) => void> = new Set()
  private hydrated = false

  // ── Init ────────────────────────────────────────────────

  init(uid: string) {
    this.uid = uid
    this.setStatus(navigator.onLine ? 'synced' : 'offline')

    window.addEventListener('online', () => {
      this.setStatus('syncing')
      this.flushQueue().then(() => this.setStatus('synced'))
    })

    window.addEventListener('offline', () => {
      this.setStatus('offline')
    })

    if (navigator.onLine && !this.hydrated) {
      this.hydrate()
    }
  }

  // ── Status observable ────────────────────────────────────

  onStatus(cb: (s: SyncStatus) => void) {
    this.listeners.add(cb)
    cb(this.status)
    return () => this.listeners.delete(cb)
  }

  private setStatus(s: SyncStatus) {
    this.status = s
    this.listeners.forEach(cb => cb(s))
  }

  getStatus(): SyncStatus { return this.status }

  // ── Write ────────────────────────────────────────────────

  async put(table: string, record: Record<string, unknown>): Promise<void> {
    // 1. Always write locally first — instant and offline-safe
    await dexieTables[table].put(record)

    // 2. Try Firestore if online
    if (navigator.onLine && this.uid) {
      try {
        await setDoc(this.docRef(table, record.id as string), record)
        return
      } catch (e) {
        console.warn(`[Sync] Firestore put failed for ${table}/${record.id}, queuing`, e)
      }
    }

    // 3. Queue for later
    await this.enqueue('put', table, record.id as string, record)
  }

  async delete(table: string, id: string): Promise<void> {
    // 1. Delete locally
    await dexieTables[table].delete(id)

    // 2. Try Firestore
    if (navigator.onLine && this.uid) {
      try {
        await deleteDoc(this.docRef(table, id))
        return
      } catch (e) {
        console.warn(`[Sync] Firestore delete failed for ${table}/${id}, queuing`, e)
      }
    }

    // 3. Queue
    await this.enqueue('delete', table, id)
  }

  // ── Queue ────────────────────────────────────────────────

  private async enqueue(
    operation: SyncOperation,
    table: string,
    recordId: string,
    data?: unknown
  ) {
    // Replace any existing pending entry for this record
    const existing = await db.syncQueue
      .where('table').equals(table)
      .filter(e => e.recordId === recordId)
      .first()
    if (existing) await db.syncQueue.delete(existing.id)

    const entry: SyncQueueEntry = {
      id:        generateId(),
      table,
      recordId,
      operation,
      data,
      createdAt: new Date().toISOString(),
      retries:   0,
    }
    await db.syncQueue.add(entry)
  }

  async flushQueue(): Promise<void> {
    if (!this.uid) return
    const entries = await db.syncQueue.orderBy('createdAt').toArray()
    if (entries.length === 0) return

    console.log(`[Sync] Flushing ${entries.length} queued operations…`)

    const chunks = chunkArray(entries, 490)
    for (const chunk of chunks) {
      const batch = writeBatch(firestore)
      for (const entry of chunk) {
        const ref = this.docRef(entry.table, entry.recordId)
        if (entry.operation === 'put' && entry.data) {
          batch.set(ref, entry.data as Record<string, unknown>)
        } else if (entry.operation === 'delete') {
          batch.delete(ref)
        }
      }
      try {
        await batch.commit()
        await db.syncQueue.bulkDelete(chunk.map(e => e.id))
      } catch (e) {
        console.error('[Sync] Batch flush failed', e)
        for (const entry of chunk) {
          if (entry.retries >= 5) {
            await db.syncQueue.delete(entry.id)
          } else {
            await db.syncQueue.update(entry.id, { retries: entry.retries + 1 })
          }
        }
      }
    }
  }

  // ── Hydrate Firestore → Dexie ────────────────────────────

  async hydrate(): Promise<void> {
    if (!this.uid) return
    this.hydrated = true
    console.log('[Sync] Hydrating from Firestore…')

    for (const table of Object.keys(dexieTables)) {
      try {
        const snap    = await getDocs(collection(firestore, 'users', this.uid, table))
        const records = snap.docs.map(d => d.data())
        if (records.length > 0) {
          await dexieTables[table].bulkPut(records as never[])
        }
      } catch (e) {
        console.warn(`[Sync] Could not hydrate ${table}:`, e)
      }
    }
    console.log('[Sync] Hydration complete')
  }

  // ── Helpers ──────────────────────────────────────────────

  private docRef(table: string, id: string) {
    if (!this.uid) throw new Error('SyncEngine not initialized')
    return doc(firestore, 'users', this.uid, table, id)
  }

  getPendingCount(): Promise<number> {
    return db.syncQueue.count()
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

export const sync = new SyncEngine()