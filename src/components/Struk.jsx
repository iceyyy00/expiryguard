import { formatRupiah, formatTanggal, namaMetode } from '../helpers'

// ============================================================
// Struk belanja — tampil di layar & dicetak via window.print()
// ============================================================

export default function Struk({ transaksi, settings }) {
  if (!transaksi) return null
  const t = transaksi
  const nama = settings.TOKO_NAMA || 'ExpiryGuard Store'

  return (
    <div className="struk">
      <div className="st-head">
        <h4>{nama}</h4>
        <div>{settings.TOKO_ALAMAT}</div>
        <div>Telp: {settings.TOKO_HP}</div>
      </div>
      <hr />
      <div>
        <b>No:</b> {t.nomor}
        <br />
        <b>Tanggal:</b> {formatTanggal(t.tanggal, true)}
        <br />
        <b>Kasir:</b> {t.kasirNama}
        {t.pelangganNama && (
          <>
            <br />
            <b>Pelanggan:</b> {t.pelangganNama}
          </>
        )}
      </div>
      <hr />
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nama</th>
            <th style={{ textAlign: 'right' }}>Hrg</th>
            <th style={{ textAlign: 'right' }}>Jml</th>
            <th style={{ textAlign: 'right' }}>Sub</th>
          </tr>
        </thead>
        <tbody>
          {(t.items || []).map((it, i) => (
            <tr key={i} className="st-row">
              <td>{it.nama}</td>
              <td className="num">{formatRupiah(it.hargaJual)}</td>
              <td className="num">{it.qty}</td>
              <td className="num">{formatRupiah(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {t.diskon > 0 && (
            <tr className="st-row">
              <td colSpan="3">Diskon</td>
              <td className="num">-{formatRupiah(((t.subtotal || 0) * t.diskon) / 100)}</td>
            </tr>
          )}
          {(t.items || []).length > 0 && (
            <tr className="st-total">
              <td colSpan="3">TOTAL</td>
              <td className="num">{formatRupiah(t.totalAkhir)}</td>
            </tr>
          )}
          <tr className="st-row">
            <td colSpan="3">Bayar ({namaMetode(t.metode)})</td>
            <td className="num">{formatRupiah(t.dibayar)}</td>
          </tr>
          <tr className="st-row">
            <td colSpan="3">Kembalian</td>
            <td className="num">{formatRupiah(t.kembalian)}</td>
          </tr>
        </tfoot>
      </table>
      <hr />
      <div className="st-foot">
        Terima kasih! Barang yang sudah dibeli
        <br />
        tidak dapat dikembalikan.
        <br />
        <b>• Print No. {t.nomor} •</b>
      </div>
    </div>
  )
}