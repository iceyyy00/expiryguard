import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatRupiah, formatTanggal, namaMetode } from '../helpers'
import { Modal, EmptyState } from '../components/ui'
import { Icon } from '../components/icons'

export default function Riwayat() {
  const transaksi = useLiveQuery(() => db.transaksi.toArray(), [])
  const [cari, setCari] = useState('')
  const [detail, setDetail] = useState(null)

  const rows = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return [...(transaksi || [])]
      .filter((t) => {
        if (!q) return true
        return (
          (t.nomor || '').toLowerCase().includes(q) ||
          (t.kasirNama || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))
  }, [transaksi, cari])

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Transaksi</div>
          <div className="page-sub">Riwayat seluruh transaksi penjualan</div>
        </div>
        <div className="page-actions">
          <div className="search">
            <Icon name="search" size={16} />
            <input className="inp" placeholder="Cari no. transaksi / kasir" value={cari} onChange={(e) => setCari(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Waktu</th>
                <th>Kasir</th>
                <th>Metode</th>
                <th className="right">Total</th>
                <th className="right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nomor}</td>
                  <td>{formatTanggal(t.tanggal, true)}</td>
                  <td>{t.kasirNama}</td>
                  <td>{namaMetode(t.metode)}</td>
                  <td className="right w-bold">{formatRupiah(t.totalAkhir)}</td>
                  <td className="right">
                    <button className="btn ghost sm" onClick={() => setDetail(t)}>Detail</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <EmptyState title="Belum ada transaksi" sub="Transaksi yang dilakukan kasir akan muncul di sini." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detail && <DetailTransaksi t={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DetailTransaksi({ t, onClose }) {
  const sum = (t.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0)
  return (
    <Modal title={`Detail ${t.nomor}`} onClose={onClose} wide foot={
      <button className="btn ghost" onClick={onClose}>Tutup</button>
    }>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="detail-line"><b>Waktu:</b> {formatTanggal(t.tanggal, true)}</div>
        <div className="detail-line"><b>Kasir:</b> {t.kasirNama}</div>
        <div className="detail-line"><b>Metode:</b> {namaMetode(t.metode)}</div>
        <div className="detail-line"><b>Jumlah Item:</b> {sum} pcs</div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Produk</th>
              <th className="right">Qty</th>
              <th className="right">Harga</th>
              <th className="right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {(t.items || []).map((i, idx) => (
              <tr key={idx}>
                <td>{i.nama || `Produk #${i.produkId}`}</td>
                <td className="right">{i.qty}</td>
                <td className="right">{formatRupiah(i.hargaJual)}</td>
                <td className="right">{formatRupiah((Number(i.qty) || 0) * (Number(i.hargaJual) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="detail-line"><b>Diskon:</b> {Number(t.diskon) || 0}%</div>
        <div className="detail-line right w-bold"><b>Total:</b> {formatRupiah(t.totalAkhir)}</div>
      </div>
    </Modal>
  )
}
