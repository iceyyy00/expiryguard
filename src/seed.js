import { db } from './db'
import { offsetHariISO, tanggalLokal, kodeTransaksi, DEFAULT_SETTINGS } from './helpers'

// ============================================================
// Seed data demo — hanya dijalankan sekali saat database kosong.
// Tanggal kadaluarsa dibuat relatif terhadap hari ini supaya
// status (kadaluarsa / mendesak / segera / aman) selalu terlihat.
// ============================================================

const PRODUK_DEF = [
  // [nama, sku, kategori, satuan, hargaBeli, hargaJual]
  ['Susu UHT Full Cream 1L', '899100210001', 'Susu & Formula', 'box', 16500, 19200],
  ['Susu UHT Coklat 200ml', '899100210002', 'Susu & Formula', 'box', 5200, 6500],
  ['Formula Bayi 800g', '899100210003', 'Susu & Formula', 'box', 128000, 143000],
  ['Yogurt 250ml', '899100210004', 'Susu & Formula', 'box', 9800, 12500],
  ['Nugget Ayam 500g', '899100220001', 'Frozen Food', 'pack', 28000, 35000],
  ['Sosis Ayam 250g', '899100220002', 'Frozen Food', 'pack', 13500, 16800],
  ['Dimsum Frozen 12pcs', '899100220003', 'Frozen Food', 'pack', 22000, 27500],
  ['Frozen Kaki Naga 300g', '899100220004', 'Frozen Food', 'pack', 18000, 22500],
  ['Bumbu Bubuk Sop 10g', '899100230001', 'Makanan', 'sachet', 900, 1800],
  ['Mie Instan Goreng', '899100230002', 'Makanan', 'pcs', 2650, 3500],
  ['Beras Premium 5kg', '899100230003', 'Makanan', 'pack', 68000, 75000],
  ['Kecap Manis 275ml', '899100230004', 'Makanan', 'botol', 14500, 17200],
  ['Kaldu Bubuk Rasa Ayam 250g', '899100230005', 'Makanan', 'box', 17500, 21000],
  ['Teh Botol 350ml', '899100240001', 'Minuman', 'botol', 3200, 4500],
  ['Air Mineral 600ml', '899100240002', 'Minuman', 'botol', 1800, 3000],
  ['Kopi Instan Sachet 12x20g', '899100240003', 'Minuman', 'box', 14500, 17500],
  ['Jus Buah Murni 250ml', '899100240004', 'Minuman', 'box', 9000, 11500],
  ['Sirup Mangga 460ml', '899100240005', 'Minuman', 'botol', 12500, 15000],
  ['Parasetamol 500mg (Strip 10)', '899100250001', 'Obat', 'strip', 3500, 6000],
  ['Obat Maag Sirup 100ml', '899100250002', 'Obat', 'botol', 9000, 13500],
  ['Vit C 250mg (Strip 10)', '899100250003', 'Obat', 'strip', 4200, 7000],
  ['Minyak Kayu Putih 30ml', '899100250004', 'Obat', 'botol', 11500, 14800],
  ['Salep Luka Bakar 10g', '899100250005', 'Obat', 'tube', 8600, 12000],
  ['Plester Transparan 10 strip', '899100250006', 'Kesehatan & Vitamin', 'box', 6500, 9500],
  ['Masker Medis 50pcs', '899100250007', 'Kesehatan & Vitamin', 'box', 15000, 19000],
  ['Multivitamin Imun 60 kaps', '899100250008', 'Kesehatan & Vitamin', 'botol', 28000, 35000],
  ['Chips Olahraga 100g', '899100260001', 'Snack', 'pcs', 7000, 10000],
  ['Biskuit Coklat 200g', '899100260002', 'Snack', 'pcs', 8500, 11500],
  ['Permen Susu 1kg', '899100260003', 'Snack', 'pcs', 23500, 29000],
  ['Keripik Kentang 68g', '899100260004', 'Snack', 'pcs', 9800, 13500],
  ['Pembersih Lantai 800ml', '899100270001', 'Kebutuhan Rumah', 'botol', 16000, 19500],
  ['Sabun Cair Cuci Piring 700ml', '899100270002', 'Kebutuhan Rumah', 'botol', 17500, 21000],
  ['Deterjen 1.5kg', '899100270003', 'Kebutuhan Rumah', 'pack', 24500, 29500],
  ['Tisu Basah 40 lembar', '899100270004', 'Kebutuhan Rumah', 'pcs', 9800, 12000],
  ['Shampo Anti Kua 170ml', '899100270005', 'Kebutuhan Rumah', 'botol', 21500, 26000]
]

const BMP = new Map([
  ['Susu & Formula', 'SUSU'],
  ['Frozen Food', 'FROZ'],
  ['Makanan', 'MAKA'],
  ['Minuman', 'MINU'],
  ['Obat', 'OBAT'],
  ['Kesehatan & Vitamin', 'VITA'],
  ['Snack', 'SNAK'],
  ['Kebutuhan Rumah', 'RUMA']
])

