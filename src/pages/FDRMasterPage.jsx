import React, { useState, useEffect, useCallback } from 'react'
import { RAGBadge, ProgressBar } from '../components/RAGBadge'
import { fetchFDRProgress, reloadFDR } from '../utils/api'

const REFRESH_INTERVAL = 60_000

// ── Status helpers ────────────────────────────────────────────────────────────
function statusStyle(s = '') {
  const sl = (s || '').toLowerCase()
  if (sl.includes('not started')) return { bg: '#FEE2E2', color: '#991B1B', dot: '#DC2626' }
  if (sl.includes('n/a'))         return { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' }
  if (sl.includes('#ref'))        return { bg: '#FEF3C7', color: '#92400E', dot: '#D97706' }
  if (sl.includes('delayed'))     return { bg: '#FEF3C7', color: '#92400E', dot: '#D97706' }
  if (sl.includes('ahead'))       return { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' }
  if (sl.includes('on-track'))    return { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6' }
  if (sl.includes('in progress')) return { bg: '#FEF9C3', color: '#854D0E', dot: '#F59E0B' }
  if (sl.includes('done'))        return { bg: '#DCFCE7', color: '#166534', dot: '#16A34A' }
  return { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8' }
}

function StatusPill({ label }) {
  const s = statusStyle(label)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: s.bg, color: s.color, borderRadius: '99px',
      padding: '3px 10px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ── Helpers: parse datetime string ─────────────────────────────────────────────
// FIX: handle "00:00:00" bare-time from Excel (In Progress rows have no actual end)
function parseDate(str) {
  if (!str) return null
  // Bare time strings from Excel (e.g. "00:00:00", "0:00:00") → null
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(str).trim())) return null
  if (str === '00:00:00' || str === '0:00:00') return null
  if (str.includes('--') || str.includes('#')) return null
  const direct = new Date(str)
  if (!isNaN(direct.getTime())) {
    // Reject epoch-like dates from Excel time-only cells (year < 1970)
    if (direct.getFullYear() < 1970) return null
    return direct
  }
  // Try "dd/MM/yyyy HH:mm" format
  const [datePart, timePart] = str.split(' ')
  if (!datePart) return null
  const parts = datePart.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const result = new Date(`${y}-${m}-${d}T${timePart || '00:00'}`)
  return isNaN(result.getTime()) ? null : result
}

const STAGE_COLORS = {
  'STAGE 0': '#6366F1',
  'STAGE 1': '#0EA5E9',
  'STAGE 2': '#01847C',
  'STAGE 3': '#8B5CF6',
  'STAGE 4': '#E8A030',
  'STAGE 5': '#94A3B8',
}

// ── Delta Badge ────────────────────────────────────────────────────────────────
// FIX: Elapsed bar now uses excelProgress (Progress column from Excel, 0.0–1.0)
//      NOT time-based calculation. Ahead/Delay delta remains time-based (correct).
function DeltaBadge({ planStart, planEnd, actualStart, actualEnd, status, actStatus, excelProgress }) {
  const ps = parseDate(planStart), pe = parseDate(planEnd)
  const as = parseDate(actualStart), ae = parseDate(actualEnd)

  const fmtShort = d => d
    ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' '
      + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '—'

  // ── Compute time delta (Ahead / Delay) — unchanged, still time-based ──
  let deltaLabel = null
  let deltaStyle = {}
  let deltaIcon  = ''

  const isInProg = (actStatus || '').toLowerCase().includes('in progress')
  const isDone   = (actStatus || '').toLowerCase().includes('done')
  const refActual = isDone ? ae : isInProg ? new Date() : null

  if (ps && pe && refActual) {
    const deltaMs = refActual.getTime() - pe.getTime()
    const absMin  = Math.round(Math.abs(deltaMs) / 60000)
    const absHour = Math.floor(absMin / 60)
    const remMin  = absMin % 60
    const fmt = absHour > 0
      ? `${absHour}j ${remMin > 0 ? remMin + 'm' : ''}`.trim()
      : `${absMin}m`

    if (Math.abs(deltaMs) < 5 * 60000) {
      deltaLabel = 'On-track'
      deltaIcon  = '✓'
      deltaStyle = { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' }
    } else if (deltaMs < 0) {
      deltaLabel = `Ahead ${fmt}`
      deltaIcon  = '⚡'
      deltaStyle = { bg: '#DBEAFE', color: '#1E40AF', border: '#BFDBFE' }
    } else {
      deltaLabel = `Delay +${fmt}`
      deltaIcon  = '⚠'
      deltaStyle = { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A' }
    }
  }

  // FIX: Progress bar from Excel column (0.0–1.0), NOT time-elapsed calculation
  const progressPct = (excelProgress != null && !isNaN(excelProgress))
    ? Math.round(excelProgress * 100)
    : null

  return (
    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* ── Time rows ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* Plan */}
        {ps && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '5px 10px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.4px' }}>Plan</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', fontFamily: 'monospace' }}>
              {fmtShort(ps)}
            </span>
            {pe && (
              <>
                <span style={{ fontSize: '10px', color: '#CBD5E1' }}>→</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569', fontFamily: 'monospace' }}>{fmtShort(pe)}</span>
              </>
            )}
          </div>
        )}

        {/* Actual */}
        {as && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF9', border: '1px solid #6EE7B7', borderRadius: '8px', padding: '5px 10px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: '.4px' }}>actual</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#065F46', fontFamily: 'monospace' }}>
              {fmtShort(as)}
            </span>
            {ae && (
              <>
                <span style={{ fontSize: '10px', color: '#6EE7B7' }}>→</span>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#065F46', fontFamily: 'monospace' }}>{fmtShort(ae)}</span>
              </>
            )}
            {!ae && isInProg && (
              <>
                <span style={{ fontSize: '10px', color: '#6EE7B7' }}>→</span>
                <span style={{ fontSize: '11px', color: '#E8A030', fontWeight: '700', fontFamily: 'monospace' }}>sedang berjalan…</span>
              </>
            )}
          </div>
        )}

        {/* Delta badge */}
        {deltaLabel && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: deltaStyle.bg, color: deltaStyle.color,
            border: `1px solid ${deltaStyle.border}`,
            borderRadius: '8px', padding: '5px 12px',
            fontSize: '12px', fontWeight: '800', whiteSpace: 'nowrap',
          }}>
            <span>{deltaIcon}</span>
            <span>{deltaLabel}</span>
          </div>
        )}
      </div>

      {/* FIX: Progress bar from Excel Progress column (not time-elapsed) */}
      {isInProg && progressPct != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>Progress</span>
            <span style={{ fontSize: '10px', color: progressPct >= 100 ? '#16A34A' : '#E8A030', fontWeight: '700' }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ height: '5px', borderRadius: '99px', background: '#F1F5F9', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '99px',
              width: `${progressPct}%`,
              background: progressPct >= 100 ? '#16A34A' : '#E8A030',
              transition: 'width .6s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Activity Card (detail mode) ────────────────────────────────────────────────
function ActivityCard({ act, index }) {
  const ss   = statusStyle(act.status)
  const sc   = STAGE_COLORS[act.stage] || '#94A3B8'
  const isInProg = act.status.toLowerCase().includes('in progress')

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${isInProg ? '#E8A030' : '#F1F5F9'}`,
      borderRadius: '16px', padding: '18px 20px',
      boxShadow: isInProg ? '0 4px 20px rgba(232,160,48,.10)' : '0 1px 6px rgba(0,0,0,.05)',
      transition: 'box-shadow .2s',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
        background: ss.dot, borderRadius: '16px 0 0 16px',
      }} />

      <div style={{ paddingLeft: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                background: sc, color: '#fff', borderRadius: '6px',
                padding: '2px 8px', fontSize: '10px', fontWeight: '800', letterSpacing: '.3px',
              }}>{act.stage}</span>
              <span style={{ fontSize: '11px', color: '#CBD5E1', fontWeight: '600' }}>#{String(index + 1).padStart(2, '0')}</span>
              {isInProg && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: '#FEF9C3', color: '#92400E', borderRadius: '99px',
                  padding: '2px 8px', fontSize: '10px', fontWeight: '700',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#E8A030', animation: 'blink 1.5s infinite' }} />
                  On Going
                </span>
              )}
            </div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.5 }}>
              {act.activity}
            </p>
          </div>
          <StatusPill label={act.status} />
        </div>

        {/* FIX: pass excelProgress from Excel Progress column */}
        {act.plan_start && (
          <DeltaBadge
            planStart={act.plan_start}
            planEnd={act.plan_end}
            actualStart={act.actual_start}
            actualEnd={act.actual_end}
            status={act.progress_status}
            actStatus={act.status}
            excelProgress={act.progress}
          />
        )}
      </div>
    </div>
  )
}

// ── Activity Row (ringkas mode) ────────────────────────────────────────────────
function ActivityRow({ act, index }) {
  const sc  = STAGE_COLORS[act.stage] || '#94A3B8'
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 130px 140px',
      gap: '12px', alignItems: 'center',
      padding: '11px 16px',
      borderBottom: '1px solid #F8FAFC',
      background: index % 2 === 0 ? '#fff' : '#FAFCFF',
    }}>
      <span style={{
        background: sc, color: '#fff', borderRadius: '6px',
        padding: '2px 8px', fontSize: '10px', fontWeight: '800',
        textAlign: 'center', display: 'inline-block',
      }}>{act.stage}</span>
      <span style={{ fontSize: '12px', color: '#334155', fontWeight: '500', lineHeight: 1.4 }}>{act.activity}</span>
      <StatusPill label={act.status} />
      <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', textAlign: 'right' }}>
        {act.plan_start ? act.plan_start.split('T')[0] : '—'}
      </span>
    </div>
  )
}

// ── DetailAktivitas ────────────────────────────────────────────────────────────
function DetailAktivitas({ items = [] }) {
  const [view,          setView]          = useState('detail')
  const [filterStage,   setFilterStage]   = useState('ALL')
  const [filterStatus,  setFilterStatus]  = useState('ALL')
  const [search,        setSearch]        = useState('')

  const stageNames = [...new Set(items.map(r => r.Stage).filter(Boolean))].sort()
  const stages = ['ALL', ...stageNames]
  const statusGroups = ['ALL', 'Done', 'In Progress', 'Not Started', 'Delayed', 'N/A']

  const safeDate = (val) => {
    if (!val) return null
    // FIX: reject bare time strings from Excel
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(val).trim())) return null
    const d = new Date(val)
    if (isNaN(d.getTime())) return null
    if (d.getFullYear() < 1970) return null
    return d.toISOString()
  }

  const allActivities = items
    .filter(r => {
      const activity = (r.Activity || '').toString().trim()
      const stage    = (r.Stage    || '').toString().trim()
      if (!activity && !stage) return false
      if (!activity) return false
      return true
    })
    .map(r => ({
      stage:           r.Stage || '',
      stageStatus:     r.Status || '',
      activity:        r.Activity || '',
      status:          r.Status || '',
      // FIX: progress from Excel Progress column (0.0, 0.5, 1.0)
      progress:        parseFloat(r.Progress ?? r.progress ?? 0),
      plan_start:      safeDate(r['Planned Start Time']),
      plan_end:        safeDate(r['Planned End Time']),
      actual_start:    safeDate(r['Actual Start Time']),
      actual_end:      safeDate(r['Actual End Time']),
      progress_status: r.Remarks || null,
      event:           r.Event || '',
      timeline:        r.Timeline || '',
      is_parallel:     r['Is Parallel'] || false,
      planned_dur:     r['Planned Duration'] || null,
      actual_dur:      r['Actual Duration'] || null,
    }))

  const filtered = allActivities.filter(a => {
    const matchStage  = filterStage  === 'ALL' || a.stage === filterStage
    const matchStatus = filterStatus === 'ALL' || a.status.toLowerCase().includes(filterStatus.toLowerCase())
    const matchSearch = !search || a.activity.toLowerCase().includes(search.toLowerCase())
    return matchStage && matchStatus && matchSearch
  })

  const countByStage = s => allActivities.filter(a => a.stage === s).length

  return (
    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px', overflow: 'hidden' }}>

      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid #F1F5F9',
        background: 'linear-gradient(135deg, #F8FAFC 0%, #fff 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Detail Aktivitas</h2>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
              Menampilkan <strong style={{ color: '#0F172A' }}>{filtered.length}</strong> dari {allActivities.length} aktivitas
            </p>
          </div>

          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {[
              { key: 'ringkas', label: '☰  Ringkas' },
              { key: 'detail',  label: '⊞  Detail'  },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} style={{
                padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '12px', fontFamily: 'inherit',
                background: view === v.key ? '#fff' : 'transparent',
                color: view === v.key ? '#0F172A' : '#94A3B8',
                boxShadow: view === v.key ? '0 1px 4px rgba(0,0,0,.10)' : 'none',
                transition: 'all .15s',
              }}>{v.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: '#F8FAFC', border: '1.5px solid #E2E8F0',
            borderRadius: '10px', padding: '7px 12px', flex: '1', minWidth: '200px', maxWidth: '300px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari aktivitas..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', color: '#0F172A', width: '100%', fontFamily: 'inherit' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0 }}>×</button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {stages.map(s => (
              <button key={s} onClick={() => setFilterStage(s)} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '11px', fontFamily: 'inherit',
                background: filterStage === s ? (s === 'ALL' ? '#0F172A' : STAGE_COLORS[s] || '#0F172A') : '#F1F5F9',
                color: filterStage === s ? '#fff' : '#64748B',
                transition: 'all .15s',
              }}>
                {s === 'ALL' ? 'Semua' : s}
                {s !== 'ALL' && (
                  <span style={{
                    marginLeft: '5px', background: filterStage === s ? 'rgba(255,255,255,.25)' : '#E2E8F0',
                    color: filterStage === s ? '#fff' : '#64748B',
                    borderRadius: '99px', padding: '0 5px', fontSize: '10px',
                  }}>{countByStage(s)}</span>
                )}
              </button>
            ))}
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{
              border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '7px 12px',
              fontSize: '12px', color: '#334155', background: '#F8FAFC',
              outline: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600',
            }}
          >
            {statusGroups.map(sg => (
              <option key={sg} value={sg}>{sg === 'ALL' ? 'Semua Status' : sg}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{
        display: 'flex', gap: '16px', padding: '10px 28px',
        background: '#FAFCFF', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap', alignItems: 'center',
      }}>
        {[
          { label: 'Done',        dot: '#16A34A', bg: '#DCFCE7' },
          { label: 'In Progress', dot: '#F59E0B', bg: '#FEF9C3' },
          { label: 'Not Started', dot: '#DC2626', bg: '#FEE2E2' },
          { label: 'Delayed',     dot: '#D97706', bg: '#FEF3C7' },
          { label: 'N/A',         dot: '#94A3B8', bg: '#F1F5F9' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.dot }} />
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>{l.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94A3B8' }}>
          Delta:{' '}
          <span style={{ color: '#166534', fontWeight: '600', background: '#DCFCE7', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>✓ On-track</span>
          {' '}<span style={{ color: '#1E40AF', fontWeight: '600', background: '#DBEAFE', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>⚡ Ahead</span>
          {' '}<span style={{ color: '#92400E', fontWeight: '600', background: '#FEF3C7', padding: '1px 5px', borderRadius: '4px', fontSize: '10px' }}>⚠ Delay</span>
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <p style={{ fontWeight: '600', fontSize: '14px' }}>Tidak ada aktivitas ditemukan</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>Coba ubah filter atau kata kunci pencarian</p>
        </div>
      ) : view === 'detail' ? (
        <div style={{ padding: '20px clamp(12px,2vw,28px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(480px,100%), 1fr))', gap: '14px' }}>
          {filtered.map((act, i) => <ActivityCard key={i} act={act} index={i} />)}
        </div>
      ) : (
        <div>
          <div style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 120px 120px',
            gap: '8px', padding: '10px 12px',
            background: '#0F172A', margin: '16px clamp(12px,2vw,28px) 0',
            borderRadius: '10px 10px 0 0',
          }}>
            {['Stage', 'Aktivitas', 'Status', 'Tgl Plan'].map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</span>
            ))}
          </div>
          <div style={{ margin: '0 clamp(12px,2vw,28px) 20px', border: '1px solid #F1F5F9', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
            {filtered.map((act, i) => <ActivityRow key={i} act={act} index={i} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Aktivitas Hari Ini (FDR) ─────────────────────────────────────────────────
function TodayActivitiesFDR({ activities = [] }) {
  if (activities.length === 0) return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
      <p style={{ fontSize: '13px', fontWeight: '500' }}>Tidak ada aktivitas yang dijadwalkan hari ini</p>
    </div>
  )
  const statusMap = {
    'Done':        { bg: '#F0FDF4', color: '#16A34A', dot: '#16A34A' },
    'In Progress': { bg: '#FFFBEB', color: '#D97706', dot: '#E8A030' },
    'Not Started': { bg: '#F8FAFC', color: '#64748B', dot: '#CBD5E1' },
  }
  const stageColors = {
    'Stage 0': '#6366F1', 'Stage 1': '#0EA5E9', 'Stage 2': '#01847C',
    'Stage 3': '#8B5CF6', 'Stage 4': '#E8A030', 'Stage 5': '#94A3B8',
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(440px,100%), 1fr))', gap: '10px' }}>
      {activities.map((a, i) => {
        const sc = statusMap[a.status] || statusMap['Not Started']
        const stageColor = stageColors[a.stage] || '#64748B'
        const fmtTime = iso => {
          if (!iso) return '—'
          const d = parseDate(iso)
          return d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'
        }
        // FIX: progress from Excel Progress column (0.0, 0.5, 1.0)
        const progressPct = Math.round((a.progress || 0) * 100)
        return (
          <div key={i} style={{
            background: '#fff', borderRadius: '14px',
            border: `1.5px solid ${a.status === 'In Progress' ? '#E8A030' : '#F1F5F9'}`,
            padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start',
            boxShadow: a.status === 'In Progress' ? '0 4px 16px rgba(232,160,48,.12)' : '0 1px 4px rgba(0,0,0,.04)',
          }}>
            <div style={{ minWidth: '52px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace', lineHeight: 1.2 }}>{fmtTime(a.planned_start)}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>–{fmtTime(a.planned_end)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <span style={{ background: stageColor, color: '#fff', borderRadius: '5px', padding: '1px 7px', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>{a.stage}</span>
                <span style={{ fontSize: '10px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.event}</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', lineHeight: 1.4, marginBottom: '3px' }}>{a.activity}</div>
              {a.area && <div style={{ fontSize: '11px', color: '#94A3B8' }}>Area: {a.area}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: sc.bg, color: sc.color, borderRadius: '99px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot }} />
                {a.status}
              </span>
              {/* FIX: show progress from Excel, not binary done/pending */}
              <span style={{
                fontSize: '10px',
                color: progressPct >= 100 ? '#16A34A' : progressPct > 0 ? '#E8A030' : '#94A3B8',
                fontWeight: '700'
              }}>
                {progressPct >= 100 ? '✓ Done' : progressPct > 0 ? `⚙ ${progressPct}%` : '○ Pending'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── SVG Donut Chart ──────────────────────────────────────────────────────────
function OverallDonut({ completed, inProgress, notStarted, size = 180 }) {
  const VB = 200
  const r = 80, cx = VB / 2, cy = VB / 2
  const circ = 2 * Math.PI * r

  const segments = [
    { pct: completed,   color: '#01847C' },
    { pct: inProgress,  color: '#E8A030' },
    { pct: notStarted,  color: '#CBD5E1' },
  ]

  let offset = 0
  const paths = segments.map((seg, i) => {
    const len = (seg.pct / 100) * circ
    const el = (
      <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth="22"
        strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} strokeLinecap="butt"
        style={{ transition: 'stroke-dasharray 1.2s ease' }}
      />
    )
    offset += len
    return el
  })

  return (
    <div style={{ width: `${size}px`, height: `${size}px`, margin: '0 auto' }}>
      <svg viewBox={`0 0 ${VB} ${VB}`} style={{ width: '100%', height: '100%', display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth="22" />
        <g transform={`rotate(-90 ${cx} ${cy})`}>{paths}</g>
        <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '28px', fontWeight: '900', fill: '#01847C', fontFamily: 'inherit' }}>
          {completed.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '13px', fontWeight: '500', fill: '#94A3B8', fontFamily: 'inherit' }}>
          Completed
        </text>
      </svg>
    </div>
  )
}

// ── Overall Timing Summary ───────────────────────────────────────────────────
function OverallTimingSummary({ items = [] }) {
  const stageOrder = ['Stage 0', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5']
  const STAGE_COLORS_OTS = {
    'Stage 0': '#6366F1', 'Stage 1': '#0EA5E9', 'Stage 2': '#01847C',
    'Stage 3': '#8B5CF6', 'Stage 4': '#E8A030', 'Stage 5': '#94A3B8',
  }

  const cats = { ahead: 0, ontrack: 0, delay: 0, nodata: 0 }
  const stageBreakdown = {}
  stageOrder.forEach(s => { stageBreakdown[s] = { ahead: 0, ontrack: 0, delay: 0, nodata: 0, total: 0 } })

  items.forEach(r => {
    const stage  = r.Stage || ''
    const status = (r.Status || '').toLowerCase()
    if (!stageBreakdown[stage]) return

    const isDone   = status.includes('done')
    const isInProg = status.includes('in progress')
    if (!isDone && !isInProg) { cats.nodata++; stageBreakdown[stage].nodata++; stageBreakdown[stage].total++; return }

    const pe = r['Planned End Time']   ? new Date(r['Planned End Time'])   : null
    const ae = r['Actual End Time']    ? new Date(r['Actual End Time'])    : null
    const ref = isDone ? ae : isInProg ? new Date() : null

    // FIX: reject invalid ae (bare time / epoch)
    const aeValid = ae && ae.getFullYear() >= 1970 ? ae : null
    const refFinal = isDone ? aeValid : isInProg ? new Date() : null

    if (!pe || !refFinal || isNaN(pe) || isNaN(refFinal)) {
      cats.nodata++; stageBreakdown[stage].nodata++; stageBreakdown[stage].total++; return
    }

    const deltaMs = refFinal.getTime() - pe.getTime()
    let cat
    if (Math.abs(deltaMs) < 5 * 60000)   cat = 'ontrack'
    else if (deltaMs < 0)                 cat = 'ahead'
    else                                  cat = 'delay'

    cats[cat]++
    stageBreakdown[stage][cat]++
    stageBreakdown[stage].total++
  })

  const total = cats.ahead + cats.ontrack + cats.delay + cats.nodata
  const assessed = cats.ahead + cats.ontrack + cats.delay
  if (total === 0) return null

  const aheadPct   = assessed > 0 ? Math.round((cats.ahead   / assessed) * 100) : 0
  const ontrackPct = assessed > 0 ? Math.round((cats.ontrack / assessed) * 100) : 0
  const delayPct   = assessed > 0 ? Math.round((cats.delay   / assessed) * 100) : 0

  const tiles = [
    { key: 'ahead',   icon: '⚡', label: 'Lebih Cepat', count: cats.ahead,   pct: aheadPct,   bg: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', accent: '#1E40AF', bar: '#3B82F6', border: '#BFDBFE', sub: 'aktivitas selesai lebih cepat dari rencana' },
    { key: 'ontrack', icon: '✅', label: 'On-Track',    count: cats.ontrack, pct: ontrackPct, bg: 'linear-gradient(135deg, #F0FDF9 0%, #DCFCE7 100%)', accent: '#166534', bar: '#16A34A', border: '#BBF7D0', sub: 'aktivitas berjalan sesuai rencana' },
    { key: 'delay',   icon: '⚠️', label: 'Delay',       count: cats.delay,   pct: delayPct,   bg: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', accent: '#92400E', bar: '#D97706', border: '#FDE68A', sub: 'aktivitas berjalan melebihi waktu rencana' },
  ]

  const overallHealth =
    delayPct > 30 ? { label: 'Perlu Perhatian', color: '#92400E', bg: '#FEF3C7', icon: '⚠️' } :
    delayPct > 10 ? { label: 'Cukup Baik',      color: '#854D0E', bg: '#FEF9C3', icon: '📊' } :
    aheadPct > 40 ? { label: 'Sangat Baik',      color: '#166534', bg: '#DCFCE7', icon: '🚀' } :
                    { label: 'Baik',              color: '#166534', bg: '#DCFCE7', icon: '✅' }

  return (
    <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px', border: '1.5px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Ringkasan Ketepatan Waktu</h2>
            <span style={{ background: overallHealth.bg, color: overallHealth.color, borderRadius: '99px', padding: '3px 12px', fontSize: '11px', fontWeight: '700' }}>
              {overallHealth.icon} {overallHealth.label}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>
            Berdasarkan <strong style={{ color: '#0F172A' }}>{assessed}</strong> aktivitas yang sudah berjalan dari total {total} aktivitas
          </p>
        </div>
        <div style={{ minWidth: '220px', flex: '0 0 auto' }}>
          <div style={{ display: 'flex', height: '12px', borderRadius: '99px', overflow: 'hidden', gap: '2px', marginBottom: '6px' }}>
            {aheadPct   > 0 && <div style={{ flex: aheadPct,   background: '#3B82F6' }} />}
            {ontrackPct > 0 && <div style={{ flex: ontrackPct, background: '#16A34A' }} />}
            {delayPct   > 0 && <div style={{ flex: delayPct,   background: '#D97706' }} />}
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            {[
              { color: '#3B82F6', label: `⚡ ${aheadPct}%` },
              { color: '#16A34A', label: `✓ ${ontrackPct}%` },
              { color: '#D97706', label: `⚠ ${delayPct}%` },
            ].map(l => (
              <span key={l.label} style={{ fontSize: '10px', color: l.color, fontWeight: '700' }}>{l.label}</span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {tiles.map(t => (
          <div key={t.key} style={{ background: t.bg, borderRadius: '16px', padding: '20px 22px', border: `1.5px solid ${t.border}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>{t.icon}</div>
            <div style={{ fontSize: '32px', fontWeight: '800', color: t.accent, lineHeight: 1 }}>{t.count}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: t.accent, lineHeight: 1, marginTop: '2px' }}>{t.pct}%</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: t.accent, marginTop: '6px' }}>{t.label}</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', lineHeight: 1.4 }}>{t.sub}</div>
            <div style={{ marginTop: '12px', height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,.5)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${t.pct}%`, background: t.bar, borderRadius: '99px', transition: 'width 1s ease' }} />
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '14px' }}>Breakdown per Stage</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {stageOrder.filter(s => stageBreakdown[s].total > 0).map(s => {
            const sb  = stageBreakdown[s]
            const tot = sb.total
            const aP  = tot > 0 ? Math.round((sb.ahead   / tot) * 100) : 0
            const oP  = tot > 0 ? Math.round((sb.ontrack / tot) * 100) : 0
            const dP  = tot > 0 ? Math.round((sb.delay   / tot) * 100) : 0
            const sc  = STAGE_COLORS_OTS[s] || '#94A3B8'
            const dominantCat =
              sb.delay > sb.ahead && sb.delay > sb.ontrack ? 'delay' :
              sb.ahead > sb.ontrack ? 'ahead' : 'ontrack'
            const catMeta = {
              ahead:   { label: 'Lebih Cepat', color: '#1E40AF', bg: '#EFF6FF' },
              ontrack: { label: 'On-Track',    color: '#166534', bg: '#F0FDF9' },
              delay:   { label: 'Delay',        color: '#92400E', bg: '#FFFBEB' },
            }
            const dom = catMeta[dominantCat]
            return (
              <div key={s} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 120px',
                gap: '14px', alignItems: 'center',
                padding: '10px 14px', borderRadius: '12px', background: '#FAFCFF', border: '1px solid #F1F5F9',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: sc, color: '#fff', borderRadius: '6px', padding: '2px 9px', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>{s}</span>
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>{tot}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', background: '#F1F5F9', gap: '1px' }}>
                    {aP > 0 && <div style={{ width: `${aP}%`, background: '#3B82F6' }} />}
                    {oP > 0 && <div style={{ width: `${oP}%`, background: '#16A34A' }} />}
                    {dP > 0 && <div style={{ width: `${dP}%`, background: '#D97706' }} />}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {sb.ahead   > 0 && <span style={{ fontSize: '10px', color: '#3B82F6', fontWeight: '600' }}>⚡{sb.ahead}</span>}
                    {sb.ontrack > 0 && <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: '600' }}>✓{sb.ontrack}</span>}
                    {sb.delay   > 0 && <span style={{ fontSize: '10px', color: '#D97706', fontWeight: '600' }}>⚠{sb.delay}</span>}
                    {sb.nodata  > 0 && <span style={{ fontSize: '10px', color: '#CBD5E1', fontWeight: '600' }}>○{sb.nodata}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: dom.bg, color: dom.color, borderRadius: '99px', padding: '3px 10px', fontSize: '10px', fontWeight: '700' }}>
                    {dominantCat === 'ahead' ? '⚡' : dominantCat === 'ontrack' ? '✓' : '⚠'} {dom.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>Keterangan:</span>
        {[
          { color: '#3B82F6', bg: '#EFF6FF', icon: '⚡', label: 'Lebih Cepat — selesai/berjalan lebih cepat dari plan' },
          { color: '#166534', bg: '#F0FDF9', icon: '✓',  label: 'On-Track — dalam toleransi ±5 menit' },
          { color: '#92400E', bg: '#FFFBEB', icon: '⚠',  label: 'Delay — melebihi batas waktu plan' },
        ].map(l => (
          <span key={l.label} style={{ background: l.bg, color: l.color, borderRadius: '6px', padding: '3px 10px', fontSize: '10px', fontWeight: '700' }}>
            {l.icon} {l.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Plan vs Actual Chart ─────────────────────────────────────────────────────
function PlanActualChart({ items = [] }) {
  const stageOrder = ['Stage 0', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5']
  const STAGE_COLORS_LOCAL = {
    'Stage 0': '#6366F1', 'Stage 1': '#0EA5E9', 'Stage 2': '#01847C',
    'Stage 3': '#8B5CF6', 'Stage 4': '#E8A030', 'Stage 5': '#94A3B8',
  }

  const agg = {}
  stageOrder.forEach(s => { agg[s] = { stage: s, planned: 0, actual: 0, done: 0, total: 0 } })

  items.forEach(r => {
    const s = r.Stage || ''
    if (!agg[s]) return
    agg[s].total++
    const status = (r.Status || '').toLowerCase()
    if (status === 'done' || status.includes('done')) {
      agg[s].done++
      const pd = parseFloat(r['Planned Duration']) || 0
      const ad = parseFloat(r['Actual Duration'])  || 0
      if (pd > 0) agg[s].planned += pd
      if (ad > 0) agg[s].actual  += ad
    }
  })

  const rows = stageOrder.map(s => agg[s]).filter(r => r.total > 0)
  if (!rows.length) return null

  const maxVal = Math.max(...rows.map(r => Math.max(r.planned, r.actual)), 1)

  return (
    <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Plan vs Actual Duration</h2>
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Perbandingan durasi rencana vs aktual per stage (aktivitas Done)</p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[{ color: '#CBD5E1', label: 'Planned' }, { color: '#01847C', label: 'Actual' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '28px', height: '4px', background: l.color, borderRadius: '2px' }} />
              <span style={{ fontSize: '11px', color: '#64748B' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {rows.map((r, i) => {
          const planPct   = (r.planned / maxVal) * 100
          const actualPct = (r.actual  / maxVal) * 100
          const donePct   = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0
          const sc        = STAGE_COLORS_LOCAL[r.stage] || '#94A3B8'
          const delta     = r.planned > 0 ? ((r.actual - r.planned) / r.planned) * 100 : 0
          const isAhead   = r.done > 0 && delta < -5
          const isDelay   = r.done > 0 && delta > 10
          const noData    = r.done === 0

          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: '14px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ background: sc, color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>{r.stage}</span>
                <span style={{ fontSize: '10px', color: '#94A3B8' }}>{donePct}%</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontSize: '9px', color: '#94A3B8', fontWeight: '600' }}>PLAN</div>
                  <div style={{ flex: 1, height: '10px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                    {planPct > 0 && <div style={{ width: `${planPct}%`, height: '100%', background: '#CBD5E1', borderRadius: '99px', transition: 'width .8s' }} />}
                  </div>
                  <div style={{ width: '50px', flexShrink: 0, fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>{r.planned > 0 ? `${Math.round(r.planned/60)}h` : '—'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', flexShrink: 0, textAlign: 'right', fontSize: '9px', color: '#01847C', fontWeight: '700' }}>ACT</div>
                  <div style={{ flex: 1, height: '10px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
                    {actualPct > 0 && <div style={{ width: `${actualPct}%`, height: '100%', background: sc, borderRadius: '99px', transition: 'width .8s' }} />}
                  </div>
                  <div style={{ width: '50px', flexShrink: 0, fontSize: '10px', color: '#0F172A', fontFamily: 'monospace', fontWeight: '600' }}>{r.actual > 0 ? `${Math.round(r.actual/60)}h` : '—'}</div>
                </div>
              </div>
              <div style={{ minWidth: '100px', textAlign: 'right' }}>
                {noData ? (
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>—</span>
                ) : isAhead ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#DBEAFE', color: '#1E40AF', borderRadius: '8px', padding: '3px 8px', fontSize: '10px', fontWeight: '800' }}>⚡ Lebih cepat {Math.abs(delta).toFixed(0)}%</span>
                ) : isDelay ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF3C7', color: '#92400E', borderRadius: '8px', padding: '3px 8px', fontSize: '10px', fontWeight: '800' }}>⚠ Delay {delta.toFixed(0)}%</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#DCFCE7', color: '#166534', borderRadius: '8px', padding: '3px 8px', fontSize: '10px', fontWeight: '800' }}>✓ On-track</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Upload Panel ──────────────────────────────────────────────────────────────
function UploadFDRPanel({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [status,    setStatus]    = useState(null)
  const fileRef = React.useRef()

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setStatus({ type: 'err', msg: 'File harus berformat .xlsx' })
      return
    }
    setUploading(true)
    setStatus(null)
    try {
      const token = sessionStorage.getItem('neom_token')
      const form  = new FormData()
      form.append('file', file)
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/upload/fdr-excel`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload gagal')
      setStatus({ type: 'ok', msg: `✅ ${data.message} · ${data.total_rows} baris terbaca` })
      onSuccess?.()
    } catch (err) {
      setStatus({ type: 'err', msg: `❌ ${err.message}` })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '18px 22px',
      border: '1.5px dashed #01847C55', boxShadow: '0 1px 6px rgba(0,0,0,.05)',
      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>Upload FDR Excel</div>
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
          Upload file <code style={{ background:'#F1F5F9', padding:'1px 4px', borderRadius:'4px' }}>fdr-all-progress.xlsx</code>
        </div>
        {status && (
          <div style={{
            marginTop: '8px', fontSize: '12px', fontWeight: '600',
            color: status.type === 'ok' ? '#16A34A' : '#DC2626',
            background: status.type === 'ok' ? '#F0FDF4' : '#FEF2F2',
            padding: '6px 10px', borderRadius: '8px',
          }}>{status.msg}</div>
        )}
      </div>
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '9px 18px', borderRadius: '10px', cursor: uploading ? 'not-allowed' : 'pointer',
        background: uploading ? '#94A3B8' : '#01847C', color: '#fff',
        fontSize: '13px', fontWeight: '700',
        boxShadow: uploading ? 'none' : '0 2px 8px rgba(1,132,124,.35)', whiteSpace: 'nowrap',
      }}>
        {uploading ? '⏳ Mengupload...' : '📂 Pilih File'}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
      </label>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FDRMasterPage({ user, onLogout, readOnly = false }) {
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [fdrData,     setFdrData]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [filterStage, setFilterStage] = useState(null)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchFDRProgress()
      setFdrData(data)
      setLastRefresh(new Date())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, REFRESH_INTERVAL)
    return () => clearInterval(t)
  }, [loadData])

  const items     = fdrData?.items    || []
  const overall   = fdrData?.overall  || {}
  const stages    = fdrData?.stages   || []

  // FIX: todayActivities — progress from Excel Progress column, NOT status-based
  const todayActivities = React.useMemo(() => {
    const todayStr = new Date().toDateString()
    const sourceItems = filterStage
      ? items.filter(r => (r.Stage || '').toLowerCase() === filterStage.toLowerCase())
      : items
    return sourceItems
      .filter(r => {
        const activity = (r.Activity || '').toString().trim()
        if (!activity) return false
        const ps = r['Planned Start Time']
        if (!ps) return false
        const d = new Date(ps)
        if (isNaN(d.getTime())) return false
        return d.toDateString() === todayStr
      })
      .map(r => ({
        stage:         r.Stage        || '',
        activity:      r.Activity     || '',
        status:        r.Status       || 'Not Started',
        // FIX: use Progress column directly (0.0, 0.5, 1.0)
        progress:      parseFloat(r.Progress ?? r.progress ?? 0),
        planned_start: r['Planned Start Time'] || null,
        planned_end:   r['Planned End Time']   || null,
        actual_start:  r['Actual Start Time']  || null,
        actual_end:    r['Actual End Time']    || null,
        event:         r.Event        || '',
        area:          r.Area         || '',
      }))
      .sort((a, b) => {
        const ta = a.planned_start ? new Date(a.planned_start) : 0
        const tb = b.planned_start ? new Date(b.planned_start) : 0
        return ta - tb
      })
  }, [items, filterStage])

  const filteredItems  = filterStage ? items.filter(r => (r.Stage || '').toLowerCase() === filterStage.toLowerCase()) : items
  const filteredStages = filterStage ? stages.filter(s => (s.stage || '').toLowerCase() === filterStage.toLowerCase()) : stages

  const computedOverall = (() => {
    if (!filterStage || filteredItems.length === 0) return overall
    const total      = filteredItems.length
    const done       = filteredItems.filter(r => (r.Status || '').toLowerCase().includes('done')).length
    const inProgress = filteredItems.filter(r => (r.Status || '').toLowerCase().includes('in progress')).length
    const notStarted = total - done - inProgress
    return {
      total, done, in_progress: inProgress, not_started: notStarted,
      done_pct:        total ? (done / total) * 100 : 0,
      in_progress_pct: total ? (inProgress / total) * 100 : 0,
      not_started_pct: total ? (notStarted / total) * 100 : 0,
      progress_pct:    total ? (done / total) * 100 : 0,
    }
  })()

  const completedActs  = computedOverall.done        || 0
  const inProgressActs = computedOverall.in_progress || 0
  const notStartedActs = computedOverall.not_started || 0
  const completedPct   = computedOverall.done_pct    || 0
  const inProgressPct  = computedOverall.in_progress_pct || 0
  const notStartedPct  = computedOverall.not_started_pct || 0
  const overallPct     = computedOverall.progress_pct ?? completedPct
  const overallStatus  = completedPct === 100 ? 'SELESAI' : inProgressPct > 0 ? 'ON PROGRESS' : 'BELUM MULAI'

  if (loading && !fdrData) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#01847C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#64748B', fontSize: '14px' }}>Memuat data FDR dari Excel...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', flexDirection: 'column' }}>

      {/* NAV */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '0 clamp(12px,3vw,32px)', minHeight: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,.06)', flexWrap: 'wrap', gap: '8px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#01847C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '13px' }}>BSI</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A', lineHeight: 1.2 }}>FDR Master Dashboard</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Full Dress Rehearsal · NEOM Core Banking</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#16A34A', borderRadius: '50%', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
            <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '600' }}>Live</span>
          </div>
          <span className="fdr-nav-hide" style={{ fontSize: '12px', color: '#94A3B8' }}>Update: {lastRefresh.toLocaleTimeString('id-ID')}</span>
          {user && (
            <div className="fdr-nav-hide" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', borderRadius: '10px', padding: '6px 12px', border: '1px solid #E2E8F0' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#01847C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '11px' }}>
                {user?.name?.[0] || 'U'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.2 }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{user?.institution || 'Admin BSI'}</div>
              </div>
            </div>
          )}
          {onLogout && (
            <button
              onClick={() => { sessionStorage.removeItem('neom_token'); onLogout() }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1.5px solid #FCA5A5', borderRadius: '10px', background: '#FFF1F1', color: '#DC2626', fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFF1F1'; e.currentTarget.style.color = '#DC2626' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="fdr-nav-hide">Keluar</span>
            </button>
          )}
        </div>
      </nav>

      {/* HEADER BANNER */}
      <div style={{
        background: 'linear-gradient(135deg, #01847C 0%, #016860 50%, #0F172A 100%)',
        padding: 'clamp(16px,3vw,28px) clamp(14px,3vw,32px)', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .05, backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ background: 'rgba(232,160,48,.2)', color: '#E8A030', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(232,160,48,.3)' }}>CONFIDENTIAL</span>
              <span style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '600' }}>FDR 3 - April 2026</span>
            </div>
            <h1 style={{ color: '#fff', fontSize: 'clamp(18px,3vw,28px)', fontWeight: '800', letterSpacing: '-.5px', lineHeight: 1.1 }}>Dashboard Master FDR</h1>
            <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', marginTop: '6px' }}>Full Dress Rehearsal — NEOM Core Banking Upgrade BSI</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>OVERALL STATUS</div>
            <span style={{ padding: '6px 20px', borderRadius: '99px', background: '#DC2626', color: '#fff', fontWeight: '800', fontSize: '14px', display: 'inline-block' }}>{overallStatus}</span>
            <div style={{ marginTop: '10px', color: '#fff', fontFamily: 'monospace', fontSize: '32px', fontWeight: '800', lineHeight: 1 }}>{overallPct.toFixed(1)}%</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', marginTop: '2px' }}>Overall Progress</div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main style={{ padding: 'clamp(14px,2.5vw,28px) clamp(14px,2.5vw,40px)', flex: 1, width: '100%' }}>

        {/* Stage filter */}
        <div className="stage-pills" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[null, 'Stage 0', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5'].map(s => (
            <button key={s} onClick={() => setFilterStage(s)} style={{
              padding: '8px 20px', borderRadius: '99px', border: 'none',
              fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              background: filterStage === s ? '#01847C' : '#fff',
              color: filterStage === s ? '#fff' : '#64748B',
              boxShadow: filterStage === s ? '0 2px 8px rgba(1,132,124,.35)' : '0 1px 4px rgba(0,0,0,.08)',
              transition: 'all .2s',
            }}>
              {s === null ? 'Semua Stage' : s}
            </button>
          ))}
        </div>

        {/* Upload panel */}
        {!readOnly && (
          <div style={{ marginBottom: '20px' }}>
            <UploadFDRPanel onSuccess={loadData} />
          </div>
        )}

        {/* KPI Grid */}
        <div className="fdr-kpi-grid" style={{ display: 'grid', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: 'clamp(20px,3vw,36px) clamp(16px,2.5vw,28px)', boxShadow: '0 1px 8px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontWeight: '700', fontSize: 'clamp(13px,1.2vw,16px)', color: '#0F172A', alignSelf: 'flex-start', marginBottom: '16px' }}>Upgrade Progress</div>
            <OverallDonut completed={completedPct} inProgress={inProgressPct} notStarted={notStartedPct} size={200} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '16px' }}>
              {[
                { label: 'Completed',   pct: completedPct,  count: completedActs,  color: '#01847C' },
                { label: 'In Progress', pct: inProgressPct, count: inProgressActs, color: '#E8A030' },
                { label: 'Not Started', pct: notStartedPct, count: notStartedActs, color: '#CBD5E1' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{s.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {[
            { label: 'Completed',   value: completedActs,  pct: completedPct,  color: '#01847C' },
            { label: 'In Progress', value: inProgressActs, pct: inProgressPct, color: '#E8A030' },
            { label: 'Not Started', value: notStartedActs, pct: notStartedPct, color: '#64748B' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: '20px', padding: 'clamp(20px,2.5vw,36px)', boxShadow: '0 1px 8px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: k.color }} />
              <div>
                <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.6px' }}>{k.label}</p>
                <p style={{ fontSize: 'clamp(36px,4vw,56px)', fontWeight: '800', color: '#0F172A', lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: 'clamp(18px,2vw,26px)', fontWeight: '700', color: k.color, marginTop: '6px', lineHeight: 1 }}>{k.pct.toFixed(1)}%</p>
              </div>
              <div style={{ marginTop: '24px' }}>
                <div style={{ height: '5px', borderRadius: '99px', background: '#F1F5F9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${k.pct}%`, background: k.color, borderRadius: '99px', transition: 'width 1s ease' }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Time Delta Banner */}
        {(() => {
          const assessed = filteredItems.filter(r => {
            const s = (r.Status || '').toLowerCase()
            return s.includes('done') || s.includes('in progress')
          })
          if (assessed.length === 0) return null

          let totalDeltaMs = 0, counted = 0, doneCount = 0
          assessed.forEach(r => {
            const pe = r['Planned End Time'] ? new Date(r['Planned End Time']) : null
            const aeRaw = r['Actual End Time']
            const ae = aeRaw ? new Date(aeRaw) : null
            // FIX: reject bare-time / epoch dates
            const aeValid = ae && ae.getFullYear() >= 1970 ? ae : null
            const isDone   = (r.Status || '').toLowerCase().includes('done')
            const isInProg = (r.Status || '').toLowerCase().includes('in progress')
            const ref = isDone ? aeValid : isInProg ? new Date() : null
            if (!pe || !ref || isNaN(pe) || isNaN(ref)) return
            totalDeltaMs += ref.getTime() - pe.getTime()
            counted++
            if (isDone) doneCount++
          })
          if (counted === 0) return null

          const absMs  = Math.abs(totalDeltaMs)
          const totalMin = Math.round(absMs / 60000)
          const hours  = Math.floor(totalMin / 60)
          const mins   = totalMin % 60
          const isAhead   = totalDeltaMs < 0
          const isOnTrack = Math.abs(totalDeltaMs) < 5 * 60000
          const fmt = hours > 0 ? `${hours} jam${mins > 0 ? ' ' + mins + ' menit' : ''}`.trim() : `${mins} menit`

          const cfg = isOnTrack
            ? { bg: '#EFF6FF', border: '#BFDBFE', iconBg: '#3B82F6', label: 'ON-TRACK',    labelBg: '#DBEAFE', labelColor: '#1E40AF', title: 'Tepat waktu',        desc: `Dari total ${doneCount} aktivitas yang selesai, berjalan sesuai rencana`,                                                     valPrefix: '±0',          valueColor: '#1E3A8A' }
            : isAhead
            ? { bg: '#EFF6FF', border: '#BFDBFE', iconBg: '#3B82F6', label: 'LEBIH CEPAT', labelBg: '#DBEAFE', labelColor: '#1E40AF', title: `Lebih cepat ${fmt}`, desc: `Dari total ${doneCount} aktivitas yang selesai, actual lebih cepat ${fmt} dibanding planned`,     valPrefix: '–' + (hours > 0 ? `${hours}j${mins > 0 ? mins + 'm' : ''}` : `${mins}m`), valueColor: '#1E3A8A' }
            : { bg: '#FFFBEB', border: '#FDE68A', iconBg: '#D97706', label: 'DELAY',        labelBg: '#FEF3C7', labelColor: '#92400E', title: `Delay ${fmt}`,       desc: `Dari total ${doneCount} aktivitas yang selesai, actual terlambat ${fmt} dari planned`, valPrefix: '+' + (hours > 0 ? `${hours}j${mins > 0 ? mins + 'm' : ''}` : `${mins}m`), valueColor: '#92400E' }

          return (
            <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: '16px', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: cfg.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ background: cfg.labelBg, color: cfg.labelColor, borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '800', letterSpacing: '.5px' }}>{cfg.label}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>{cfg.title}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B' }}>{cfg.desc}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', letterSpacing: '.5px', marginBottom: '4px' }}>SELISIH WAKTU</div>
                <div style={{ fontSize: '28px', fontWeight: '900', color: cfg.valueColor, lineHeight: 1, fontFamily: 'monospace' }}>{cfg.valPrefix}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{doneCount} aktivitas terhitung</div>
              </div>
            </div>
          )
        })()}

        {/* Today Activities */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px', border: '2px solid rgba(1,132,124,.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#01847C', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Aktivitas Hari Ini</h2>
              <span style={{ background: todayActivities.length > 0 ? '#01847C' : '#94A3B8', color: '#fff', borderRadius: '99px', padding: '2px 10px', fontSize: '11px', fontWeight: '700' }}>
                {todayActivities.length} aktivitas
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <TodayActivitiesFDR activities={todayActivities} />
        </div>

        {/* Progress per Stage */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Progress per Stage</h2>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              {[{ color: '#01847C', label: 'Completed' }, { color: '#E8A030', label: 'In Progress' }, { color: '#E2E8F0', label: 'Not Started' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color, display: 'inline-block' }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>Memuat data...</div>
            ) : error ? (
              <div style={{ padding: '20px', color: '#DC2626', fontSize: '13px' }}>⚠ {error}</div>
            ) : filteredStages.map((s, i) => {
              const cPct = s.progress_pct    || s.done_pct        || 0
              const iPct = s.in_progress_pct || 0
              const nPct = Math.max(0, 100 - cPct - iPct)
              const statusRaw = cPct >= 100 ? 'DONE' : cPct > 0 || s.in_progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'
              const statusColor = statusRaw === 'DONE' ? '#01847C' : statusRaw === 'IN_PROGRESS' ? '#E8A030' : '#94A3B8'
              const statusLabel = statusRaw === 'DONE' ? 'Completed' : statusRaw === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'
              const statusBg    = statusRaw === 'DONE' ? '#F0FDF9' : statusRaw === 'IN_PROGRESS' ? '#FFFBEB' : '#F8FAFC'
              return (
                <div key={i} style={{ padding: '18px 0', borderBottom: i < filteredStages.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div className="fdr-stage-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                      <div style={{ background: statusColor, color: '#fff', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: '800', letterSpacing: '.3px', whiteSpace: 'nowrap' }}>{s.stage}</div>
                      {statusRaw === 'IN_PROGRESS' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FFFBEB', color: '#92400E', borderRadius: '99px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#E8A030', animation: 'blink 1.5s infinite' }} />
                          On Going
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, height: '10px', borderRadius: '99px', overflow: 'hidden', background: '#F1F5F9', display: 'flex' }}>
                      {cPct > 0 && <div style={{ width: `${cPct}%`, background: '#01847C', transition: 'width 1s ease' }} />}
                      {iPct > 0 && <div style={{ width: `${iPct}%`, background: '#E8A030', transition: 'width 1s ease' }} />}
                      {nPct > 0 && <div style={{ width: `${nPct}%`, background: '#E2E8F0', transition: 'width 1s ease' }} />}
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', background: statusBg, color: statusColor, border: `1px solid ${statusColor}20`, whiteSpace: 'nowrap', minWidth: '90px', textAlign: 'center' }}>{statusLabel}</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: statusColor, minWidth: '60px', textAlign: 'right' }}>{(s.progress_pct || cPct).toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', paddingLeft: 'clamp(0px,3vw,174px)', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#01847C', fontWeight: '600' }}>● Completed: <strong>{s.done}</strong></span>
                    <span style={{ fontSize: '12px', color: '#E8A030', fontWeight: '600' }}>● In Progress: <strong>{s.in_progress}</strong></span>
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>● Not Started: <strong>{s.not_started}</strong></span>
                    <span style={{ fontSize: '12px', color: '#CBD5E1', marginLeft: 'auto', fontWeight: '500' }}>{s.total} aktivitas</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {filteredItems.length > 0 && <PlanActualChart items={filteredItems} />}
        {filteredItems.length > 0 && <OverallTimingSummary items={filteredItems} />}
        <DetailAktivitas items={filteredItems} />

      </main>

      <footer style={{ padding: '16px clamp(14px,3vw,32px)', borderTop: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>© 2026 Bank Syariah Indonesia · Dokumen Rahasia</span>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Data diperbarui setiap 60 detik</span>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes spin  { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .fdr-kpi-grid { grid-template-columns: minmax(220px,280px) 1fr 1fr 1fr; }
        @media (max-width: 1024px) {
          .fdr-kpi-grid { grid-template-columns: 1fr 1fr !important; }
          .fdr-kpi-grid > div:first-child { grid-column: 1 / -1; flex-direction: row !important; align-items: flex-start !important; gap: 20px; }
        }
        @media (max-width: 640px) {
          .fdr-kpi-grid { grid-template-columns: 1fr !important; }
          .fdr-kpi-grid > div:first-child { flex-direction: column !important; align-items: center !important; }
        }
        @media (max-width: 768px) { .fdr-nav-hide { display: none !important; } }
        .stage-pills button { font-size: 13px; }
        @media (max-width: 480px) { .stage-pills button { font-size: 11px !important; padding: 5px 12px !important; } }
        @media (max-width: 640px) { .fdr-stage-row { flex-direction: column !important; gap: 8px !important; } .fdr-stage-row > div:first-child { min-width: unset !important; } }
        @media (min-width: 1600px) { .fdr-kpi-grid { grid-template-columns: minmax(260px,320px) 1fr 1fr 1fr; gap: 28px; } }
      `}</style>
    </div>
  )
}