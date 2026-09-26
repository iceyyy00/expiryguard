import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  formatRupiah,
  formatTanggal,
  hitungSisaHari,
  statusStok,
  totalStok
} from '../helpers'
import { StatCard, BarChart, EmptyState } from '../components/ui'
import { Icon } from '../components/icons'
import { useSettings, useAlerts } from '../hooks'

export default function Dashboard({ go }) {
  const settings = useSettings()
  const { list: alertList } = useAlerts()
  const transaksi = useLiveQuery(() => db.transaksi.toArray(), [])
  const batches = useLiveQuery(() => db.batch.toArray(), [])
  const produk = useLiveQuery(() => db.produk.toArray(), [])

  const stats = useMemo(() => {
    const hariIni = new Date().toISOString().split('T')[0]
    const hariIniId = hariIni // tanggalHari disimpan dari tanggalLokal

    // transaksi punya tanggalHari (YYYY-MM-DD lokal)
    const today = (transaksi || []).filter((t) => String(t.tanggalHari || '').slice(0, 10) === hariIniId)
    const omsetHariIni = today.reduce((s, t) => s + (Number(t.totalAkhir) || 0), 0)
    const jmlTransaksi = today.length

    const byBatch = new Map()
    for (const b of batches || []) {
      if (!byBatch.has(b.produkId)) byBatch.set(b.produkId, [])
      byBatch.get(b.produkId).push(b)
    }
    const stokPerProduk = [...byBatch.entries()].map(([pid, bs]) => ({
      produkId: pid,
      stok: totalStok(bs)
    }))

    const aktifProduk = (produk || []).filter((p) => p.aktif)
    const stokMenipis = stokPerProduk.filter((s) => statusStok(s.stok, settings.LOW_STOCK).prioritas > 0)
    const jmlProduk = aktifProduk.length

    // 7 hari terakhir untuk grafik
    const last7 = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const lokal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const sum = (transaksi || [])
        .filter((t) => String(t.tanggalHari || '').slice(0, 10) === lokal)
        .reduce((s, t) => s + (Number(t.totalAkhir) || 0), 0)
      last7.push({ label: formatTanggal(key).slice(0, 5), value: sum })
    }

    return { omsetHariIni, jmlTransaksi, stokMenipis: stokMenipis.length, jmlProduk, last7, today }
  }, [transaksi, batches, produk, settings])

  const terakhir = useMemo(
    () => [...(transaksi || [])].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '')).slice(0, 6),
    [transaksi]
  )

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">
            Ringkasan operasional —{' '}
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn primary btn-lg" onClick={() => go('kasir')}>
            🔥 Mulai Kasir
          </button>
        </div>
      </div>

      <div className="cards-grid">
        <StatCard
          label="Penjualan Hari Ini"
          value={formatRupiah(stats.omsetHariIni)}
          sub={`${stats.jmlTransaksi} transaksi`}
          tone="blue"
          icon={<Icon name="chart" size={20} />}
        />
        <StatCard
          label="Produk Aktif"
          value={stats.jmlProduk}
          sub="master produk di katalog"
          tone="green"
          icon={<Icon name="box" size={20} />}
        />
        <StatCard
          label="Perlu Perhatian (exp)"
          value={alertList.length}
          sub="mendekati / sudah kadaluarsa"
          tone="amber"
          icon={<Icon name="alert" size={20} />}
        />
        <StatCard
          label="Stok Menipis"
          value={stats.stokMenipis}
          sub={`batas rendah: ≤ ${settings.LOW_STOCK}`}
          tone="red"
          icon={<Icon name="bell" size={20} />}
        />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Penjualan 7 Hari Terakhir</h3>
            <span className="spacer" />
            <span className="chip" onClick={() => go('laporan')}>Laporan lengkap →</span>
          </div>
          <div className="chart-box">
            <BarChart data={stats.last7} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Peringatan Kadaluarsa</h3>
            <span className="spacer" />
            <span className="chip" onClick={() => go('peringatan')}>Lihat semua →</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Expire</th>
                  <th>Sisa</th>
                </tr>
              </thead>
              <tbody>
                {alertList.slice(0, 8).map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>{b.nama || `Produk #${b.produkId}`}</td>
                    <td>{b.tanggalExp}</td>
                    <td style={{ color: b.status.warna, fontWeight: 700 }}>
                      {hitungSisaHari(b.tanggalExp) < 0 ? `Lewat ${-hitungSisaHari(b.tanggalExp)} hr` : hitungSisaHari(b.tanggalExp) + ' hr'}
                    </td>
                  </tr>
                ))}
                {alertList.length === 0 && (
                  <tr>
                    <td colSpan="3">
                      <EmptyState title="Semua aman 🎉" sub="Tidak ada batch yang mendekati kadaluarsa." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Transaksi Terakhir</h3>
          <span className="spacer" />
          <span className="chip" onClick={() => go('riwayat')}>Riwayat →</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No. Transaksi</th>
                <th>Waktu</th>
                <th>Kasir</th>
                <th>Metode</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {terakhir.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.nomor}</td>
                  <td>{formatTanggal(t.tanggal, true)}</td>
                  <td>{t.kasirNama}</td>
                  <td>{namaMetode(t.metode)}</td>
                  <td className="right w-bold">{formatRupiah(t.totalAkhir)}</td>
                </tr>
              ))}
              {terakhir.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <EmptyState title="Belum ada transaksi" sub="Mulai transaksi pertama dari menu Kasir." />
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

function namaMetode(id) {
  return { tunai: 'Tunai', kartu: 'Kartu', qris: 'QRIS/E-Wallet' }[id] || id
}