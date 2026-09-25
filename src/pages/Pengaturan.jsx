import { useState } from 'react'
import { db } from '../db'
import { DEFAULT_SETTINGS } from '../helpers'
import { Icon } from '../components/icons'
import { useSettings } from '../App'

export default function Pengaturan({ settings, user }) {
  const [draft, setDraft] = useState(() => ({
    TOKO_NAMA: settings.TOKO_NAMA,
    TOKO_ALAMAT: settings.TOKO_ALAMAT,
    TOKO_HP: settings.TOKO_HP,
    THRESHOLD_WARNING: settings.THRESHOLD_WARNING,
    THRESHOLD_URGENT: settings.THRESHOLD_URGENT,
    LOW_STOCK: settings.LOW_STOCK,
    POIN_PER: settings.POIN_PER
  }))
  const [pesan, setPesan] = useState('')

  function set(key, value) {
    setDraft((d) => ({ ...d, [key]: value }))
    setPesan('')
  }

  async function handleSave() {
    for (const [key, value] of Object.entries(draft)) {
      await db.pengaturan.put({ key, value })
    }
    setPesan('Pengaturan berhasil disimpan ✓')
  }

  const isAdmin = user && user.role === 'admin'

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Pengaturan</div>
          <div className="page-sub">Konfigurasi toko & ambang batas kadaluarsa</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={handleSave}>
            <Icon name="gear" size={16} /> Simpan
          </button>
        </div>
      </div>

      {pesan && <div className="alert-banner warn" style={{ marginBottom: 14 }}>{pesan}</div>}

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><h3>Profil Toko</h3></div>
          <div className="field">
            <label>Nama Toko</label>
            <input className="inp" value={draft.TOKO_NAMA} onChange={(e) => set('TOKO_NAMA', e.target.value)} />
          </div>
          <div className="field">
            <label>Alamat</label>
            <input className="inp" value={draft.TOKO_ALAMAT} onChange={(e) => set('TOKO_ALAMAT', e.target.value)} />
          </div>
          <div className="field">
            <label>No. HP</label>
            <input className="inp" value={draft.TOKO_HP} onChange={(e) => set('TOKO_HP', e.target.value)} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Ambang Batas Kadaluarsa & Stok</h3></div>
          <div className="grid-2">
            <div className="field">
              <label>Peringatan (H-X)</label>
              <input className="inp" type="number" min="0" value={draft.THRESHOLD_WARNING} onChange={(e) => set('THRESHOLD_WARNING', Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Mendesak (H-X)</label>
              <input className="inp" type="number" min="0" value={draft.THRESHOLD_URGENT} onChange={(e) => set('THRESHOLD_URGENT', Number(e.target.value))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Stok Menipis (≤)</label>
              <input className="inp" type="number" min="0" value={draft.LOW_STOCK} onChange={(e) => set('LOW_STOCK', Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Poin per (Rp)</label>
              <input className="inp" type="number" min="1" value={draft.POIN_PER} onChange={(e) => set('POIN_PER', Number(e.target.value))} />
            </div>
          </div>
          <div style={{ color: 'var(--text-light)', fontSize: 12, marginTop: 4 }}>
            Peringatan harus lebih besar dari nilai mendesak. Default: {DEFAULT_SETTINGS.THRESHOLD_WARNING} hari / {DEFAULT_SETTINGS.THRESHOLD_URGENT} hari.
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div className="card">
          <EmptyState title="Akses terbatas" sub="Hanya akun administrator yang dapat mengubah pengaturan toko." />
        </div>
      )}
    </div>
  )
}
