import { useState, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, simpanTransaksi } from '../db'
import {
  formatRupiah,
  hariIniISO,
  kodeTransaksi,
  alokasiFEFO,
  totalStok,
  statusTerburuk,
  formatTanggal,
  KATEGORI
} from '../helpers'
import { Modal, EmptyState } from '../components/ui'
import { Icon, IconCart, IconSearch, IconPlus, IconMinus, IconTrash, IconPrint } from '../components/icons'
import Struk from '../components/Struk'
import { toast } from '../toast'

export default function Kasir({ settings, user }) {
  // Database Live Queries
  const produkList = useLiveQuery(() => db.produk.toArray(), [])
  const batchList = useLiveQuery(() => db.batch.toArray(), [])
  const pelangganList = useLiveQuery(() => db.pelanggan.toArray(), [])
  const transaksiList = useLiveQuery(() => db.transaksi.toArray(), [])

  // State Keranjang & Katalog
  const [cari, setCari] = useState('')
  const [kategoriTerpilih, setKategoriTerpilih] = useState('Semua')
  const [keranjang, setKeranjang] = useState([]) // Array of items
  const [pelangganId, setPelangganId] = useState('')
  const [diskonPersen, setDiskonPersen] = useState(0)

  // State Modal
  const [showBayar, setShowBayar] = useState(false)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [transaksiSelesai, setTransaksiSelesai] = useState(null)
  const [warningExpired, setWarningExpired] = useState(null) // { produk, qty, alokasi }

  // State Pembayaran
  const [metodeBayar, setMetodeBayar] = useState('tunai')
  const [nominalBayar, setNominalBayar] = useState('')
  const [prosesSimpan, setProsesSimpan] = useState(false)

  // Input barcode scanner reference
  const searchInputRef = useRef(null)

  // Mapping batch per produk
  const batchesByProduk = useMemo(() => {
    const map = new Map()
    for (const b of batchList || []) {
      if (!map.has(b.produkId)) map.set(b.produkId, [])
      map.get(b.produkId).push(b)
    }
    return map
  }, [batchList])

  // Filter katalog produk
  const katalog = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (produkList || [])
      .filter((p) => p.aktif)
      .map((p) => {
        const bs = batchesByProduk.get(p.id) || []
        const stok = totalStok(bs)
        const expStatus = statusTerburuk(bs, settings)
        return { ...p, stok, batches: bs, expStatus }
      })
      .filter((p) => {
        if (kategoriTerpilih !== 'Semua' && p.kategori !== kategoriTerpilih) return false
        if (!q) return true
        return (
          (p.nama || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
        )
      })
  }, [produkList, batchesByProduk, settings, kategoriTerpilih, cari])

  // Hitung subtotal belanja
  const subtotal = useMemo(() => {
    return keranjang.reduce((sum, item) => sum + item.hargaJual * item.qty, 0)
  }, [keranjang])

  // Hitung nilai diskon rupiah
  const nominalDiskon = useMemo(() => {
    if (!diskonPersen || diskonPersen <= 0) return 0
    return Math.round((subtotal * Math.min(100, diskonPersen)) / 100)
  }, [subtotal, diskonPersen])

  // Total akhir yang harus dibayar
  const totalAkhir = useMemo(() => {
    return Math.max(0, subtotal - nominalDiskon)
  }, [subtotal, nominalDiskon])

  // Data pelanggan terpilih
  const pelangganAktif = useMemo(() => {
    if (!pelangganId) return null
    return (pelangganList || []).find((p) => p.id === Number(pelangganId)) || null
  }, [pelangganList, pelangganId])

  // Estimasi poin loyalitas yang didapatkan
  const estimasiPoin = useMemo(() => {
    const rate = settings?.POIN_PER || 10000
    return Math.floor(totalAkhir / rate)
  }, [totalAkhir, settings])

  // Hitung kembalian
  const kembalian = useMemo(() => {
    const bayar = Number(nominalBayar) || 0
    return Math.max(0, bayar - totalAkhir)
  }, [nominalBayar, totalAkhir])

  // Tambahkan produk ke keranjang belanja (dengan kalkulasi FEFO)
  function tambahKeKeranjang(produk, forceExpired = false) {
    const bs = batchesByProduk.get(produk.id) || []
    const sedia = totalStok(bs)
    if (sedia <= 0) {
      toast(`Stok "${produk.nama}" sedang kosong!`, 'error')
      return
    }

    const itemAda = keranjang.find((it) => it.produkId === produk.id)
    const targetQty = itemAda ? itemAda.qty + 1 : 1

    const hasilFEFO = alokasiFEFO(bs, targetQty, forceExpired)

    if (!hasilFEFO.ok) {
      if (hasilFEFO.error === 'expired' && !forceExpired) {
        setWarningExpired({ produk, targetQty })
        return
      }
      toast(hasilFEFO.error || 'Stok tidak mencukupi untuk batch tersedia', 'warn')
      return
    }

    if (itemAda) {
      setKeranjang(
        keranjang.map((it) =>
          it.produkId === produk.id
            ? {
                ...it,
                qty: targetQty,
                subtotal: targetQty * it.hargaJual,
                alokasi: hasilFEFO.alokasi,
                adaExpired: hasilFEFO.adaExpired
              }
            : it
        )
      )
    } else {
      setKeranjang([
        ...keranjang,
        {
          produkId: produk.id,
          nama: produk.nama,
          sku: produk.sku,
          hargaJual: produk.hargaJual,
          hargaBeli: produk.hargaBeli,
          qty: 1,
          maxStok: sedia,
          subtotal: produk.hargaJual,
          alokasi: hasilFEFO.alokasi,
          adaExpired: hasilFEFO.adaExpired
        }
      ])
    }
  }

  // Ubah kuantitas produk di keranjang
  function ubahQty(produkId, delta) {
    const item = keranjang.find((it) => it.produkId === produkId)
    if (!item) return
    const targetQty = item.qty + delta
    if (targetQty <= 0) {
      hapusItem(produkId)
      return
    }

    const bs = batchesByProduk.get(produkId) || []
    const hasilFEFO = alokasiFEFO(bs, targetQty, item.adaExpired)
    if (!hasilFEFO.ok) {
      toast(hasilFEFO.error || 'Jumlah melebihi stok yang tersedia', 'warn')
      return
    }

    setKeranjang(
      keranjang.map((it) =>
        it.produkId === produkId
          ? {
              ...it,
              qty: targetQty,
              subtotal: targetQty * it.hargaJual,
              alokasi: hasilFEFO.alokasi,
              adaExpired: hasilFEFO.adaExpired
            }
          : it
      )
    )
  }

  // Hapus item dari keranjang
  function hapusItem(produkId) {
    setKeranjang(keranjang.filter((it) => it.produkId !== produkId))
  }

  // Kosongkan seluruh keranjang
  function resetKeranjang() {
    if (keranjang.length === 0) return
    if (window.confirm('Kosongkan semua produk di keranjang?')) {
      setKeranjang([])
      setDiskonPersen(0)
      setPelangganId('')
    }
  }

  // Barcode scanner enter key handling
  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      const query = cari.trim().toLowerCase()
      if (!query) return

      // Cari exact match SKU terlebih dahulu (untuk scanner barcode fisik)
      const exactSku = katalog.find((p) => (p.sku || '').toLowerCase() === query)
      if (exactSku) {
        tambahKeKeranjang(exactSku)
        setCari('')
        return
      }

      // Jika hanya ada 1 match hasil pencarian, langsung tambahkan
      if (katalog.length === 1) {
        tambahKeKeranjang(katalog[0])
        setCari('')
      }
    }
  }

  // Buka modal pembayaran
  function handleOpenBayar() {
    if (keranjang.length === 0) {
      toast('Keranjang belanja masih kosong', 'warn')
      return
    }
    setNominalBayar(String(totalAkhir))
    setMetodeBayar('tunai')
    setShowBayar(true)
  }

  // Simpan transaksi penjualan
  async function handleProsesBayar() {
    const bayar = metodeBayar === 'tunai' ? Number(nominalBayar) || 0 : totalAkhir
    if (metodeBayar === 'tunai' && bayar < totalAkhir) {
      toast('Nominal pembayaran tunai kurang dari total belanja', 'error')
      return
    }

    setProsesSimpan(true)
    try {
      const todayISO = hariIniISO()
      // Hitung urutan transaksi hari ini
      const todayTxs = (transaksiList || []).filter(
        (t) => String(t.tanggalHari || t.tanggal || '').slice(0, 10) === todayISO
      )
      const nomorBaru = kodeTransaksi(todayISO, todayTxs.length + 1)

      const payload = {
        nomor: nomorBaru,
        tanggal: new Date().toISOString(),
        tanggalHari: todayISO,
        kasirId: user?.id || 1,
        kasirNama: user?.nama || 'Kasir',
        items: keranjang.map((it) => ({
          produkId: it.produkId,
          nama: it.nama,
          sku: it.sku,
          qty: it.qty,
          hargaJual: it.hargaJual,
          hargaBeli: it.hargaBeli,
          subtotal: it.subtotal,
          alokasi: it.alokasi
        })),
        subtotal,
        diskon: Number(diskonPersen) || 0,
        metode: metodeBayar,
        dibayar: bayar,
        kembalian: Math.max(0, bayar - totalAkhir),
        totalAkhir,
        pelangganId: pelangganAktif ? pelangganAktif.id : null,
        pelangganNama: pelangganAktif ? pelangganAktif.nama : null,
        poinDapat: pelangganAktif ? estimasiPoin : 0
      }

      await simpanTransaksi(payload)
      toast('Transaksi berhasil diproses!', 'success')

      // Buka modal struk / pasca transaksi
      setTransaksiSelesai(payload)
      setShowBayar(false)
      setKeranjang([])
      setDiskonPersen(0)
      setPelangganId('')
      setCari('')
    } catch (err) {
      console.error(err)
      toast('Gagal memproses transaksi: ' + (err.message || 'Kesalahan database'), 'error')
    } finally {
      setProsesSimpan(false)
    }
  }

  // Cetak struk belanja
  function handleCetakStruk() {
    document.body.classList.add('printing')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('printing')
    }, 500)
  }

  // Shortcut tombol uang pecahan
  const pecahanTunai = useMemo(() => {
    if (totalAkhir <= 0) return []
    const daftar = [totalAkhir]
    const pembulatan10 = Math.ceil(totalAkhir / 10000) * 10000
    const pembulatan50 = Math.ceil(totalAkhir / 50000) * 50000
    if (pembulatan10 > totalAkhir && !daftar.includes(pembulatan10)) daftar.push(pembulatan10)
    if (pembulatan50 > totalAkhir && !daftar.includes(pembulatan50)) daftar.push(pembulatan50)

    const standar = [20000, 50000, 100000, 200000, 500000]
    for (const val of standar) {
      if (val > totalAkhir && !daftar.includes(val) && daftar.length < 6) {
        daftar.push(val)
      }
    }
    return daftar.sort((a, b) => a - b)
  }, [totalAkhir])

  return (
    <div className="page-kasir">
      {/* Top Bar Kasir Aktif */}
      <div className="cashier-info-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="cashier-badge">
            <Icon name="cart" size={16} /> Kasir Aktif
          </span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{user?.nama || 'Petugas Kasir'}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            ({user?.role === 'admin' ? 'Administrator' : 'Kasir Shift Pagi/Siang'})
          </span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </div>
      </div>

      <div className="pos-grid">
        {/* Kolom Kiri: Katalog & Pencarian Produk */}
        <div className="pos-left">
          {/* Bar Pencarian & Scanner Barcode */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div className="searchbar search-with-scan">
              <IconSearch size={18} />
              <input
                ref={searchInputRef}
                className="inp"
                placeholder="Cari nama produk / scan barcode (Tekan Enter untuk tambah)..."
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
              />
              <span className="scan-indicator">⏎ Barcode Scan</span>
            </div>
            {cari && (
              <button className="btn ghost sm" onClick={() => setCari('')}>
                ✕ Reset
              </button>
            )}
          </div>

          {/* Filter Kategori */}
          <div className="prod-filter-row">
            <button
              className={`chip${kategoriTerpilih === 'Semua' ? ' on' : ''}`}
              onClick={() => setKategoriTerpilih('Semua')}
            >
              Semua ({produkList?.filter((p) => p.aktif).length || 0})
            </button>
            {KATEGORI.map((kat) => {
              const count = produkList?.filter((p) => p.aktif && p.kategori === kat).length || 0
              return (
                <button
                  key={kat}
                  className={`chip${kategoriTerpilih === kat ? ' on' : ''}`}
                  onClick={() => setKategoriTerpilih(kat)}
                >
                  {kat} ({count})
                </button>
              )
            })}
          </div>

          {/* Grid Kartu Produk */}
          <div className="prod-grid">
            {katalog.map((prod) => {
              const habis = prod.stok <= 0
              const isExpired = prod.expStatus?.level === 'expired'

              return (
                <div
                  key={prod.id}
                  className={`prod-card${isExpired ? ' expired-live' : ''}`}
                  style={{ opacity: habis ? 0.55 : 1 }}
                  onClick={() => !habis && tambahKeKeranjang(prod)}
                  title={habis ? 'Stok habis' : `Klik untuk menambahkan ${prod.nama}`}
                >
                  <div className="pc-name">{prod.nama}</div>
                  <div className="pc-price">{formatRupiah(prod.hargaJual)}</div>

                  <div className="pc-meta">
                    <span style={{ fontWeight: 600 }}>Stok: {prod.stok}</span>
                    <span className="spacer" />
                    {prod.expStatus && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: prod.expStatus.warnaBg,
                          color: prod.expStatus.warna,
                          fontWeight: 700
                        }}
                      >
                        {prod.expStatus.label}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {katalog.length === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '36px 12px' }}>
                <EmptyState
                  title="Produk tidak ditemukan"
                  sub="Coba ubah kata kunci pencarian atau kategori filter."
                />
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Keranjang Belanja & Pembayaran */}
        <div className="pos-right">
          <div className="card">
            <div className="card-head">
              <IconCart size={18} />
              <h3>Keranjang ({keranjang.reduce((s, it) => s + it.qty, 0)} item)</h3>
              <span className="spacer" />
              {keranjang.length > 0 && (
                <button className="btn ghost sm" onClick={resetKeranjang} title="Kosongkan Keranjang">
                  <IconTrash size={14} /> Kosongkan
                </button>
              )}
            </div>

            <div className="card-body" style={{ padding: '10px 14px' }}>
              {/* Pilihan Pelanggan / Member */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
                <select
                  className="inp"
                  style={{ fontSize: 13, padding: '7px 10px' }}
                  value={pelangganId}
                  onChange={(e) => setPelangganId(e.target.value)}
                >
                  <option value="">👤 Pelanggan Umum (Non-member)</option>
                  {(pelangganList || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      ⭐ {p.nama} ({p.poin || 0} poin)
                    </option>
                  ))}
                </select>
                <button
                  className="btn ghost sm"
                  onClick={() => setShowMemberModal(true)}
                  title="Tambah Member Baru"
                >
                  <IconPlus size={15} /> Baru
                </button>
              </div>

              {/* Tabel Item Keranjang */}
              {keranjang.length > 0 ? (
                <div style={{ maxHeight: '340px', overflowY: 'auto', marginBottom: 10 }}>
                  <table className="table cart-table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th className="right">Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {keranjang.map((it) => (
                        <tr key={it.produkId}>
                          <td style={{ maxWidth: 140 }}>
                            <div style={{ fontWeight: 600, fontSize: 12.5 }}>{it.nama}</div>
                            <div style={{ color: 'var(--muted)', fontSize: 11 }}>
                              {formatRupiah(it.hargaJual)} / {it.satuan || 'pcs'}
                            </div>
                            {/* Tag Alokasi FEFO */}
                            {it.alokasi && it.alokasi.length > 0 && (
                              <div className="cart-batch-tag">
                                📅 Exp: {it.alokasi.map((a) => formatTanggal(a.tanggalExp)).join(', ')}
                              </div>
                            )}
                            {it.adaExpired && (
                              <div className="cart-warning-row">
                                ⚠️ Mengandung stok batch kadaluarsa!
                              </div>
                            )}
                          </td>
                          <td className="cart-qty" style={{ textAlign: 'center' }}>
                            <div className="qty-ctl">
                              <button
                                onClick={() => ubahQty(it.produkId, -1)}
                                title="Kurangi"
                              >
                                <IconMinus size={12} />
                              </button>
                              <span>{it.qty}</span>
                              <button
                                onClick={() => ubahQty(it.produkId, 1)}
                                title="Tambah"
                              >
                                <IconPlus size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="right w-bold num" style={{ fontSize: 13 }}>
                            {formatRupiah(it.subtotal)}
                          </td>
                          <td className="right">
                            <button
                              className="icon-btn"
                              onClick={() => hapusItem(it.produkId)}
                              title="Hapus item"
                              style={{ color: 'var(--danger)', padding: 4 }}
                            >
                              <IconTrash size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '36px 12px' }}>
                  <EmptyState
                    title="Keranjang masih kosong"
                    sub="Pilih produk dari katalog di sebelah kiri untuk memulai transaksi."
                  />
                </div>
              )}

              {/* Rincian Subtotal & Diskon */}
              {keranjang.length > 0 && (
                <div
                  style={{
                    background: 'var(--bg)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Subtotal:</span>
                    <span className="num font-semibold">{formatRupiah(subtotal)}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)' }}>Diskon (%):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        className="inp"
                        type="number"
                        min="0"
                        max="100"
                        style={{ width: 64, padding: '3px 6px', fontSize: 12, textAlign: 'right' }}
                        value={diskonPersen}
                        onChange={(e) => setDiskonPersen(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                      />
                      {nominalDiskon > 0 && (
                        <span style={{ color: 'var(--danger)', fontSize: 12 }}>
                          -{formatRupiah(nominalDiskon)}
                        </span>
                      )}
                    </div>
                  </div>

                  {pelangganAktif && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--primary)' }}>
                      <span>Poin diperoleh:</span>
                      <span className="font-semibold">+{estimasiPoin} Poin</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Keranjang: Total & Tombol Bayar */}
            <div className="cart-sum">
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Total Tagihan</div>
                <div className="total-big" style={{ color: 'var(--primary)' }}>
                  {formatRupiah(totalAkhir)}
                </div>
              </div>
              <button
                className="btn primary btn-lg"
                disabled={keranjang.length === 0}
                onClick={handleOpenBayar}
                style={{ padding: '12px 24px' }}
              >
                Bayar Sekarang ➔
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Peringatan Penjualan Batch Kadaluarsa */}
      {warningExpired && (
        <Modal
          title="⚠️ Peringatan: Batch Kadaluarsa"
          onClose={() => setWarningExpired(null)}
          narrow
          foot={
            <>
              <button className="btn ghost" onClick={() => setWarningExpired(null)}>
                Batal
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const p = warningExpired.produk
                  setWarningExpired(null)
                  tambahKeKeranjang(p, true)
                }}
              >
                Tetap Jual (Otorisasi)
              </button>
            </>
          }
        >
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            <p>
              Produk <b>{warningExpired.produk?.nama}</b> memiliki stok pada batch yang sudah{' '}
              <b style={{ color: 'var(--danger)' }}>KADALUARSA</b>.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>
              Sesuai standar operasional ExpiryGuard, produk ini seharusnya ditarik dari rak display
              dan dimusnahkan. Apakah Anda yakin ingin tetap memasukkannya ke keranjang?
            </p>
          </div>
        </Modal>
      )}

      {/* Modal Pembayaran */}
      {showBayar && (
        <Modal
          title="Pembayaran Transaksi"
          onClose={() => !prosesSimpan && setShowBayar(false)}
          foot={
            <>
              <button
                className="btn ghost"
                disabled={prosesSimpan}
                onClick={() => setShowBayar(false)}
              >
                Batal
              </button>
              <button
                className="btn primary btn-lg"
                disabled={prosesSimpan || (metodeBayar === 'tunai' && Number(nominalBayar) < totalAkhir)}
                onClick={handleProsesBayar}
              >
                {prosesSimpan ? 'Menyimpan...' : '✓ Selesaikan Transaksi'}
              </button>
            </>
          }
        >
          <div>
            <div
              style={{
                textAlign: 'center',
                padding: '12px 0 16px',
                borderBottom: '1px solid var(--border)',
                marginBottom: 16
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Total yang Harus Dibayar</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>
                {formatRupiah(totalAkhir)}
              </div>
            </div>

            {/* Pilihan Metode Bayar */}
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Metode Pembayaran</label>
              <div className="pay-methods">
                <button
                  type="button"
                  className={`pay-method-btn${metodeBayar === 'tunai' ? ' active' : ''}`}
                  onClick={() => {
                    setMetodeBayar('tunai')
                    setNominalBayar(String(totalAkhir))
                  }}
                >
                  💵 Tunai
                </button>
                <button
                  type="button"
                  className={`pay-method-btn${metodeBayar === 'qris' ? ' active' : ''}`}
                  onClick={() => {
                    setMetodeBayar('qris')
                    setNominalBayar(String(totalAkhir))
                  }}
                >
                  📱 QRIS
                </button>
                <button
                  type="button"
                  className={`pay-method-btn${metodeBayar === 'kartu' ? ' active' : ''}`}
                  onClick={() => {
                    setMetodeBayar('kartu')
                    setNominalBayar(String(totalAkhir))
                  }}
                >
                  💳 Kartu
                </button>
              </div>
            </div>

            {metodeBayar === 'tunai' && (
              <div>
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>Nominal Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    className="inp num font-bold"
                    style={{ fontSize: 18, padding: '10px 14px' }}
                    value={nominalBayar}
                    onChange={(e) => setNominalBayar(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Tombol Cepat Pecahan Uang */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                    Pecahan Cepat:
                  </label>
                  <div className="quick-cash-grid">
                    {pecahanTunai.map((val) => (
                      <button
                        key={val}
                        type="button"
                        className="btn-cash"
                        onClick={() => setNominalBayar(String(val))}
                      >
                        {val === totalAkhir ? 'Uang Pas' : formatRupiah(val)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kembalian */}
                <div
                  style={{
                    background: Number(nominalBayar) >= totalAkhir ? 'var(--success-bg)' : 'var(--danger-bg)',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>
                    {Number(nominalBayar) >= totalAkhir ? 'Kembalian:' : 'Uang Kurang:'}
                  </span>
                  <span
                    className="num"
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: Number(nominalBayar) >= totalAkhir ? 'var(--success)' : 'var(--danger)'
                    }}
                  >
                    {formatRupiah(
                      Number(nominalBayar) >= totalAkhir
                        ? kembalian
                        : totalAkhir - (Number(nominalBayar) || 0)
                    )}
                  </span>
                </div>
              </div>
            )}

            {metodeBayar === 'qris' && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 20,
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>📲</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Pembayaran via QRIS Dinamis</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                  Tunjukkan QR code toko kepada pelanggan senilai <b>{formatRupiah(totalAkhir)}</b>.
                </div>
              </div>
            )}

            {metodeBayar === 'kartu' && (
              <div
                style={{
                  textAlign: 'center',
                  padding: 20,
                  background: 'var(--bg)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 8 }}>💳</div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Debit / Kredit EDC</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                  Silakan gesek / tap kartu pelanggan pada terminal EDC senilai <b>{formatRupiah(totalAkhir)}</b>.
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Pasca Transaksi & Struk */}
      {transaksiSelesai && (
        <Modal
          title="Transaksi Berhasil! 🎉"
          onClose={() => setTransaksiSelesai(null)}
          foot={
            <>
              <button className="btn ghost" onClick={handleCetakStruk}>
                <IconPrint size={16} /> Cetak Struk
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setTransaksiSelesai(null)
                  if (searchInputRef.current) searchInputRef.current.focus()
                }}
              >
                Transaksi Baru
              </button>
            </>
          }
        >
          <div>
            <div
              style={{
                background: 'var(--success-bg)',
                color: 'var(--success)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 16,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>Pembayaran Diterima</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                Kembalian: {formatRupiah(transaksiSelesai.kembalian)}
              </div>
            </div>

            {/* Pratinjau Struk */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: '#fff',
                maxHeight: '380px',
                overflowY: 'auto'
              }}
            >
              <Struk transaksi={transaksiSelesai} settings={settings || {}} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tambah Pelanggan Baru */}
      {showMemberModal && (
        <ModalTambahPelanggan
          onClose={() => setShowMemberModal(false)}
          onSuccess={(baru) => {
            setPelangganId(baru.id)
            setShowMemberModal(false)
          }}
        />
      )}
    </div>
  )
}

function ModalTambahPelanggan({ onClose, onSuccess }) {
  const [nama, setNama] = useState('')
  const [noHp, setNoHp] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function handleSimpan(e) {
    e.preventDefault()
    if (!nama.trim()) {
      toast('Nama pelanggan harus diisi', 'warn')
      return
    }
    setSibuk(true)
    try {
      const id = await db.pelanggan.add({
        nama: nama.trim(),
        noHp: noHp.trim() || '-',
        poin: 0,
        totalBeli: 0
      })
      toast('Pelanggan baru berhasil didaftarkan!', 'success')
      onSuccess({ id, nama, noHp, poin: 0 })
    } catch {
      toast('Gagal mendaftarkan pelanggan baru', 'error')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      title="Daftar Pelanggan / Member Baru"
      onClose={onClose}
      narrow
      foot={
        <>
          <button className="btn ghost" disabled={sibuk} onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" disabled={sibuk} onClick={handleSimpan}>
            {sibuk ? 'Menyimpan...' : 'Simpan Pelanggan'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSimpan}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>
            Nama Lengkap <span className="req">*</span>
          </label>
          <input
            className="inp"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Budi Santoso"
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label>Nomor HP / WhatsApp</label>
          <input
            className="inp"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            placeholder="Contoh: 08123456789"
          />
        </div>
      </form>
    </Modal>
  )
}
