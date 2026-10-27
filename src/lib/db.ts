import type { Note } from '@/types'

// IndexedDB is only used for large/loose content (note bodies).
// Task & tool collections are small and live in localStorage.
const DB_NAME = 'kiln'
const DB_VERSION = 1
const STORE = 'notes'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const request = fn(t.objectStore(STORE))
        t.oncomplete = () => {
          db.close()
          resolve(request.result as T)
        }
        t.onerror = () => {
          db.close()
          reject(t.error)
        }
      }),
  )
}

export const notesDb = {
  all: () => run<Note[]>('readonly', (s) => s.getAll()),
  put: (note: Note) => run<undefined>('readwrite', (s) => s.put(note)),
  del: (id: string) => run<undefined>('readwrite', (s) => s.delete(id)),
}
