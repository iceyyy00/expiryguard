import { IconX } from './icons'

export function Modal({ title, onClose, children, foot, wide, narrow }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}${narrow ? ' narrow' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            <IconX size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function Pill({ status }) {
  if (!status) return null
  return (
    <span className="pill" style={{ background: status.warnaBg, color: status.warna }}>
      <span className="dot" />
      {status.label}
    </span>
  )
}

export function StatCard({ label, value, sub, icon, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className={`stat-icon ${tone || 'blue'}`}>{icon}</span>}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function EmptyState({ title, sub }) {
  return (
    <div className="empty">
      <div className="em-ic">📦</div>
      <div className="em-title">{title || 'Belum ada data'}</div>
      {sub && <div className="em-sub">{sub}</div>}
    </div>
  )
}

// Bar chart ringan berbasis SVG (tanpa pustaka)
export function BarChart({ data, color = 'var(--primary)', tinggi = 130 }) {
  const max = Math.max(1, ...data.map((d) => Number(d.value) || 0))
  const w = 700
  const h = tinggi + 26
  const n = data.length
  const bw = Math.max(8, Math.min(34, (w - (n - 1) * 6) / n))
  const gapSlot = (w - n * bw) / Math.max(1, n - 1)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1="0"
          x2={w}
          y1={tinggi - tinggi * f}
          y2={tinggi - tinggi * f}
          stroke="#eef2f7"
          strokeDasharray="4 4"
        />
      ))}
      {data.map((d, i) => {
        const bh = Math.max(2, (Number(d.value) || 0) / max * tinggi)
        const x = i * (bw + gapSlot)
        const y = tinggi - bh
        const isWarn = d.color !== undefined
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={bw}
              height={bh}
              rx="4"
              fill={isWarn ? d.color : color}
              opacity={isWarn ? 0.95 : 0.9}
            >
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            <text x={x + bw / 2} y={h - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Donut KPI kecil (persentase)
export function Donut({ pct, color = 'var(--success)' }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#eef2f7" strokeWidth="8" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, Math.max(0, pct)) / 100) * c} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}