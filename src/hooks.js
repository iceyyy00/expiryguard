import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { getStatusExp, DEFAULT_SETTINGS } from './helpers'

export function useSettings() {
  const rows = useLiveQuery(() => db.pengaturan.toArray(), [])
  return useMemo(() => {
    const s = { ...DEFAULT_SETTINGS }
    for (const r of rows || []) s[r.key] = r.value
    return s
  }, [rows])
}

// Jumlah batch yang "perlu perhatian" (untuk lonceng & banner)
export function useAlerts() {
  const settings = useSettings()
  const batches = useLiveQuery(() => db.batch.toArray(), [])
  return useMemo(() => {
    const aktif = (batches || []).filter((b) => (Number(b.stok) || 0) > 0)
    const list = aktif
      .map((b) => ({ ...b, status: getStatusExp(b.tanggalExp, settings) }))
      .filter((b) => b.status.prioritas > 0)
      .sort((a, b) => b.status.prioritas - a.status.prioritas || (a.tanggalExp || '').localeCompare(b.tanggalExp || ''))
    return { list, count: list.length }
  }, [batches, settings])
}
