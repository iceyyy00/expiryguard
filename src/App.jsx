import { useEffect, useMemo, useState } from 'react'
import { seedData } from './seed'
import { useSession, sessionStore } from './session'
import { useSettings, useAlerts } from './hooks'
import { Icon } from './components/icons'
import Dashboard from './pages/Dashboard'
import Kasir from './pages/Kasir'
import Produk from './pages/Produk'
import Peringatan from './pages/Peringatan'
import Stok from './pages/Stok'
import Riwayat from './pages/Riwayat'
import Laporan from './pages/Laporan'
import Pengaturan from './pages/Pengaturan'
import Login from './pages/Login'

// ---- Inisialisasi seed sekali saat app pertama dibuka ----
seedData()

const halamanKasir = ['dashboard', 'kasir', 'peringatan', 'riwayat']

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'kasir', label: 'Kasir', icon: 'cart' },
  { id: 'produk', label: 'Produk', icon: 'box' },
  { id: 'peringatan', label: 'Kadaluarsa', icon: 'alert' },
  { id: 'stok', label: 'Stok', icon: 'plus' },
  { id: 'riwayat', label: 'Transaksi', icon: 'clock' },
  { id: 'laporan', label: 'Laporan', icon: 'chart' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'gear' }
]

function App() {
  const [page, setPage] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const user = useSession()
  const settings = useSettings()
  const { list, count } = useAlerts()

  const menu = useMemo(
    () => (user && user.role === 'kasir' ? MENU.filter((m) => halamanKasir.includes(m.id)) : MENU),
    [user]
  )

  useEffect(() => {
    document.body.classList.toggle('printing', false)
  }, [])

  const banner = !bannerDismissed && (list[0]?.status?.level === 'expired' ? 'expired' : list.length > 0 ? 'warn' : null)

  function go(p) {
    setPage(p)
    setSidebarOpen(false)
  }

  if (!user) return <Login />

  return (
    <div className="app">
      {sidebarOpen && <div className="overlay-dim" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="logo-ic">
            <Icon name="alert" size={20} />
          </span>
          <div>
            <div className="brand-name">ExpiryGuard</div>
            <div className="brand-tag">Kasir & Kadaluarsa</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-label">Menu</div>
          {menu.map((m) => (
            <button key={m.id} className={`nav-item${page === m.id ? ' active' : ''}`} onClick={() => go(m.id)}>
              <Icon name={m.icon} size={18} />
              {m.label}
              {m.id === 'peringatan' && count > 0 && <span className="nav-badge">{count}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
            {user.nama?.charAt(0) || 'U'}
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{user.nama}</div>
            <div>{user.role === 'admin' ? 'Administrator' : 'Kasir'}</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost btn-menu" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
            ☰
          </button>
          <h2>
            {menu.find((m) => m.id === page)?.label || 'Dashboard'}
          </h2>
          <span className="spacer" />
          <button className="bell" onClick={() => go('peringatan')} aria-label="Notifikasi">
            <Icon name="bell" size={20} />
            {count > 0 && <span className="badge-count">{count}</span>}
          </button>
          <div className="user-chip">
            <span className="avatar">{user.nama?.charAt(0) || 'U'}</span>
            <div className="user-meta">
              <div className="nm">{user.nama}</div>
              <div className="rl">{user.role === 'admin' ? 'Administrator' : 'Kasir'}</div>
            </div>
          </div>
          <button className="btn ghost sm" onClick={() => sessionStore.clear()} title="Keluar">
            <Icon name="logout" size={16} />
            Keluar
          </button>
        </header>

        <main className="page">
          {banner && (
            <div className={`alert-banner ${banner}`}>
              <Icon name="alert" size={20} />
              <span>
                {banner === 'expired'
                  ? `⚠️ Ada ${count} batch produk yang sudah KADALUARSA — segera tarik dari rak!`
                  : `🔔 ${count} batch produk butuh perhatian (mendekati/melewati tanggal kadaluarsa).`}
              </span>
              <button className="close" onClick={() => setBannerDismissed(true)}>
                ✕
              </button>
            </div>
          )}

          {page === 'dashboard' && <Dashboard go={go} />}
          {page === 'kasir' && <Kasir settings={settings} user={user} go={go} />}
          {page === 'produk' && <Produk settings={settings} user={user} go={go} />}
          {page === 'peringatan' && <Peringatan settings={settings} />}
          {page === 'stok' && <Stok settings={settings} />}
          {page === 'riwayat' && <Riwayat />}
          {page === 'laporan' && <Laporan settings={settings} />}
          {page === 'pengaturan' && <Pengaturan settings={settings} user={user} />}
        </main>
      </div>
    </div>
  )
}

export default App