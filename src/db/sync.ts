// src/db/sync.ts
import {
  doc, setDoc, deleteDoc, collection,
  getDocs, writeBatch,
} from 'firebase/firestore'
import { firestore } from './firebase'
import { db, generateId } from './database'
import type { SyncQueueEntry, SyncOperation } from './database'
import type { Table } from 'dexie'

const dexieTables: Record<string, Table> = {
  habits:                 db.habits,
  habitLogs:              db.habitLogs,
  tasks:                  db.tasks,
  exercises:              db.exercises,
  workoutPlans:           db.workoutPlans,
  completedWorkouts:      db.completedWorkouts,
  completedWorkSessions:  db.completedWorkSessions,
  journalEntries:         db.journalEntries,
  calendarActivities:     db.calendarActivities,
}

type SyncStatus = 'synced' | 'offline' | 'syncing' | 'error'

// Firestore rejects fields with `undefined` values — remove them before writing
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  )
}

class SyncEngine {
  private uid: string | null = null
  private status: SyncStatus = 'offline'
  private listeners: Set<(s: SyncStatus) => void> = new Set()
  private _hydrated = false
  private _onlineHandler: (() => void) | null = null
  private _offlineHandler: (() => void) | null = null

  init(uid: string) {
    // Guard: don't re-initialize for same user (prevents duplicate event listeners)
    if (this.uid === uid) return
    this.uid = uid

    // Remove old listeners if reinitializing for a different user
    if (this._onlineHandler)  window.removeEventListener('online',  this._onlineHandler)
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler)

    this._onlineHandler = () => {
      this.setStatus('syncing')
      this.flushQueue().then(() => this.setStatus('synced'))
    }
    this._offlineHandler = () => this.setStatus('offline')

    window.addEventListener('online',  this._onlineHandler)
    window.addEventListener('offline', this._offlineHandler)

    this.setStatus(navigator.onLine ? 'synced' : 'offline')
  }

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

  async put(table: string, record: Record<string, unknown>): Promise<void> {
    await dexieTables[table].put(record)
    if (navigator.onLine && this.uid) {
      try {
        await setDoc(this.docRef(table, record.id as string), stripUndefined(record))
        return
      } catch (e) {
        console.warn(`[Sync] Firestore put failed for ${table}/${record.id}, queuing`, e)
      }
    }
    await this.enqueue('put', table, record.id as string, record)
  }

  async delete(table: string, id: string): Promise<void> {
    await dexieTables[table].delete(id)
    if (navigator.onLine && this.uid) {
      try {
        await deleteDoc(this.docRef(table, id))
        return
      } catch (e) {
        console.warn(`[Sync] Firestore delete failed for ${table}/${id}, queuing`, e)
      }
    }
    await this.enqueue('delete', table, id)
  }

  private async enqueue(operation: SyncOperation, table: string, recordId: string, data?: unknown) {
    const existing = await db.syncQueue
      .where('table').equals(table)
      .filter(e => e.recordId === recordId)
      .first()
    if (existing) await db.syncQueue.delete(existing.id)

    const entry: SyncQueueEntry = {
      id: generateId(), table, recordId, operation, data,
      createdAt: new Date().toISOString(), retries: 0,
    }
    await db.syncQueue.add(entry)
  }

  async flushQueue(): Promise<void> {
    if (!this.uid) return
    const entries = await db.syncQueue.orderBy('createdAt').toArray()
    if (entries.length === 0) return

    for (const chunk of chunkArray(entries, 490)) {
      const batch = writeBatch(firestore)
      for (const entry of chunk) {
        const ref = this.docRef(entry.table, entry.recordId)
        if (entry.operation === 'put' && entry.data)
          batch.set(ref, stripUndefined(entry.data as Record<string, unknown>))
        else if (entry.operation === 'delete') batch.delete(ref)
      }
      try {
        await batch.commit()
        await db.syncQueue.bulkDelete(chunk.map(e => e.id))
      } catch (e) {
        console.error('[Sync] Batch flush failed', e)
        for (const entry of chunk) {
          if (entry.retries >= 5) await db.syncQueue.delete(entry.id)
          else await db.syncQueue.update(entry.id, { retries: entry.retries + 1 })
        }
      }
    }
  }

  // Manual sync: flush queue and report status — callable from UI
  async manualFlush(): Promise<void> {
    if (!navigator.onLine) return
    if (!this.uid) return
    this.setStatus('syncing')
    try {
      await this.flushQueue()
      this.setStatus('synced')
    } catch (e) {
      console.error('[Sync] Manual flush failed', e)
      this.setStatus('error')
    }
  }

  async hydrate(): Promise<void> {
    if (!this.uid) return
    if (this._hydrated) return
    this._hydrated = true
    console.log('[Sync] Hydrating from Firestore…')
    for (const table of Object.keys(dexieTables)) {
      try {
        const snap    = await getDocs(collection(firestore, 'users', this.uid, table))
        const records = snap.docs.map(d => d.data())
        if (records.length > 0) {
          await dexieTables[table].bulkPut(records as never[])
        } else {
          console.log(`[Sync] No data found for ${table}`)
        }
      } catch (e) {
        console.warn(`[Sync] Skipping empty/missing collection ${table}:`, e)
      }
    }
    console.log('[Sync] Hydration complete')
    // Flush any offline queue after hydrating
    if (navigator.onLine) await this.flushQueue()
  }

  reset() {
    this.uid = null
    this._hydrated = false
    if (this._onlineHandler)  window.removeEventListener('online',  this._onlineHandler)
    if (this._offlineHandler) window.removeEventListener('offline', this._offlineHandler)
    this._onlineHandler  = null
    this._offlineHandler = null
    this.setStatus('offline')
  }

  private docRef(table: string, id: string) {
    if (!this.uid) throw new Error('SyncEngine not initialized')
    return doc(firestore, `users/${this.uid}/${table}/${id}`)
  }

  getPendingCount(): Promise<number> { return db.syncQueue.count() }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

export const sync = new SyncEngine()