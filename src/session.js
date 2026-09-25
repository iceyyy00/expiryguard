import { useSyncExternalStore } from 'react'

// ============================================================
// Sesi login sederhana (disimpan di localStorage).
// Di produksi, ganti dengan token/JWT dari backend.
// ============================================================

const KEY = 'eg_session'
let user = null
const listeners = new Set()

try {
  const raw = localStorage.getItem(KEY)
  if (raw) user = JSON.parse(raw)
} catch {
  user = null
}

function emit() {
  for (const cb of listeners) cb()
}

export const sessionStore = {
  getUser: () => user,
  setUser: (u) => {
    user = { ...u, password: undefined }
    localStorage.setItem(KEY, JSON.stringify(user))
    emit()
  },
  clear: () => {
    user = null
    localStorage.removeItem(KEY)
    emit()
  },
  subscribe: (cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getUser)
}