// Rencana batch per produk: [hariMenujuExp, stokAwal]
// sengaja dibuat kadaluarsa / menipis / habis agar demo terlihat hidup
const BATCH_PLAN = [
  [0, [40, 60]], [0, [75, 50]], [1, [20, 24]], [1, [45, 22]],
  [2, [300, 10]], [3, [-2, 1]], [3, [10, 8]], [3, [25, 8]],
  [4, [15, 12]], [4, [60, 20]], [5, [5, 8]], [5, [45, 14]],
  [6, [8, 10]], [6, [70, 12]], [7, [3, 6]], [7, [55, 12]],
  [8, [400, 30]], [9, [120, 40]], [10, [180, 8]], [10, [400, 6]],
  [11, [260, 14]], [12, [90, 16]], [13, [60, 30]], [14, [200, 40]],
  [15, [160, 14]], [16, [240, 12]], [17, [12, 8]], [18, [45, 15]], [18, [150, 12]],
  [19, [-5, 2]], [19, [80, 10]], [20, [6, 8]], [20, [60, 10]],
  [21, [30, 10]], [21, [240, 8]], [22, [-1, 4]], [22, [120, 6]],
  [23, [90, 12]], [24, [400, 20]], [25, [500, 8]], [26, [210, 16]],
  [27, [300, 14]], [28, [140, 10]], [29, [75, 12]],
  [30, [700, 8]], [31, [600, 8]], [32, [500, 8]], [33, [400, 10]],
  [34, [350, 10]]
]

const NAMA_ORANG = [
  'Budi Santoso', 'Siti Rahayu', 'Ahmad Fauzi', 'Dewi Lestari',
  'Rudi Hartono', 'Maya Anggraini', 'Joko Susilo', 'Ratna Sari',
  'Doni Saputra', 'Indah Permata', 'Andi Wijaya', 'Fitri Handayani'
]

