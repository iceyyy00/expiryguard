import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Icon, IconPlus, IconEdit, IconTrash } from '../components/icons'
import { EmptyState, Modal } from '../components/ui'
import { toast } from '../toast'

export default function Pengaturan({ settings, user }) {
  const penggunaList = useLiveQuery(() => db.pengguna.toArray(), [])

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

  // State Modal Pengguna
  const [showTambahUser, setShowTambahUser] = useState(false)
  const [editUserTarget, setEditUserTarget] = useState(null)

  function set(key, value) {
    setDraft((d) => ({ ...d, [key]: value }))
    setPesan('')
  }

  async function handleSave() {
    for (const [key, value] of Object.entries(draft)) {
      await db.pengaturan.put({ key, value })
    }
    setPesan('Pengaturan berhasil disimpan ✓')
    toast('Pengaturan toko berhasil diperbarui!', 'success')
  }

  // Toggle status aktif akun pengguna
  async function toggleStatusUser(u) {
    if (u.id === user?.id) {
      toast('Anda tidak dapat menonaktifkan akun yang sedang digunakan saat ini', 'warn')
      return
    }
    const statusBaru = u.aktif ? 0 : 1
    await db.pengguna.update(u.id, { aktif: statusBaru })
    toast(`Akun "${u.username}" telah ${statusBaru ? 'diaktifkan' : 'dinonaktifkan'}.`, 'info')
  }

  // Hapus akun pengguna
  async function hapusUser(u) {
    if (u.id === user?.id) {
      toast('Anda tidak dapat menghapus akun yang sedang login saat ini', 'warn')
      return
    }
    if (window.confirm(`Yakin ingin menghapus akun "${u.username}" (${u.nama})?`)) {
      await db.pengguna.delete(u.id)
      toast(`Akun "${u.username}" berhasil dihapus`, 'success')
    }
  }

  const isAdmin = user && user.role === 'admin'

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Pengaturan & Manajemen Akun</div>
          <div className="page-sub">Konfigurasi toko, ambang batas kadaluarsa, dan akun kasir/admin</div>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button className="btn primary" onClick={handleSave}>
              <Icon name="gear" size={16} /> Simpan Pengaturan
            </button>
          </div>
        )}
      </div>

      {pesan && <div className="alert-banner warn" style={{ marginBottom: 14 }}>{pesan}</div>}

      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Profil Toko</h3>
          </div>
          <div className="card-body">
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Nama Toko</label>
              <input
                className="inp"
                disabled={!isAdmin}
                value={draft.TOKO_NAMA || ''}
                onChange={(e) => set('TOKO_NAMA', e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Alamat Toko</label>
              <input
                className="inp"
                disabled={!isAdmin}
                value={draft.TOKO_ALAMAT || ''}
                onChange={(e) => set('TOKO_ALAMAT', e.target.value)}
              />
            </div>
            <div className="field">
              <label>No. HP / WhatsApp Toko</label>
              <input
                className="inp"
                disabled={!isAdmin}
                value={draft.TOKO_HP || ''}
                onChange={(e) => set('TOKO_HP', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Ambang Batas Kadaluarsa & Stok</h3>
          </div>
          <div className="card-body">
            <div className="grid-2" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Peringatan (H-X)</label>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  disabled={!isAdmin}
                  value={draft.THRESHOLD_WARNING || 30}
                  onChange={(e) => set('THRESHOLD_WARNING', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Mendesak (H-X)</label>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  disabled={!isAdmin}
                  value={draft.THRESHOLD_URGENT || 7}
                  onChange={(e) => set('THRESHOLD_URGENT', Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Stok Menipis (≤)</label>
                <input
                  className="inp"
                  type="number"
                  min="0"
                  disabled={!isAdmin}
                  value={draft.LOW_STOCK || 3}
                  onChange={(e) => set('LOW_STOCK', Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Poin per (Rp)</label>
                <input
                  className="inp"
                  type="number"
                  min="1"
                  disabled={!isAdmin}
                  value={draft.POIN_PER || 10000}
                  onChange={(e) => set('POIN_PER', Number(e.target.value))}
                />
              </div>
            </div>
            <div style={{ color: 'var(--text-light)', fontSize: 12, marginTop: 8 }}>
              Status kadaluarsa: H-{draft.THRESHOLD_WARNING} (Kuning/Segera), H-{draft.THRESHOLD_URGENT} (Oranye/Mendesak), Lewat tanggal (Merah/Kadaluarsa).
            </div>
          </div>
        </div>
      </div>

      {/* Bagian Manajemen Akun Kasir & Pengguna (Admin) */}
      <div className="card">
        <div className="card-head">
          <h3>Manajemen Akun Kasir & Administrator</h3>
          <span className="spacer" />
          {isAdmin && (
            <button className="btn primary sm" onClick={() => setShowTambahUser(true)}>
              <IconPlus size={14} /> Tambah Akun Baru
            </button>
          )}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>Username</th>
                <th>Hak Akses (Role)</th>
                <th>Status Akun</th>
                {isAdmin && <th className="right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {(penggunaList || []).map((u) => {
                const isCurrent = u.id === user?.id
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {u.nama} {isCurrent && <span style={{ color: 'var(--primary)', fontSize: 12 }}>(Anda)</span>}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{u.username}</td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          background: u.role === 'admin' ? 'var(--primary-bg)' : '#f1f5f9',
                          color: u.role === 'admin' ? 'var(--primary)' : 'var(--text)'
                        }}
                      >
                        {u.role === 'admin' ? '👑 Administrator' : '🛒 Kasir'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          background: u.aktif ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: u.aktif ? 'var(--success)' : 'var(--danger)'
                        }}
                      >
                        {u.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="right">
                        <button
                          className="btn ghost sm"
                          onClick={() => setEditUserTarget(u)}
                          title="Ubah data / password"
                          style={{ marginRight: 4 }}
                        >
                          <IconEdit size={14} /> Edit
                        </button>
                        <button
                          className="btn ghost sm"
                          onClick={() => toggleStatusUser(u)}
                          disabled={isCurrent}
                          title={u.aktif ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                          style={{ marginRight: 4 }}
                        >
                          {u.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => hapusUser(u)}
                          disabled={isCurrent}
                          title="Hapus akun"
                          style={{ color: 'var(--danger)' }}
                        >
                          <IconTrash size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!isAdmin && (
        <div className="card">
          <EmptyState
            title="Akses terbatas"
            sub="Hanya akun administrator yang dapat mengubah pengaturan profil toko dan akun kasir."
          />
        </div>
      )}

      {/* Modal Tambah User Baru */}
      {showTambahUser && (
        <ModalTambahUser
          onClose={() => setShowTambahUser(false)}
          onSuccess={() => setShowTambahUser(false)}
        />
      )}

      {/* Modal Edit User */}
      {editUserTarget && (
        <ModalEditUser
          userItem={editUserTarget}
          onClose={() => setEditUserTarget(null)}
          onSuccess={() => setEditUserTarget(null)}
        />
      )}
    </div>
  )
}

function ModalTambahUser({ onClose, onSuccess }) {
  const [nama, setNama] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('kasir')
  const [sibuk, setSibuk] = useState(false)

  async function handleSimpan(e) {
    e.preventDefault()
    if (!nama.trim() || !username.trim() || !password.trim()) {
      toast('Semua kolom wajib diisi', 'warn')
      return
    }

    setSibuk(true)
    try {
      const ada = await db.pengguna.where('username').equals(username.trim()).first()
      if (ada) {
        toast(`Username "${username}" sudah digunakan!`, 'error')
        setSibuk(false)
        return
      }

      await db.pengguna.add({
        nama: nama.trim(),
        username: username.trim().toLowerCase(),
        password: password.trim(),
        role,
        aktif: 1
      })

      toast(`Akun kasir/admin "${username}" berhasil dibuat!`, 'success')
      onSuccess()
    } catch (err) {
      toast('Gagal menambahkan pengguna: ' + err.message, 'error')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      title="Tambah Akun Pengguna / Kasir Baru"
      onClose={onClose}
      narrow
      foot={
        <>
          <button className="btn ghost" disabled={sibuk} onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" disabled={sibuk} onClick={handleSimpan}>
            {sibuk ? 'Menyimpan...' : 'Simpan Akun'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSimpan}>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>
            Nama Lengkap Petugas <span className="req">*</span>
          </label>
          <input
            className="inp"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Contoh: Kasir Siang"
            autoFocus
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>
            Username Login <span className="req">*</span>
          </label>
          <input
            className="inp"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Contoh: kasir2"
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>
            Password <span className="req">*</span>
          </label>
          <input
            type="password"
            className="inp"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <div className="field">
          <label>Peran (Role)</label>
          <select className="inp" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="kasir">Kasir (Hanya POS, Peringatan & Riwayat)</option>
            <option value="admin">Administrator (Akses Penuh Semua Menu)</option>
          </select>
        </div>
      </form>
    </Modal>
  )
}

function ModalEditUser({ userItem, onClose, onSuccess }) {
  const [nama, setNama] = useState(userItem.nama || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(userItem.role || 'kasir')
  const [sibuk, setSibuk] = useState(false)

  async function handleSimpan(e) {
    e.preventDefault()
    if (!nama.trim()) {
      toast('Nama wajib diisi', 'warn')
      return
    }

    setSibuk(true)
    try {
      const updateData = {
        nama: nama.trim(),
        role
      }
      if (password.trim()) {
        updateData.password = password.trim()
      }

      await db.pengguna.update(userItem.id, updateData)
      toast(`Data pengguna "${userItem.username}" berhasil diperbarui!`, 'success')
      onSuccess()
    } catch (err) {
      toast('Gagal memperbarui pengguna: ' + err.message, 'error')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <Modal
      title={`Edit Akun: ${userItem.username}`}
      onClose={onClose}
      narrow
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
        <div className="field" style={{ marginBottom: 12 }}>
          <label>
            Nama Lengkap <span className="req">*</span>
          </label>
          <input
            className="inp"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>Ganti Password (kosongkan jika tidak diubah)</label>
          <input
            type="password"
            className="inp"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ketik password baru..."
          />
        </div>
        <div className="field">
          <label>Peran (Role)</label>
          <select className="inp" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="kasir">Kasir</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
      </form>
    </Modal>
  )
}

