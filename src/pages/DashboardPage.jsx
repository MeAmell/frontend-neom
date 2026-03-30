import { useState, useEffect, useCallback } from 'react'
import { fetchDashboard, downloadPDF } from '../utils/api'
import DonutChart from '../components/DonutChart'
import StageBar from '../components/StageBar'
import { RAGBadge, ProgressBar } from '../components/RAGBadge'

const REFRESH_INTERVAL = 60_000

// ── helper hitung D-day ───────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date(new Date().toDateString())
  return Math.round(diff / 86400000)
}

// ── Timeline Calendar ─────────────────────────────────────────────────────
function CalendarTimeline({ calendar = [] }) {
  const seen = new Set()
  const rows = calendar.filter(c => {
    const key = c.label + c.type
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {rows.map((c, i) => {
        const isToday  = c.type === 'today'
        const isGolive = c.type === 'golive'
        const isPast   = c.type === 'past'
        const d = daysUntil(c.date)
        const dateLabel = new Date(c.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8', minWidth: '52px', flexShrink: 0 }}>
              {dateLabel}
            </span>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: isGolive ? '#DC2626' : isToday ? '#F59E0B' : isPast ? '#16A34A' : '#CBD5E1',
              boxShadow: isToday ? '0 0 0 3px rgba(245,158,11,.25)' : 'none',
            }} />
            <span style={{
              fontSize: '12px', flex: 1,
              color: isGolive ? '#DC2626' : isToday ? '#0F172A' : isPast ? '#64748B' : '#475569',
              fontWeight: isToday || isGolive ? '600' : '400',
            }}>
              {c.label}
              {isToday && <span style={{ fontSize: '10px', marginLeft: '6px', color: '#F59E0B' }}>← hari ini</span>}
            </span>
            {isGolive && d !== null && (
              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', background: '#FEE2E2', color: '#DC2626', whiteSpace: 'nowrap' }}>
                D-{Math.abs(d)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── OJK 9 Aktivitas ───────────────────────────────────────────────────────
function OJKActivities({ activities = [] }) {
  const [open, setOpen] = useState(null)
  const statusStyle = {
    IN_PROGRESS: { bg: '#EFF6FF', color: '#1D4ED8', label: 'On Going' },
    NOT_STARTED: { bg: '#F8FAFC', color: '#64748B', label: 'Not Started'    },
    DONE:        { bg: '#F0FDF4', color: '#16A34A', label: 'Done'     },
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {activities.map((a) => {
        const isOpen = open === a.no
        const ss = statusStyle[a.status] || statusStyle.NOT_STARTED
        return (
          <div key={a.no}>
            <div
              onClick={() => setOpen(isOpen ? null : a.no)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px',
                borderRadius: isOpen ? '10px 10px 0 0' : '10px',
                background: isOpen ? '#F1F5F9' : '#F8FAFC',
                border: '1px solid #F1F5F9',
                cursor: 'pointer', transition: 'background .15s',
              }}
            >
              <div style={{
                width: '26px', height: '26px', borderRadius: '7px',
                background: '#01847C', color: '#fff', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700',
              }}>
                {a.no}
              </div>
              <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{a.name}</span>
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '99px', background: ss.bg, color: ss.color, whiteSpace: 'nowrap' }}>
                {ss.label}
              </span>
              <span style={{ fontSize: '12px', color: '#94A3B8', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', width: '14px', textAlign: 'center' }}>›</span>
            </div>
            {isOpen && (
              <div style={{ background: '#FAFAFA', border: '1px solid #F1F5F9', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '8px 14px 10px 50px' }}>
                {a.details.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: i < a.details.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#CBD5E1', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────
export default function DashboardPage({ user, onLogout }) {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [activeStage, setActiveStage] = useState(null)
  const [filterStage, setFilterStage] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await fetchDashboard(filterStage)
      setData(d)
      setLastRefresh(new Date())
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [filterStage])

  useEffect(() => {
    setLoading(true)
    load()
    const t = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(t)
  }, [load])

  const handleDownload = async () => {
    setDownloading(true)
    try { await downloadPDF() } finally { setDownloading(false) }
  }

  if (loading && !data) return <Skeleton />

  const o      = data?.overall || {}
  const stages = data?.stages || []
  const detail = data?.detail_summary || []
  const ops    = data?.operational_readiness || []
  const daily  = data?.daily_execution || []
  const cal    = data?.calendar || []
  const acts   = data?.ojk_activities || []
  const goLive  = cal.find(c => c.type === 'golive')
  const dGoLive = goLive ? daysUntil(goLive.date) : null

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP NAV ── */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Logo tanpa import file gambar */}
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#01847C', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '13px',
          }}>BSI</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A', lineHeight: 1.2 }}>NEOM Dashboard</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Core Banking Upgrade</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#16A34A', borderRadius: '50%', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
            <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '600' }}>Live</span>
          </div>

          {lastRefresh && (
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>
              Update: {lastRefresh.toLocaleTimeString('id-ID')}
            </span>
          )}

          <button onClick={handleDownload} disabled={downloading} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', border: 'none', borderRadius: '10px',
            background: '#E8A030', color: '#fff', fontWeight: '600', fontSize: '13px',
            cursor: downloading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: downloading ? .7 : 1,
          }}>
            {downloading ? '⏳' : '⬇️'} Download PDF
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#F8FAFC', borderRadius: '10px', padding: '6px 12px',
            border: '1px solid #E2E8F0',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: '#01847C', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '11px',
            }}>
              {user?.name?.[0] || 'U'}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.2 }}>{user?.name}</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{user?.institution}</div>
            </div>
          </div>

          <button
            onClick={() => { sessionStorage.removeItem('neom_token'); onLogout() }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', border: '1.5px solid #FCA5A5', borderRadius: '10px',
              background: '#FFF1F1', color: '#DC2626', fontWeight: '700', fontSize: '13px',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFF1F1'; e.currentTarget.style.color = '#DC2626' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Keluar
          </button>
        </div>
      </nav>

      {/* ── HEADER BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #01847C 0%, #016860 50%, #0F172A 100%)',
        padding: '28px 32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .05,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ background: 'rgba(232,160,48,.2)', color: '#E8A030', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(232,160,48,.3)' }}>
                  CONFIDENTIAL
                </span>
                <span style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '600' }}>
                  {data?.location}
                </span>
              </div>
              <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-.5px', lineHeight: 1.1 }}>
                {data?.project_name}
              </h1>
              <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', marginTop: '6px' }}>
                Laporan Progress untuk Otoritas Jasa Keuangan (OJK)
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>LATEST UPDATE</div>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '13px', fontWeight: '500' }}>
                {data?.last_update ? new Date(data.last_update).toLocaleString('id-ID') : '—'}
              </div>
              {dGoLive !== null && (
                <div style={{
                  marginTop: '8px', display: 'inline-block',
                  background: 'rgba(220,38,38,.15)', color: '#FCA5A5',
                  padding: '4px 12px', borderRadius: '99px',
                  fontSize: '12px', fontWeight: '700',
                  border: '1px solid rgba(220,38,38,.3)',
                }}>
                  Go-Live D-{Math.abs(dGoLive)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <main id="dashboard-main" style={{ padding: '28px 32px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>

        {/* Stage filter pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[null, 0, 1, 2, 3, 4, 5].map(s => (
            <button key={s} onClick={() => setFilterStage(s)} style={{
              padding: '6px 16px', borderRadius: '99px', border: 'none',
              fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              background: filterStage === s ? '#01847C' : '#fff',
              color: filterStage === s ? '#fff' : '#64748B',
              boxShadow: filterStage === s ? '0 2px 8px rgba(1,132,124,.3)' : '0 1px 3px rgba(0,0,0,.08)',
              transition: 'all .2s',
            }}>
              {s === null ? 'Semua Stage' : `Stage ${s}`}
            </button>
          ))}
        </div>

        {/* ── ROW 1: Donut + KPI ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{
            background: '#fff', borderRadius: '20px', padding: '28px',
            boxShadow: '0 1px 8px rgba(0,0,0,.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', minWidth: '240px',
          }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', alignSelf: 'flex-start' }}>Upgrade Progress</div>
            <DonutChart completed={o.completed_pct || 0} inProgress={o.in_progress_pct || 0} notStarted={o.not_started_pct || 0} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Completed',   pct: o.completed_pct,   color: '#01847C' },
                { label: 'In Progress', pct: o.in_progress_pct, color: '#E8A030' },
                { label: 'Not Started', pct: o.not_started_pct, color: '#E2E8F0' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{(s.pct || 0).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {[
            { label: 'Total Tasks', value: (o.total_tasks || 0).toLocaleString(), icon: '📋', sub: `${o.completed_count || 0} selesai`, color: '#01847C' },
            { label: 'Completed',   value: `${(o.completed_pct || 0).toFixed(1)}%`, icon: '✅', sub: `${o.completed_count || 0} tasks`, color: '#16A34A' },
            { label: 'In Progress', value: `${(o.in_progress_pct || 0).toFixed(1)}%`, icon: '⚙️', sub: `${o.in_progress_count || 0} tasks`, color: '#E8A030' },
          ].map((k, i) => (
            <div key={k.label} style={{
              background: '#fff', borderRadius: '20px', padding: '28px',
              boxShadow: '0 1px 8px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: k.color }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</p>
                  <p style={{ fontSize: '36px', fontWeight: '800', color: '#0F172A', lineHeight: 1 }}>{k.value}</p>
                  <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '8px' }}>{k.sub}</p>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: `${k.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                  {k.icon}
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <ProgressBar value={parseFloat(k.value) || (k.label === 'Total Tasks' ? 100 : 0)} color={k.color} />
              </div>
            </div>
          ))}
        </div>

        {/* ── ROW 2: Stage Progress ── */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Stage Progress</h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
              {[{ color: '#01847C', label: 'Completed' }, { color: '#E8A030', label: 'In Progress' }, { color: '#E2E8F0', label: 'Not Started' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748B' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color, display: 'inline-block' }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stages.map(s => (
              <StageBar key={s.id} stage={s} active={activeStage?.id === s.id}
                onClick={st => setActiveStage(activeStage?.id === st.id ? null : st)} />
            ))}
          </div>
        </div>

        {/* ── ROW 3 BARU: Timeline + OJK Activities ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Timeline NEOM</h2>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>Mar–Mei 2026</span>
            </div>
            <CalendarTimeline calendar={cal} />
          </div>

          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>9 Aktivitas Utama OJK</h2>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>klik untuk detail teknis</span>
            </div>
            <OJKActivities activities={acts} />
          </div>
        </div>

        {/* ── ROW 4: Detail Summary + Operational Readiness ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Detail Summary</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
                  {['Area', 'Status', 'Progress', 'Notes'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 4px', fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {detail.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '10px 4px', fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{d.area}</td>
                    <td style={{ padding: '10px 4px' }}><RAGBadge status={d.status} /></td>
                    <td style={{ padding: '10px 4px', width: '100px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ flex: 1 }}>
                          <ProgressBar value={d.progress} color={d.status === 'GREEN' ? '#16A34A' : d.status === 'RED' ? '#DC2626' : '#D97706'} height={6} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', whiteSpace: 'nowrap' }}>{d.progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 4px', fontSize: '12px', color: '#64748B' }}>{d.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Operational Readiness</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ops.map((op, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9',
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#0F172A' }}>{op.area}</div>
                    {op.notes && <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{op.notes}</div>}
                  </div>
                  <RAGBadge status={op.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 5: Daily Execution ── */}
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Daily Execution Plan — Core Banking Upgrade</h2>
            <span style={{ background: '#01847C', color: '#fff', borderRadius: '99px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>
              {daily.filter(d => d.status === 'DONE').length}/{daily.length} Done
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {daily.map((task, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9',
              }}>
                <span style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  background: task.status === 'DONE' ? '#DCFCE7' : task.status === 'IN_PROGRESS' ? '#FEF3C7' : '#F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: '800', color: '#64748B',
                }}>
                  {task.status === 'DONE' ? '✓' : task.no}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#0F172A', textDecoration: task.status === 'DONE' ? 'line-through' : 'none' }}>
                    {task.task}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>PIC: {task.pic}</div>
                </div>
                <RAGBadge status={task.status} />
              </div>
            ))}
          </div>
        </div>

      </main>

      <footer style={{ padding: '16px 32px', borderTop: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>© 2026 Bank Syariah Indonesia · Dokumen Rahasia</span>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Data diperbarui setiap 60 detik</span>
      </footer>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>
    </div>
  )
}

function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', padding: '32px' }}>
      <div style={{ height: '64px', background: '#fff', borderRadius: '12px', marginBottom: '24px', opacity: .5 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '160px', background: '#fff', borderRadius: '20px', opacity: .5 }} />
        ))}
      </div>
    </div>
  )
}