import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  formatRupiah,
  formatTanggal,
  hariIniISO,
  offsetHariISO,
  hitungSisaHari,
  getStatusExp,
  statusTerburuk,
  statusStok,
  totalStok,
  exportCSV,
  KATEGORI,
  SATUAN
} from '../helpers'
import { Modal, Pill, StatCard, EmptyState } from '../components/ui'
import { Icon, IconPlus, IconSearch, IconEdit, IconTrash, IconBox } from '../components/icons'
import { toast } from '../toast'

export default function Produk({ settings }) {
  const produkList = useLiveQuery(() => db.produk.toArray(), [])
  const batchList = useLiveQuery(() => db.batch.toArray(), [])

  // State Filter & Pencarian
  const [cari, setCari] = useState('')
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [filterStatus, setFilterStatus] = useState('Semua')

  // State Modal
  const [showTambah, setShowTambah] = useState(false)
  const [editProduk, setEditProduk] = useState(null)
  const [detailBatchProduk, setDetailBatchProduk] = useState(null)
  const [hapusTarget, setHapusTarget] = useState(null)

  // Mapping batch per produkId
  const batchesByProduk = useMemo(() => {
    const map = new Map()
    for (const b of batchList || []) {
      if (!map.has(b.produkId)) map.set(b.produkId, [])
      map.get(b.produkId).push(b)
    }
    return map
  }, [batchList])

  // Ringkasan Statistik
  const stats = useMemo(() => {
    const totalMaster = produkList?.length || 0
    const totalAktif = produkList?.filter((p) => p.aktif).length || 0
    let totalUnitStok = 0
    let totalNilaiAset = 0
    let totalNilaiJual = 0

    for (const p of produkList || []) {
      if (!p.aktif) continue
      const bs = batchesByProduk.get(p.id) || []
      for (const b of bs) {
        const s = Number(b.stok) || 0
        totalUnitStok += s
        totalNilaiAset += s * (Number(p.hargaBeli) || 0)
        totalNilaiJual += s * (Number(p.hargaJual) || 0)
      }
    }

    return { totalMaster, totalAktif, totalUnitStok, totalNilaiAset, totalNilaiJual }
  }, [produkList, batchesByProduk])

  // Data Tabel Produk setelah Filter
  const rows = useMemo(() => {
    const q = cari.trim().toLowerCase()

    return (produkList || [])
      .map((p) => {
        const bs = batchesByProduk.get(p.id) || []
        const stok = totalStok(bs)
        const expStatus = statusTerburuk(bs, settings)
        const marginRp = (Number(p.hargaJual) || 0) - (Number(p.hargaBeli) || 0)
        const marginPct = p.hargaBeli > 0 ? Math.round((marginRp / p.hargaBeli) * 100) : 100

        return {
          ...p,
          batches: bs,
          stok,
          expStatus,
          marginRp,
          marginPct
        }
      })
      .filter((p) => {
        // Filter Kategori
        if (filterKategori !== 'Semua' && p.kategori !== filterKategori) return false

        // Filter Status
        if (filterStatus === 'Aktif' && !p.aktif) return false
        if (filterStatus === 'Nonaktif' && p.aktif) return false
        if (filterStatus === 'Stok Habis' && p.stok > 0) return false
        if (filterStatus === 'Stok Menipis' && (p.stok === 0 || p.stok > (settings?.LOW_STOCK || 3))) return false

        // Filter Pencarian
        if (!q) return true
        return (
          (p.nama || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.kategori || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (a.nama || '').localeCompare(b.nama || ''))
  }, [produkList, batchesByProduk, cari, filterKategori, filterStatus, settings])

  // Ekspor CSV Katalog Produk
  function handleExportCSV() {
    if (!rows || rows.length === 0) {
      toast('Tidak ada data produk untuk diekspor', 'warn')
      return
    }

    const headers = [
      'SKU / Barcode',
      'Nama Produk',
      'Kategori',
      'Satuan',
      'Harga Beli',
      'Harga Jual',
      'Margin (Rp)',
      'Margin (%)',
      'Total Stok',
      'Status Kadaluarsa',
      'Status Aktif'
    ]

    const dataRows = rows.map((r) => [
      r.sku || '',
      r.nama || '',
      r.kategori || '',
      r.satuan || 'pcs',
      r.hargaBeli || 0,
      r.hargaJual || 0,
      r.marginRp || 0,
      `${r.marginPct}%`,
      r.stok || 0,
      r.expStatus?.label || 'Aman',
      r.aktif ? 'Aktif' : 'Nonaktif'
    ])

    exportCSV(`katalog-produk-${hariIniISO()}.csv`, headers, dataRows)
    toast('Data katalog produk berhasil diekspor ke CSV!', 'success')
  }

  // Toggle status aktif/nonaktif
  async function toggleAktif(produk) {
    try {
      const baru = produk.aktif ? 0 : 1
      await db.produk.update(produk.id, { aktif: baru })
      toast(`Produk "${produk.nama}" ${baru ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info')
    } catch {
      toast('Gagal mengubah status produk', 'error')
    }
  }

  // Hapus produk permanen
  async function executeHapus() {
    if (!hapusTarget) return
    try {
      await db.transaction('rw', db.produk, db.batch, db.riwayatStok, async () => {
        // Hapus batch terkait
        const bs = await db.batch.where('produkId').equals(hapusTarget.id).toArray()
        for (const b of bs) {
          await db.batch.delete(b.id)
        }
        // Hapus riwayat stok terkait
        await db.riwayatStok.where('produkId').equals(hapusTarget.id).delete()
        // Hapus master produk
        await db.produk.delete(hapusTarget.id)
      })

      toast(`Produk "${hapusTarget.nama}" berhasil dihapus`, 'success')
      setHapusTarget(null)
    } catch (err) {
      console.error(err)
      toast('Gagal menghapus produk: ' + err.message, 'error')
    }
  }

  return (
    <div className="page-produk">
      {/* Header Halaman */}
      <div className="page-head">
        <div>
          <div className="page-title">Katalog & Manajemen Produk</div>
          <div className="page-sub">Kelola master data produk, harga jual/beli, dan stok batch</div>
        </div>
        <div className="page-actions">
          <button className="btn ghost" onClick={handleExportCSV}>
            📥 Ekspor CSV
          </button>
          <button className="btn primary" onClick={() => setShowTambah(true)}>
            <IconPlus size={16} /> Tambah Produk Baru
          </button>
        </div>
      </div>

      {/* Kartu Statistik Ringkas */}
      <div className="cards-grid">
        <StatCard
          label="Total Master Produk"
          value={stats.totalMaster}
          sub={`${stats.totalAktif} aktif dijual`}
          tone="blue"
          icon={<IconBox size={20} />}
        />
        <StatCard
          label="Total Unit Stok"
          value={stats.totalUnitStok.toLocaleString('id-ID')}
          sub="seluruh batch produk aktif"
          tone="green"
          icon={<Icon name="box" size={20} />}
        />
        <StatCard
          label="Nilai Modal Aset"
          value={formatRupiah(stats.totalNilaiAset)}
          sub="berdasarkan harga beli modal"
          tone="amber"
          icon={<Icon name="chart" size={20} />}
        />
        <StatCard
          label="Potensi Penjualan"
          value={formatRupiah(stats.totalNilaiJual)}
          sub={`Est. Laba ${formatRupiah(Math.max(0, stats.totalNilaiJual - stats.totalNilaiAset))}`}
          tone="blue"
          icon={<Icon name="cart" size={20} />}
        />
      </div>

      {/* Bar Pencarian & Filter */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <div className="searchbar" style={{ minWidth: 260 }}>
              <IconSearch size={18} />
              <input
                className="inp"
                placeholder="Cari nama produk, SKU, barcode..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
              />
            </div>

            {/* Filter Kategori */}
            <div style={{ minWidth: 160 }}>
              <select
                className="inp"
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
              >
                <option value="Semua">Semua Kategori</option>
                {KATEGORI.map((kat) => (
                  <option key={kat} value={kat}>
                    {kat}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Status */}
            <div style={{ minWidth: 140 }}>
              <select
                className="inp"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="Semua">Semua Status</option>
                <option value="Aktif">Hanya Aktif</option>
                <option value="Nonaktif">Hanya Nonaktif</option>
                <option value="Stok Menipis">Stok Menipis (≤ {settings?.LOW_STOCK || 3})</option>
                <option value="Stok Habis">Stok Habis (0)</option>
              </select>
            </div>

            {cari || filterKategori !== 'Semua' || filterStatus !== 'Semua' ? (
              <button
                className="btn ghost sm"
                onClick={() => {
                  setCari('')
                  setFilterKategori('Semua')
                  setFilterStatus('Semua')
                }}
              >
                ✕ Reset
              </button>
            ) : null}

            <span className="spacer" />
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Menampilkan <b>{rows.length}</b> dari {produkList?.length || 0} produk
            </div>
          </div>
        </div>
      </div>

      {/* Tabel Produk */}
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Produk & Barcode</th>
                <th>Kategori & Satuan</th>
                <th className="right">Harga Beli</th>
                <th className="right">Harga Jual</th>
                <th className="right">Margin / Laba</th>
                <th className="right">Stok</th>
                <th>Status Kadaluarsa</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th className="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const sStok = statusStok(p.stok, settings?.LOW_STOCK)

                return (
                  <tr key={p.id} style={{ opacity: p.aktif ? 1 : 0.6 }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.nama}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                        {p.sku ? `SKU: ${p.sku}` : 'Tanpa SKU'}
                      </div>
                    </td>
                    <td>
                      <div>{p.kategori}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Satuan: {p.satuan || 'pcs'}</div>
                    </td>
                    <td className="right num">{formatRupiah(p.hargaBeli)}</td>
                    <td className="right num font-semibold">{formatRupiah(p.hargaJual)}</td>
                    <td className="right">
                      <span
                        className={`badge-margin${p.marginRp < 0 ? ' negative' : ''}`}
                        title={`Laba kotor per item: ${formatRupiah(p.marginRp)}`}
                      >
                        {p.marginRp >= 0 ? '+' : ''}
                        {formatRupiah(p.marginRp)} ({p.marginPct}%)
                      </span>
                    </td>
                    <td className="right">
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13.5,
                          color: sStok.warna
                        }}
                      >
                        {p.stok}
                      </span>
                    </td>
                    <td>
                      <Pill status={p.expStatus} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className={`chip${p.aktif ? ' on' : ''}`}
                        style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}
                        onClick={() => toggleAktif(p)}
                        title="Klik untuk mengubah status aktif/nonaktif"
                      >
                        {p.aktif ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn ghost sm"
                        onClick={() => setDetailBatchProduk(p)}
                        title="Lihat & Tambah Batch"
                        style={{ marginRight: 4 }}
                      >
                        📦 Batch ({p.batches.length})
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => setEditProduk(p)}
                        title="Edit Produk"
                      >
                        <IconEdit size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => setHapusTarget(p)}
                        title="Hapus Produk"
                        style={{ color: 'var(--danger)' }}
                      >
                        <IconTrash size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan="9">
                    <EmptyState
                      title="Tidak ada produk ditemukan"
                      sub="Coba ubah kata kunci atau tambahkan produk baru sekarang."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Produk Baru */}
      {showTambah && (
        <ModalTambahProduk
          onClose={() => setShowTambah(false)}
          onSuccess={() => {
            setShowTambah(false)
          }}
        />
      )}

      {/* Modal Edit Produk */}
      {editProduk && (
        <ModalEditProduk
          produk={editProduk}
          onClose={() => setEditProduk(null)}
          onSuccess={() => {
            setEditProduk(null)
          }}
        />
      )}

      {/* Modal Rincian & Kelola Batch */}
      {detailBatchProduk && (
        <ModalBatchProduk
          produk={detailBatchProduk}
          settings={settings}
          onClose={() => setDetailBatchProduk(null)}
        />
      )}

      {/* Modal Konfirmasi Hapus */}
      {hapusTarget && (
        <Modal
          title="Konfirmasi Hapus Produk"
          onClose={() => setHapusTarget(null)}
          narrow
          foot={
            <>
              <button className="btn ghost" onClick={() => setHapusTarget(null)}>
                Batal
              </button>
              <button className="btn danger" onClick={executeHapus}>
                Hapus Permanen
              </button>
            </>
          }
        >
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            <p>
              Apakah Anda yakin ingin menghapus produk <b>{hapusTarget.nama}</b>?
            </p>
            {hapusTarget.batches?.length > 0 && (
              <div className="cart-warning-row" style={{ marginTop: 8 }}>
                ⚠️ Produk ini memiliki <b>{hapusTarget.batches.length} batch</b> dengan total stok{' '}
                <b>{hapusTarget.stok} unit</b>. Menghapus produk juga akan menghapus data batch dan
                riwayat stok terkait.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// Modal Tambah Produk Baru
// ============================================================
function ModalTambahProduk({ onClose, onSuccess }) {
  const [nama, setNama] = useState('')
  const [sku, setSku] = useState('')
  const [kategori, setKategori] = useState(KATEGORI[0])
  const [satuan, setSatuan] = useState('pcs')
  const [hargaBeli, setHargaBeli] = useState('')
  const [hargaJual, setHargaJual] = useState('')

  // Opsi Batch Awal Langsung
  const [adaBatchAwal, setAdaBatchAwal] = useState(true)
  const [noBatch, setNoBatch] = useState('B-001')
  const [stokAwal, setStokAwal] = useState('20')
  const [tanggalExp, setTanggalExp] = useState(offsetHariISO(90)) // Default 3 bulan ke depan
  const [sibuk, setSibuk] = useState(false)

  // Auto generate SKU
  function generateSKU() {
    const prefix = '899' + String(Math.floor(1000 + Math.random() * 9000))
    const suffix = String(Math.floor(10000 + Math.random() * 90000))
    setSku(prefix + suffix)
  }

  // Margin preview
  const hBeli = Number(hargaBeli) || 0
  const hJual = Number(hargaJual) || 0
  const marginRp = hJual - hBeli
  const marginPct = hBeli > 0 ? Math.round((marginRp / hBeli) * 100) : 0

  async function handleSimpan(e) {
    e.preventDefault()
    if (!nama.trim()) {
      toast('Nama produk wajib diisi', 'warn')
      return
    }
    if (hJual < 0 || hBeli < 0) {
      toast('Harga tidak boleh bernilai negatif', 'warn')
      return
    }

    setSibuk(true)
    try {
      const finalSku = sku.trim() || `SKU-${Date.now().toString().slice(-6)}`

      // 1. Simpan Master Produk
      const produkId = await db.produk.add({
        nama: nama.trim(),
        sku: finalSku,
        kategori,
        satuan,
        hargaBeli: hBeli,
        hargaJual: hJual,
        aktif: 1,
        foto: null,
        createdAt: new Date().toISOString()
      })

      // 2. Simpan Batch Pertama jika dipilih
      if (adaBatchAwal && Number(stokAwal) > 0) {
        const batchId = await db.batch.add({
          produkId,
          noBatch: noBatch.trim() || 'B-001',
          tanggalMasuk: hariIniISO(),
          tanggalExp: tanggalExp || offsetHariISO(180),
          stok: Number(stokAwal),
          hargaBeli: hBeli
        })

        // Catat riwayat stok awal
        await db.riwayatStok.add({
          produkId,
          batchId,
          tipe: 'masuk',
          jumlah: Number(stokAwal),
          tanggal: hariIniISO(),
          keterangan: 'Stok awal produk baru'
        })
      }

      toast(`Produk "${nama}" berhasil ditambahkan!`, 'success')
      onSuccess()
    } catch (err) {
      console.error(err)
      toast('Gagal menambahkan produk: ' + err.message, 'error')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      title="Tambah Produk Baru"
      onClose={onClose}
      wide
      foot={
        <>
          <button className="btn ghost" disabled={sibuk} onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" disabled={sibuk} onClick={handleSimpan}>
            {sibuk ? 'Menyimpan...' : 'Simpan Produk'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSimpan}>
        <div className="form-grid">
          <div className="field full">
            <label>
              Nama Produk <span className="req">*</span>
            </label>
            <input
              className="inp"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Susu UHT Coklat 1L"
              autoFocus
              required
            />
          </div>

          <div className="field">
            <label>SKU / Barcode</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="inp"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Scan barcode / kosongkan untuk auto"
              />
              <button
                type="button"
                className="btn ghost sm"
                onClick={generateSKU}
                title="Generate otomatis"
              >
                🎲 Auto
              </button>
            </div>
          </div>

          <div className="field">
            <label>Kategori</label>
            <select
              className="inp"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
            >
              {KATEGORI.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Satuan Unit</label>
            <select
              className="inp"
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
            >
              {SATUAN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Harga Modal / Beli (Rp)</label>
            <input
              type="number"
              min="0"
              className="inp num"
              value={hargaBeli}
              onChange={(e) => setHargaBeli(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="field">
            <label>
              Harga Jual (Rp) <span className="req">*</span>
            </label>
            <input
              type="number"
              min="0"
              className="inp num font-bold"
              value={hargaJual}
              onChange={(e) => setHargaJual(e.target.value)}
              placeholder="0"
              required
            />
          </div>

          {/* Estimasi Margin Laba */}
          <div className="full" style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)' }}>Estimasi Laba per Satuan:</span>
              <span style={{ fontWeight: 700, color: marginRp >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatRupiah(marginRp)} ({marginPct}%)
              </span>
            </div>
          </div>

          {/* Checkbox Batch Awal */}
          <div className="full" style={{ marginTop: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={adaBatchAwal}
                onChange={(e) => setAdaBatchAwal(e.target.checked)}
              />
              Input batch stok awal & tanggal kadaluarsa sekarang
            </label>
          </div>

          {adaBatchAwal && (
            <div
              className="full grid-2"
              style={{
                border: '1px dashed var(--border)',
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: '#fafbfe'
              }}
            >
              <div className="field">
                <label>Nomor Batch</label>
                <input
                  className="inp"
                  value={noBatch}
                  onChange={(e) => setNoBatch(e.target.value)}
                  placeholder="Contoh: B-001"
                />
              </div>

              <div className="field">
                <label>Jumlah Stok Awal ({satuan})</label>
                <input
                  type="number"
                  min="1"
                  className="inp num"
                  value={stokAwal}
                  onChange={(e) => setStokAwal(e.target.value)}
                  placeholder="20"
                />
              </div>

              <div className="field full">
                <label>Tanggal Kadaluarsa (Expired Date)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    type="date"
                    className="inp"
                    style={{ maxWidth: 220 }}
                    value={tanggalExp}
                    onChange={(e) => setTanggalExp(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setTanggalExp(offsetHariISO(30))}
                    >
                      +30 Hari
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setTanggalExp(offsetHariISO(90))}
                    >
                      +3 Bulan
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setTanggalExp(offsetHariISO(180))}
                    >
                      +6 Bulan
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => setTanggalExp(offsetHariISO(365))}
                    >
                      +1 Tahun
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// Modal Edit Produk
// ============================================================
function ModalEditProduk({ produk, onClose, onSuccess }) {
  const [nama, setNama] = useState(produk.nama || '')
  const [sku, setSku] = useState(produk.sku || '')
  const [kategori, setKategori] = useState(produk.kategori || KATEGORI[0])
  const [satuan, setSatuan] = useState(produk.satuan || 'pcs')
  const [hargaBeli, setHargaBeli] = useState(String(produk.hargaBeli || 0))
  const [hargaJual, setHargaJual] = useState(String(produk.hargaJual || 0))
  const [aktif, setAktif] = useState(produk.aktif ? 1 : 0)
  const [sibuk, setSibuk] = useState(false)

  async function handleSimpan(e) {
    e.preventDefault()
    if (!nama.trim()) {
      toast('Nama produk wajib diisi', 'warn')
      return
    }

    setSibuk(true)
    try {
      await db.produk.update(produk.id, {
        nama: nama.trim(),
        sku: sku.trim(),
        kategori,
        satuan,
        hargaBeli: Number(hargaBeli) || 0,
        hargaJual: Number(hargaJual) || 0,
        aktif
      })

      toast(`Perubahan produk "${nama}" berhasil disimpan!`, 'success')
      onSuccess()
    } catch (err) {
      console.error(err)
      toast('Gagal memperbarui produk: ' + err.message, 'error')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      title={`Edit Produk: ${produk.nama}`}
      onClose={onClose}
      wide
      foot={
        <>
          <button className="btn ghost" disabled={sibuk} onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" disabled={sibuk} onClick={handleSimpan}>
            {sibuk ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSimpan}>
        <div className="form-grid">
          <div className="field full">
            <label>
              Nama Produk <span className="req">*</span>
            </label>
            <input
              className="inp"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label>SKU / Barcode</label>
            <input
              className="inp"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Kategori</label>
            <select
              className="inp"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
            >
              {KATEGORI.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Satuan Unit</label>
            <select
              className="inp"
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
            >
              {SATUAN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Status</label>
            <select
              className="inp"
              value={aktif}
              onChange={(e) => setAktif(Number(e.target.value))}
            >
              <option value={1}>Aktif (Bisa dijual di kasir)</option>
              <option value={0}>Nonaktif (Disembunyikan dari kasir)</option>
            </select>
          </div>

          <div className="field">
            <label>Harga Modal / Beli (Rp)</label>
            <input
              type="number"
              min="0"
              className="inp num"
              value={hargaBeli}
              onChange={(e) => setHargaBeli(e.target.value)}
            />
          </div>

          <div className="field">
            <label>
              Harga Jual (Rp) <span className="req">*</span>
            </label>
            <input
              type="number"
              min="0"
              className="inp num font-bold"
              value={hargaJual}
              onChange={(e) => setHargaJual(e.target.value)}
              required
            />
          </div>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// Modal Rincian & Kelola Batch Produk
// ============================================================
function ModalBatchProduk({ produk, settings, onClose }) {
  const batches = useLiveQuery(
    () => db.batch.where('produkId').equals(produk.id).toArray(),
    [produk.id]
  )

  const [tambahBaru, setTambahBaru] = useState(false)
  const [noBatch, setNoBatch] = useState('')
  const [stok, setStok] = useState('10')
  const [tanggalExp, setTanggalExp] = useState(offsetHariISO(90))
  const [sibuk, setSibuk] = useState(false)

  async function handleTambahBatch(e) {
    e.preventDefault()
    if (!noBatch.trim()) {
      toast('Nomor batch harus diisi', 'warn')
      return
    }
    if (Number(stok) <= 0) {
      toast('Jumlah stok batch harus lebih dari 0', 'warn')
      return
    }

    setSibuk(true)
    try {
      const bId = await db.batch.add({
        produkId: produk.id,
        noBatch: noBatch.trim(),
        tanggalMasuk: hariIniISO(),
        tanggalExp: tanggalExp || offsetHariISO(180),
        stok: Number(stok),
        hargaBeli: produk.hargaBeli || 0
      })

      await db.riwayatStok.add({
        produkId: produk.id,
        batchId: bId,
        tipe: 'masuk',
        jumlah: Number(stok),
        tanggal: hariIniISO(),
        keterangan: `Restok batch ${noBatch.trim()}`
      })

      toast(`Batch "${noBatch}" berhasil ditambahkan!`, 'success')
      setTambahBaru(false)
      setNoBatch('')
      setStok('10')
    } catch (err) {
      toast('Gagal menambahkan batch: ' + err.message, 'error')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      title={`Batch Stok: ${produk.nama}`}
      onClose={onClose}
      wide
      foot={
        <button className="btn ghost" onClick={onClose}>
          Tutup
        </button>
      }
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>SKU: {produk.sku || '-'}</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              Total Stok: {totalStok(batches)} {produk.satuan || 'pcs'}
            </div>
          </div>
          {!tambahBaru && (
            <button className="btn primary sm" onClick={() => setTambahBaru(true)}>
              <IconPlus size={14} /> Tambah Batch Baru
            </button>
          )}
        </div>

        {/* Form Tambah Batch Cepat */}
        {tambahBaru && (
          <form
            onSubmit={handleTambahBatch}
            style={{
              background: '#f8fafd',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 16
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Input Batch Baru</div>
            <div className="form-grid">
              <div className="field">
                <label>Nomor Batch</label>
                <input
                  className="inp"
                  value={noBatch}
                  onChange={(e) => setNoBatch(e.target.value)}
                  placeholder="Contoh: B-002"
                  autoFocus
                  required
                />
              </div>
              <div className="field">
                <label>Jumlah Stok</label>
                <input
                  type="number"
                  min="1"
                  className="inp num"
                  value={stok}
                  onChange={(e) => setStok(e.target.value)}
                  required
                />
              </div>
              <div className="field full">
                <label>Tanggal Kadaluarsa</label>
                <input
                  type="date"
                  className="inp"
                  value={tanggalExp}
                  onChange={(e) => setTanggalExp(e.target.value)}
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
              <button
                type="button"
                className="btn ghost sm"
                disabled={sibuk}
                onClick={() => setTambahBaru(false)}
              >
                Batal
              </button>
              <button type="submit" className="btn primary sm" disabled={sibuk}>
                {sibuk ? 'Menyimpan...' : 'Simpan Batch'}
              </button>
            </div>
          </form>
        )}

        {/* Tabel Batch yang Ada */}
        <div className="table-wrap">
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>No. Batch</th>
                <th>Tgl Masuk</th>
                <th>Tgl Kadaluarsa</th>
                <th>Sisa Hari</th>
                <th className="right">Stok</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(batches || []).map((b) => {
                const sisa = hitungSisaHari(b.tanggalExp)
                const status = getStatusExp(b.tanggalExp, settings)

                return (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.noBatch || `#${b.id}`}</td>
                    <td>{formatTanggal(b.tanggalMasuk)}</td>
                    <td>{formatTanggal(b.tanggalExp)}</td>
                    <td style={{ fontWeight: 700, color: status.warna }}>
                      {sisa === null ? '-' : sisa < 0 ? `Lewat ${-sisa} hr` : `${sisa} hr`}
                    </td>
                    <td className="right font-semibold num">{b.stok}</td>
                    <td>
                      <Pill status={status} />
                    </td>
                  </tr>
                )
              })}

              {(!batches || batches.length === 0) && (
                <tr>
                  <td colSpan="6">
                    <EmptyState
                      title="Belum ada batch"
                      sub="Tambahkan batch baru agar produk ini memiliki stok dan bisa dijual."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

