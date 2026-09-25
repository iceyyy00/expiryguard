// ============================================================
// Helper: format, status kadaluarsa, FEFO, ekspor CSV
// ============================================================

export const KATEGORI = [
  'Makanan',
  'Minuman',
  'Frozen Food',
  'Susu & Formula',
  'Obat',
  'Kesehatan & Vitamin',
  'Snack',
  'Kebutuhan Rumah'
]

export const SATUAN = ['pcs', 'box', 'botol', 'kg', 'gram', 'sachet', 'strip', 'tube', 'pack', 'liter', 'ml']

export const DEFAULT_SETTINGS = {
  TOKO_NAMA: 'ExpiryGuard Store',
  TOKO_ALAMAT: 'Jl. Kasir Raya No. 12',
  TOKO_HP: '0812-3456-7890',
  THRESHOLD_WARNING: 30, // H-X sebelum expire -> kuning "Segera Kadaluarsa"
  THRESHOLD_URGENT: 7, // H-X sebelum expire -> oranye "Mendesak"
  LOW_STOCK: 3, // stok di bawah nilai ini -> menipis
  POIN_PER: 10000 // Rp 10.000 = 1 poin loyalitas
}

export function formatRupiah(n) {
  const num = Number(n) || 0
  return 'Rp' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

export function parseRupiah(str) {
  const num = Number(String(str || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0
  return num
}

export function formatTanggal(iso, withTime = false) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  })
}

export function hariIniISO() {
  return new Date().toISOString().split('T')[0]
}