function acak(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pilih(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function offsetHari(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return tanggalLokal(d)
}

// Alokasi FEFO dari kumpulan batch dalam memori (untuk simulasi penjualan demo)
function fefoAmbil(batchPool, produkIdx, qty) {
  const pool = batchPool
    .filter((b) => b.produkIdx === produkIdx && b.stok > 0)
    .sort((a, b) => (a.tanggalExp < b.tanggalExp ? -1 : 1))
  const al = []
  let sisa = qty
  for (const b of pool) {
    if (sisa <= 0) break
    if (b.tanggalExp < offsetHari(0)) continue // demo tidak menjual yang sudah kadaluarsa
    const ambil = Math.min(sisa, b.stok)
    b.stok -= ambil
    al.push({ noBatchRef: b.noBatch, qty: ambil, tanggalExp: b.tanggalExp })
    sisa -= ambil
  }
  return sisa > 0 ? null : al
}

export async function seedData() {
  // ---- Setelan default ----
  if ((await db.pengaturan.count()) === 0) {
    await db.pengaturan.bulkAdd(
      Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }))
    )
  }

  // ---- Pengguna ----
  if ((await db.pengguna.count()) === 0) {
    await db.pengguna.bulkAdd([
      { nama: 'Administrator', username: 'admin', password: 'admin123', role: 'admin', aktif: 1 },
      { nama: 'Kasir Pagi', username: 'kasir', password: 'kasir123', role: 'kasir', aktif: 1 }
    ])
  }

  // ---- Pelanggan ----
  if ((await db.pelanggan.count()) === 0) {
    await db.pelanggan.bulkAdd(
      NAMA_ORANG.slice(0, 8).map((nama) => ({
        nama,
        noHp: '0812' + String(acak(10000000, 99999999)),
        poin: 0,
        totalBeli: 0
      }))
    )
  }

  if ((await db.produk.count()) > 0) return

  // ---- Buat batch awal (dalam memori) ----
  const batchBaru = []
  let counter = 0
  for (const [i, [hari, stok]] of BATCH_PLAN.entries()) {
    if (i >= PRODUK_DEF.length) break
    const def = PRODUK_DEF[i]
    counter++
    batchBaru.push({
      produkIdx: i,
      noBatch: `${BMP.get(def[2]) || 'P'}-${String(counter).padStart(3, '0')}`,
      tanggalMasuk: offsetHari(-acak(20, 90)),
      tanggalExp: offsetHari(hari),
      stok,
      hargaBeli: def[4]
    })
  }

  // ---- Simulasi 14 hari transaksi, konsumsi stok via FEFO ----
  const transaksiBaru = []
  const riwayatKeluar = [] // { produkIdx, noBatchRef, qty, tanggal }
  for (let d = 14; d >= 1; d--) {
    const tanggal = offsetHari(-d)
    const jmlTransaksi = acak(4, 9)
    for (let t = 0; t < jmlTransaksi; t++) {
      const n = acak(1, 4)
      const dipilih = new Set()
      for (let k = 0; k < n; k++) dipilih.add(acak(0, PRODUK_DEF.length - 1))
      const items = []
      let subtotal = 0
      for (const pi of dipilih) {
        const def = PRODUK_DEF[pi]
        const qty = acak(1, 3)
        const alokasi = fefoAmbil(batchBaru, pi, qty)
        if (!alokasi) continue
        const sub = qty * def[5]
        subtotal += sub
        items.push({
          produkId: pi,
          nama: def[0],
          sku: def[1],
          qty,
          hargaJual: def[5],
          hargaBeli: def[4],
          alokasi
        })
        for (const a of alokasi) {
          riwayatKeluar.push({ produkIdx: pi, noBatchRef: a.noBatchRef, qty: a.qty, tanggal })
        }
      }
      if (items.length === 0) continue
      const diskon = Math.random() < 0.25 ? acak(5, 15) : 0
      const totalAkhir = Math.round((subtotal * (100 - diskon)) / 100)
      const metode = pilih(['tunai', 'tunai', 'tunai', 'qris', 'kartu'])
      const dibayar = metode === 'tunai' ? Math.ceil(totalAkhir / 5000) * 5000 : totalAkhir
      const pelanggan = Math.random() < 0.3 ? acak(1, 8) : null
      transaksiBaru.push({
        nomor: kodeTransaksi(tanggal, t + 1),
        tanggal: `${tanggal}T${String(acak(8, 20)).padStart(2, '0')}:${String(acak(0, 59)).padStart(2, '0')}:00`,
        tanggalHari: tanggal,
        kasirId: 2,
        kasirNama: 'Kasir Pagi',
        items,
        diskon,
        metode,
        dibayar,
        kembalian: dibayar - totalAkhir,
        totalAkhir,
        pelangganId: pelanggan,
        poinDapat: Math.floor(totalAkhir / 10000)
      })
    }
  }

  // ---- 1 transaksi hari ini agar statistik "hari ini" tidak nol ----
  {
    const pi = 13 // Teh Botol
    const def = PRODUK_DEF[pi]
    const qty = 2
    const alokasi = fefoAmbil(batchBaru, pi, qty) || []
    const subtotal = qty * def[5]
    transaksiBaru.push({
      nomor: kodeTransaksi(offsetHari(0), 1),
      tanggal: new Date().toISOString(),
      tanggalHari: offsetHari(0),
      kasirId: 2,
      kasirNama: 'Kasir Pagi',
      items: [
        {
          produkId: pi,
          nama: def[0],
          sku: def[1],
          qty,
          hargaJual: def[5],
          hargaBeli: def[4],
          alokasi
        }
      ],
      diskon: 0,
      metode: 'tunai',
      dibayar: subtotal,
      kembalian: 0,
      totalAkhir: subtotal,
      pelangganId: null,
      poinDapat: 0
    })
  }

  // ---- Simpan produk + batch ----
  const idsProduk = await db.produk.bulkAdd(
    PRODUK_DEF.map((def) => ({
      nama: def[0],
      sku: def[1],
      kategori: def[2],
      satuan: def[3],
      hargaBeli: def[4],
      hargaJual: def[5],
      aktif: 1,
      foto: null,
      createdAt: new Date().toISOString()
    }))
  )

  const idBatchByRef = new Map() // noBatch -> id batch
  for (const b of batchBaru) {
    const id = await db.batch.add({
      produkId: idsProduk[b.produkIdx],
      noBatch: b.noBatch,
      tanggalMasuk: b.tanggalMasuk,
      tanggalExp: b.tanggalExp,
      stok: b.stok,
      hargaBeli: b.hargaBeli
    })
    idBatchByRef.set(b.noBatch, id)
  }

  // ---- Riwayat keluar + transaksi dengan batchId asli ----
  for (const r of riwayatKeluar) {
    await db.riwayatStok.add({
      produkId: idsProduk[r.produkIdx],
      batchId: idBatchByRef.get(r.noBatchRef) || null,
      tipe: 'keluar',
      jumlah: -r.qty,
      tanggal: r.tanggal,
      keterangan: ''
    })
  }

  for (const tr of transaksiBaru) {
    for (const item of tr.items) {
      if (!item.alokasi) continue
      for (const a of item.alokasi) {
        a.batchId = idBatchByRef.get(a.noBatchRef) || null
        delete a.noBatchRef
        delete a.tanggalExp
      }
    }
  }
  await db.transaksi.bulkAdd(transaksiBaru)

  // ---- Penyesuaian kadaluarsa & rusak (untuk laporan kerugian) ----
  const batchYogurt = batchBaru.find((b) => b.produkIdx === 3 && b.tanggalExp === offsetHari(-2))
  if (batchYogurt) {
    const bid = idBatchByRef.get(batchYogurt.noBatch)
    await db.batch.update(bid, { stok: 0 })
    await db.riwayatStok.add({
      produkId: idsProduk[3],
      batchId: bid,
      tipe: 'kadaluarsa',
      jumlah: -batchYogurt.stok,
      tanggal: offsetHari(-2),
      keterangan: 'Batch kadaluarsa ditarik dari rak'
    })
  }
  await db.riwayatStok.add({
    produkId: idsProduk[13],
    batchId: null,
    tipe: 'rusak',
    jumlah: -2,
    tanggal: offsetHari(-1),
    keterangan: 'Bocor saat pengiriman'
  })
}