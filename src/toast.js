// ============================================================
// Toast notifikasi sederhana (tanpa dependensi)
// ============================================================

let container = null

function ensureContainer() {
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }
  return container
}

export function toast(message, type = 'info', durasi = 3200) {
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  el.textContent = message
  ensureContainer().appendChild(el)
  setTimeout(() => {
    el.classList.add('toast-out')
    setTimeout(() => el.remove(), 250)
  }, durasi)
}