export function offsetHariISO(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

// Tanggal lokal YYYY-MM-DD (bukan UTC) agar tidak bergeser zona waktu
export function tanggalLokal(k) {
  if (!k) return hariIniISO()
  const d = new Date(k)
  if (isNaN(d)) return String(k)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Selisih hari antara hari ini dan tanggalExp (positif = masih ada sisa hari)
export function hitungSisaHari(tanggalExp) {
  if (!tanggalExp) return null
  const hariIni = new Date()
  const exp = new Date(tanggalExp)
  hariIni.setHours(0, 0, 0, 0)
  exp.setHours(0, 0, 0, 0)
  return Math.round((exp - hariIni) / (1000 * 60 * 60 * 24))
}

// ---- Status kadaluarsa (threshold bisa diatur user) ----
// expired  : merah   - lewat tanggal kadaluarsa (URGENT, diblokir dari penjualan)
// urgent   : oranye  - <= THRESHOLD_URGENT hari (Mendesak)
// warning  : kuning  - <= THRESHOLD_WARNING hari (Segera Kadaluarsa)
// aman     : hijau   - cukup jauh
export function getStatusExp(tanggalExp, settings = {}) {
  const sisaHari = hitungSisaHari(tanggalExp)
  if (sisaHari === null) return { level: 'aman', label: 'Tanpa Kadaluarsa', warna: '#10b981', warnaBg: '#dcfce7', prioritas: 0 }
  const warning = settings.THRESHOLD_WARNING ?? DEFAULT_SETTINGS.THRESHOLD_WARNING
  const urgent = settings.THRESHOLD_URGENT ?? DEFAULT_SETTINGS.THRESHOLD_URGENT
  if (sisaHari < 0) return { level: 'expired', label: 'KADALUARSA', warna: '#dc2626', warnaBg: '#fee2e2', prioritas: 3 }
  if (sisaHari <= urgent) return { level: 'urgent', label: 'Mendesak', warna: '#ea580c', warnaBg: '#ffedd5', prioritas: 2 }
  if (sisaHari <= warning) return { level: 'warning', label: 'Segera Kadaluarsa', warna: '#ca8a04', warnaBg: '#fef9c3', prioritas: 1 }
  return { level: 'aman', label: 'Aman', warna: '#10b981', warnaBg: '#dcfce5', prioritas: 0 }
}

export const getStatus = getStatusExp

export function statusStok(stok, minStok) {
  const min = minStok ?? DEFAULT_SETTINGS.LOW_STOCK
  if (!stok) return { level: 'habis', label: 'Stok Habis', warna: '#dc2626', warnaBg: '#fee2e2', prioritas: 2 }
  if (stok <= min) return { level: 'menipis', label: 'Stok Menipis', warna: '#f59e0b', warnaBg: '#fef3c7', prioritas: 1 }
  return { level: 'aman', label: 'Aman', warna: '#10b981', warnaBg: '#dcfce5', prioritas: 0 }
}

export const METODE_BAYAR = [
  { id: 'tunai', label: 'Tunai' },
  { id: 'kartu', label: 'Kartu' },
  { id: 'qris', label: 'QRIS / E-Wallet' }
]

export function namaMetode(id) {
  const m = METODE_BAYAR.find((x) => x.id === id)
  return m ? m.label : id
}

// Total stok produk = jumlah stok semua batch
export function totalStok(batches) {
  return (batches || []).reduce((sum, b) => sum + (Number(b.stok) || 0), 0)
}

// Status "terburuk" dari semua batch (untuk badge di kartu produk)
export function statusTerburuk(batches, settings) {
  let worst = null
  for (const b of batches || []) {
    if ((Number(b.stok) || 0) <= 0) continue
    const st = getStatusExp(b.tanggalExp, settings)
    if (!worst || st.prioritas > worst.prioritas) worst = st
  }
  return worst || { level: 'aman', label: 'Aman', warna: '#10b981', warnaBg: '#dcfce5', prioritas: 0 }
}

// ---- FEFO: alokasi penjualan dari batch yang paling dekat kadaluarsanya ----
// batches      : semua batch produk (aktif)
// qty          : jumlah yang mau dijual
// forceExpired : kasir sudah konfirmasi menjual batch kadaluarsa
// return       : { ok, alokasi: [{batchId, noBatch, qty, tanggalExp}], error, adaExpired }
export function alokasiFEFO(batches, qty, forceExpired = false) {
  const stokTotal = totalStok(batches)
  qty = Number(qty) || 0

  if (qty <= 0) return { ok: false, error: 'Jumlah tidak valid', alokasi: [], adaExpired: false }
  if (stokTotal < qty) return { ok: false, error: `Stok tidak cukup (tersedia ${stokTotal})`, alokasi: [], adaExpired: false }

  const urut = [...batches]
    .filter((b) => (Number(b.stok) || 0) > 0)
    .sort((a, b) => (String(a.tanggalExp || '9999') < String(b.tanggalExp || '9999') ? -1 : 1))

  let sisa = qty
  const alokasi = []
  let adaExpired = false

  for (const b of urut) {
    if (sisa <= 0) break
    const st = getStatusExp(b.tanggalExp)
    if (st.level === 'expired') {
      adaExpired = true
      if (!forceExpired) break // blokir: batch terdekat sudah kadaluarsa
    }
    const ambil = Math.min(sisa, Number(b.stok))
    alokasi.push({ batchId: b.id, noBatch: b.noBatch, tanggalExp: b.tanggalExp, qty: ambil })
    sisa -= ambil
  }

  if (sisa > 0) {
    if (adaExpired && !forceExpired) {
      return {
        ok: false,
        error: 'expired',
        alokasi,
        adaExpired: true,
        detail: 'Batch terdekat kadaluarsanya sudah KADALUARSA. Produk ini seharusnya ditarik dari rak.'
      }
    }
    return { ok: false, error: 'Stok tidak cukup', alokasi, adaExpired }
  }

  return { ok: true, alokasi, adaExpired }
}

export function kodeTransaksi(tanggalISO, nomor) {
  const ymd = tanggalLokal(tanggalISO).replaceAll('-', '')
  return `INV-${ymd}-${String(nomor).padStart(4, '0')}`
}

// ---- Export CSV (kompatibel Excel Indonesia: pemisah ; + BOM UTF-8) ----
export function exportCSV(filename, headers, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[";\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s
  }
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function konfirmasi(msg) {
  return window.confirm(msg)
}