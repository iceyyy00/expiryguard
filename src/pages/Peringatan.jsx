import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatTanggal, hitungSisaHari } from '../helpers'
import { Pill, EmptyState } from '../components/ui'
import { useAlerts } from '../App'

export default function Peringatan({ settings }) {
  const { list } = useAlerts()
  const produk = useLiveQuery(() => db.produk.toArray(), [])

  const byId = useMemo(() => {
    const m = new Map()
    for (const p of produk || []) m.set(p.id, p)
    return m
  }, [produk])

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Kadaluarsa</div>
          <div className="page-sub">
            Batch yang mendekati atau sudah melewati tanggal kadaluarsa ({list.length} perlu perhatian)
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>No. Batch</th>
                <th>Tanggal Masuk</th>
                <th>Tanggal Kadaluarsa</th>
                <th>Sisa Hari</th>
                <th>Stok</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => {
                const p = byId.get(b.produkId)
                const sisa = hitungSisaHari(b.tanggalExp)
                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{p?.nama || `Produk #${b.produkId}`}</td>
                    <td>{b.noBatch || '-'}</td>
                    <td>{formatTanggal(b.tanggalMasuk)}</td>
                    <td>{formatTanggal(b.tanggalExp)}</td>
                    <td style={{ color: b.status.warna, fontWeight: 700 }}>
                      {sisa === null ? '-' : sisa < 0 ? `Lewat ${-sisa} hr` : `${sisa} hr`}
                    </td>
                    <td>{Number(b.stok) || 0}</td>
                    <td>
                      <Pill status={b.status} />
                    </td>
                  </tr>
                )
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <EmptyState title="Semua aman 🎉" sub="Tidak ada batch yang mendekati atau lewat kadaluarsa." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
