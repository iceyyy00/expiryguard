import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatRupiah, formatTanggal, exportCSV } from '../helpers'
import { StatCard, BarChart, EmptyState } from '../components/ui'
import { Icon } from '../components/icons'

const PERIODE = [
  { id: 'today', label: 'Hari Ini' },
  { id: '7', label: '7 Hari' },
  { id: '30', label: '30 Hari' }
]

export default function Laporan({ settings }) {
  const [periode, setPeriode] = useState('7')
  const transaksi = useLiveQuery(() => db.transaksi.toArray(), [])
  const riwayat = useLiveQuery(() => db.riwayatStok.toArray(), [])
  const produk = useLiveQuery(() => db.produk.toArray(), [])

  const data = useMemo(() => {
    const now = new Date()
    let start
    if (periode === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else {
      start = new Date(now)
      start.setDate(start.getDate() - Number(periode))
    }
    const cutoff = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`

    const txs = (transaksi || []).filter((t) => String(t.tanggal || '').slice(0, 10) >= cutoff)
    const omset = txs.reduce((s, t) => s + (Number(t.totalAkhir) || 0), 0)
    const jmlTransaksi = txs.length
    const jmlItem = txs.reduce((s, t) => s + (t.items || []).reduce((a, i) => a + (Number(i.qty) || 0), 0), 0)

    const losses = (riwayat || [])
      .filter((r) => r.tanggal >= cutoff && (r.tipe === 'kadaluarsa' || r.tipe === 'rusak'))
      .reduce((s, r) => s + (Number(r.jumlah) || 0), 0)

    const byHari = new Map()
    for (const t of txs) {
      const key = String(t.tanggal || '').slice(0, 10)
      byHari.set(key, (byHari.get(key) || 0) + (Number(t.totalAkhir) || 0))
    }
    const chart = [...byHari.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({
      label: formatTanggal(k).slice(0, 5),
      value: v
    }))

    return { omset, jmlTransaksi, jmlItem, losses, chart }
  }, [transaksi, riwayat, periode])

  function handleExport() {
    const txs = [...(transaksi || [])].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''))
    exportCSV(
      'laporan-penjualan.csv',
      ['No. Transaksi', 'Tanggal', 'Kasir', 'Metode', 'Jumlah Item', 'Diskon (%)', 'Total'],
      txs.map((t) => [
        t.nomor,
        formatTanggal(t.tanggal, true),
        t.kasirNama,
        t.metode,
        (t.items || []).reduce((s, i) => s + (Number(i.qty) || 0), 0),
        Number(t.diskon) || 0,
        Number(t.totalAkhir) || 0
      ])
    )
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Laporan</div>
          <div className="page-sub">Ringkasan penjualan & kerugian stok</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            {PERIODE.map((p) => (
              <button key={p.id} className={`seg-item${periode === p.id ? ' active' : ''}`} onClick={() => setPeriode(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <button className="btn ghost" onClick={handleExport}>
            <Icon name="print" size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="cards-grid">
        <StatCard label="Omzet" value={formatRupiah(data.omset)} sub={`${data.jmlTransaksi} transaksi`} tone="blue" icon={<Icon name="chart" size={20} />} />
        <StatCard label="Item Terjual" value={data.jmlItem} sub="unit terjual" tone="green" icon={<Icon name="cart" size={20} />} />
        <StatCard label="Kerugian (exp/rusak)" value={formatRupiah(data.losses)} sub="unit ditarik / rusak" tone="red" icon={<Icon name="alert" size={20} />} />
        <StatCard label="Produk Aktif" value={(produk || []).filter((p) => p.aktif).length} sub="di katalog" tone="amber" icon={<Icon name="box" size={20} />} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Penjualan per Hari</h3></div>
          <div className="chart-box">
            {data.chart.length > 0 ? <BarChart data={data.chart} /> : <EmptyState title="Belum ada data" sub="Tidak ada penjualan pada periode ini." />}
          </div>
        </div>
      </div>
    </div>
  )
}
