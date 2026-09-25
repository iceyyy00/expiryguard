import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatTanggal, tanggalLokal, hariIniISO, totalStok } from '../helpers'
import { Pill, Modal, EmptyState } from '../components/ui'
import { Icon } from '../components/icons'

export default function Stok({ settings }) {
  const produk = useLiveQuery(() => db.produk.toArray(), [])
  const batches = useLiveQuery(() => db.batch.toArray(), [])
  const [cari, setCari] = useState('')
  const [showTambah, setShowTambah] = useState(false)

  const rows = useMemo(() => {
    const byProduk = new Map()
    for (const b of batches || []) {
      if (!byProduk.has(b.produkId)) byProduk.set(b.produkId, [])
      byProduk.get(b.produkId).push(b)
    }
    return (produk || [])
      .filter((p) => p.aktif)
      .map((p) => ({ produk: p, batch: byProduk.get(p.id) || [], total: totalStok(byProduk.get(p.id)) }))
      .filter((r) => {
        const q = cari.trim().toLowerCase()
        if (!q) return true
        return (
          (r.produk.nama || '').toLowerCase().includes(q) ||
          (r.produk.sku || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.produk.nama.localeCompare(b.produk.nama))
  }, [produk, batches, cari])

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Stok</div>
          <div className="page-sub">Total stok per produk beserta rincian batch (FEFO)</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setShowTambah(true)}>
            <Icon name="plus" size={16} /> Tambah Batch
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produk</th>
                <th className="right">Total Stok</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.produk.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.produk.nama}</div>
                    <div style={{ color: 'var(--text-light)', fontSize: 12 }}>{r.produk.sku || '-'}</div>
                  </td>
                  <td className="right w-bold">{r.total}</td>
                  <td>
                    {r.batch.map((b) => (
                      <span key={b.id} className="pill muted" style={{ marginRight: 6, marginBottom: 4, display: 'inline-flex', alignItems: 'center' }}>
                        {b.noBatch || `#${b.id}`} · {Number(b.stok) || 0} pcs · exp {formatTanggal(b.tanggalExp)}
                      </span>
                    ))}
                    {r.batch.length === 0 && <span style={{ color: 'var(--text-light)' }}>Tidak ada batch</span>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="3">
                    <EmptyState title="Produk tidak ditemukan" sub="Coba ubah kata kunci pencarian atau tambah produk baru." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showTambah && <TambahBatch onClose={() => setShowTambah(false)} produk={produk || []} />}
    </div>
  )
}

function TambahBatch({ onClose, produk }) {
  const [produkId, setProdukId] = useState(produk[0]?.id || '')
  const [noBatch, setNoBatch] = useState('')
  const [stok, setStok] = useState('')
  const [tanggalMasuk, setTanggalMasuk] = useState(hariIniISO())
  const [tanggalExp, setTanggalExp] = useState('')
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!produkId || !stok || !tanggalExp) {
      setError('Lengkapi produk, jumlah, dan tanggal kadaluarsa.')
      return
    }
    setSibuk(true)
    try {
      await db.batch.add({
        produkId: Number(produkId),
        noBatch: noBatch.trim() || `B-${Date.now().toString().slice(-6)}`,
        tanggalMasuk: tanggalLokal(tanggalMasuk),
        tanggalExp: tanggalLokal(tanggalExp),
        stok: Number(stok) || 0
      })
      await db.riwayatStok.add({
        produkId: Number(produkId),
        batchId: null,
        tipe: 'masuk',
        jumlah: Number(stok) || 0,
        tanggal: tanggalLokal(tanggalMasuk),
        keterangan: noBatch.trim()
      })
      onClose()
    } catch {
      setError('Gagal menyimpan batch.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal title="Tambah Batch Stok" onClose={onClose} foot={
      <>
        <button className="btn ghost" onClick={onClose}>Batal</button>
        <button className="btn primary" form="form-tambah-batch" disabled={sibuk}>
          {sibuk ? 'Menyimpan...' : 'Simpan'}
        </button>
      </>
    }>
      <form id="form-tambah-batch" onSubmit={handleSubmit}>
        {error && <div className="alert-banner danger" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="field">
          <label>Produk</label>
          <select className="inp" value={produkId} onChange={(e) => setProdukId(e.target.value)} required>
            <option value="">Pilih produk</option>
            {(produk || []).filter((p) => p.aktif).map((p) => (
              <option key={p.id} value={p.id}>{p.nama}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>No. Batch</label>
          <input className="inp" value={noBatch} onChange={(e) => setNoBatch(e.target.value)} placeholder="contoh: SUSU-004" />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Jumlah Stok</label>
            <input className="inp" type="number" min="0" value={stok} onChange={(e) => setStok(e.target.value)} required />
          </div>
          <div className="field">
            <label>Tanggal Masuk</label>
            <input className="inp" type="date" value={tanggalMasuk} onChange={(e) => setTanggalMasuk(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Tanggal Kadaluarsa</label>
          <input className="inp" type="date" value={tanggalExp} onChange={(e) => setTanggalExp(e.target.value)} required />
        </div>
      </form>
    </Modal>
  )
}
