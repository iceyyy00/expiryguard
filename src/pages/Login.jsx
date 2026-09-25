import { useState } from 'react'
import { db } from '../db'
import { sessionStore } from '../session'
import { Icon } from '../components/icons'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSibuk(true)

    try {
      const pengguna = await db.pengguna.where('username').equals(username.trim()).first()
      if (!pengguna || pengguna.password !== password || !pengguna.aktif) {
        setError('Username atau password salah, atau akun dinonaktifkan.')
      } else {
        sessionStore.setUser({ ...pengguna, password: undefined })
      }
    } catch {
      setError('Gagal mengambil data pengguna.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-logo">
          <span className="logo-ic">
            <Icon name="alert" size={22} />
          </span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.2 }}>ExpiryGuard</div>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>POS & Manajemen Kadaluarsa</div>
          </div>
        </div>
        <div className="sub">Masuk untuk mulai melayani transaksi</div>

        {error && <div className="alert-banner danger" style={{ marginBottom: 14 }}>{error}</div>}

        <div className="field" style={{ marginBottom: 12 }}>
          <label>Username</label>
          <input
            className="inp"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin / kasir"
            autoFocus
            required
          />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>Password</label>
          <input
            className="inp"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn primary block btn-lg" disabled={sibuk}>
          {sibuk ? 'Memeriksa...' : 'Masuk'}
        </button>

        <div className="login-hint">
          <b>Akun demo:</b> admin / <b>admin123</b> · kasir / <b>kasir123</b>
        </div>
      </form>
    </div>
  )
}