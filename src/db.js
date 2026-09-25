import Dexie from 'dexie'

// ============================================================
// ExpiryGuardDB — Skema database (IndexedDB via Dexie)
// Struktur dibuat mendekati skema SQL/NoSQL sungguhan agar mudah
// dipindah ke Firebase / Supabase / REST API nanti.
//
// produk      : master produk (1 produk = banyak batch)
// batch       : unit stok per tanggal kadaluarsa (dasar FEFO)
// transaksi   : header penjualan, items disimpan sebagai snapshot
// riwayatStok : stok masuk / keluar / penyesuaian / rusak / kadaluarsa
// pengguna    : akun login (admin / kasir)
// pelanggan   : data pelanggan + poin loyalitas
// pengaturan  : key-value (threshold, profil toko, dll)
// ============================================================

export const db = new Dexie('ExpiryGuardDB')

// ---- Versi 1 (legacy, hanya untuk migrasi data lama) ----
db.version(1).stores({
  produk: '++id, nama, kategori, tanggalMasuk, tanggalExp, stok, harga'
})

// ---- Versi 2 (proto, migrasi bentuk model tunggal -> master+batch) ----
db.version(2)
  .stores({
    produk: '++id, nama, sku, kategori, aktif, createdAt',
    batch: '++id, produkId, noBatch, tanggalMasuk, tanggalExp, stok',
    transaksi: '++id, nomor, tanggal, kasirNama',
    riwayatStok: '++id, produkId, tipe, tanggal',
    pengguna: '++id, username, role',
    pelanggan: '++id, nama, noHp',
    pengaturan: '++id, key'
  })
  .upgrade(async (tx) => {
    // Migrasi: setiap produk lama (model tunggal) menjadi
    // produk master + 1 batch sesuai tanggalExp lama.
    const produkLama = await tx.table('produk').toArray()
    for (const p of produkLama) {
      // Model lama punya field tanggalExp langsung di produk
      if (p.tanggalExp && p.hargaJual === undefined) {
        await tx.table('produk').update(p.id, {
          nama: p.nama,
          sku: '',
          satuan: 'pcs',
          foto: null,
          hargaBeli: p.harga || 0,
          hargaJual: p.harga || 0,
          aktif: 1,
          createdAt: new Date().toISOString()
        })
        await tx.table('batch').add({
          produkId: p.id,
          noBatch: 'B-001',
          tanggalMasuk: p.tanggalMasuk || new Date().toISOString().split('T')[0],
          tanggalExp: p.tanggalExp,
          stok: p.stok || 0,
          hargaBeli: p.harga || 0
        })
      }
    }
  })

// ---- Versi 3 : skema lengkap final ----
db.version(3).stores({
  produk: '++id, nama, sku, kategori, aktif, createdAt',
  batch: '++id, produkId, noBatch, tanggalExp, stok',
  transaksi: '++id, nomor, tanggal, tanggalHari, kasirId, metode',
  riwayatStok: '++id, produkId, batchId, tanggal, tipe',
  pengguna: '++id, &username, role',
  pelanggan: '++id, nama, noHp',
  pengaturan: '++id, key'
})

// ---- Transaksi atomik: simpan transaksi + kurangi stok batch ----
export async function simpanTransaksi(data) {
  const id = await db.transaction('rw', db.transaksi, db.batch, db.riwayatStok, db.pelanggan, async () => {
    const tId = await db.transaksi.add(data)
    for (const item of data.items) {
      for (const alok of item.alokasi || []) {
        const batch = await db.batch.get(alok.batchId)
        if (batch) {
          await db.batch.update(batch.id, { stok: Math.max(0, (Number(batch.stok) || 0) - alok.qty) })
          await db.riwayatStok.add({
            produkId: item.produkId,
            batchId: batch.id,
            tipe: 'keluar',
            jumlah: -alok.qty,
            tanggal: data.tanggal,
            keterangan: data.nomor
          })
        }
      }
    }
    if (data.pelangganId) {
      const pel = await db.pelanggan.get(data.pelangganId)
      if (pel) {
        await db.pelanggan.update(pel.id, {
          poin: (pel.poin || 0) + (data.poinDapat || 0),
          totalBeli: (pel.totalBeli || 0) + data.totalAkhir
        })
      }
    }
    return tId
  })
  return id
}

export async function getSetting(key) {
  const row = await db.pengaturan.get(key)
  return row ? row.value : undefined
}

export async function getSettings() {
  const rows = await db.pengaturan.toArray()
  const out = {}
  for (const r of rows) out[r.key] = r.value
  return out
}

export async function setSetting(key, value) {
  await db.pengaturan.put({ key, value })
}