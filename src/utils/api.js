const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function token() { return sessionStorage.getItem('neom_token') }

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...opts.headers,
    },
    ...opts,
  })
  if (res.status === 401) {
    sessionStorage.removeItem('neom_token')
    sessionStorage.removeItem('neom_user')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res
}

export async function login(username, password) {
  const res = await req('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export async function fetchDashboard(stage) {
  const url = stage != null ? `/api/dashboard?stage=${stage}` : '/api/dashboard'
  const res = await req(url)
  return res.json()
}

// ── TAMBAHAN: Branch Testing ──────────────────────────────────────────────
export async function fetchBranchTesting() {
  const res = await req('/api/branch-testing')
  return res.json()
}

export async function downloadPDF() {
  const { default: jsPDF } = await import('jspdf')
  const { default: html2canvas } = await import('html2canvas')

  const element = document.getElementById('dashboard-main')
  const scrollX = window.scrollX
  const scrollY = window.scrollY
  window.scrollTo(0, 0)
  await new Promise(r => setTimeout(r, 300))

  const canvas = await html2canvas(element, {
    scale: 1.5, useCORS: true, backgroundColor: '#F0F4F8',
    scrollX: 0, scrollY: 0, x: 0, y: 0,
    width: element.scrollWidth, height: element.scrollHeight,
    windowWidth: element.scrollWidth, windowHeight: element.scrollHeight,
    logging: false,
  })

  window.scrollTo(scrollX, scrollY)
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'l' : 'p',
    unit: 'px', format: [canvas.width / 1.5, canvas.height / 1.5], compress: true,
  })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 1.5, canvas.height / 1.5)
  pdf.save(`NEOM_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`)
}
// ── FDR Progress (Excel) ──────────────────────────────────────────────────────
export async function fetchFDRProgress({ stage, timeline, status } = {}) {
  const params = new URLSearchParams()
  if (stage)    params.set('stage', stage)
  if (timeline) params.set('timeline', timeline)
  if (status)   params.set('status', status)
  const qs = params.toString()
  const res = await req(`/api/fdr-progress${qs ? '?' + qs : ''}`)
  return res.json()
}

export async function fetchFDRStages() {
  const res = await req('/api/fdr-progress/stages')
  return res.json()
}

export async function reloadFDR() {
  const res = await req('/api/fdr-progress/reload', { method: 'POST' })
  return res.json()
}