import React, { useState, useEffect, useCallback } from 'react'
import { RAGBadge, ProgressBar } from '../components/RAGBadge'
import { fetchFDRProgress, reloadFDR } from '../utils/api'

const REFRESH_INTERVAL = 60_000

// ── Static Stage Data ─────────────────────────────────────────────────────────
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

// ── Stacked Bar per Stage ─────────────────────────────────────────────────────
function StageStackedBar({ stage }) {
  const total = stage.completed + stage.inProgress + stage.notStarted
  if (total === 0) return null
  const cPct = (stage.completed  / total) * 100
  const iPct = (stage.inProgress / total) * 100
  const nPct = (stage.notStarted / total) * 100

  const stageStatusColor =
    stage.status === 'DONE'        ? '#01847C' :
    stage.status === 'IN_PROGRESS' ? '#E8A030' : '#94A3B8'

  return (
    <div style={{
      background: '#fff', borderRadius: '16px', padding: '18px 20px',
      border: `1.5px solid ${stage.status === 'IN_PROGRESS' ? '#E8A030' : '#F1F5F9'}`,
      boxShadow: stage.status === 'IN_PROGRESS' ? '0 4px 20px rgba(232,160,48,.12)' : '0 1px 4px rgba(0,0,0,.04)',
      transition: 'all .2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: stageStatusColor, color: '#fff',
            borderRadius: '8px', padding: '4px 10px',
            fontSize: '11px', fontWeight: '800', letterSpacing: '.5px',
          }}>
            {stage.name}
          </div>
          {stage.status === 'IN_PROGRESS' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              background: '#FEF9C3', color: '#854D0E', borderRadius: '99px',
              padding: '2px 8px', fontSize: '10px', fontWeight: '700',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E8A030', animation: 'blink 1.5s infinite' }} />
              On Going
            </span>
          )}
        </div>
        <span style={{
          fontSize: '20px', fontWeight: '800',
          color: stageStatusColor,
        }}>
          {stage.pct.toFixed(stage.pct % 1 === 0 ? 0 : 1)}%
        </span>
      </div>

      {/* Stacked bar */}
      <div style={{
        height: '10px', borderRadius: '99px', overflow: 'hidden',
        background: '#F1F5F9', display: 'flex',
      }}>
        {cPct > 0 && (
          <div style={{ width: `${cPct}%`, background: '#01847C', transition: 'width 1s ease' }} />
        )}
        {iPct > 0 && (
          <div style={{ width: `${iPct}%`, background: '#E8A030', transition: 'width 1s ease' }} />
        )}
        {nPct > 0 && (
          <div style={{ width: `${nPct}%`, background: '#E2E8F0', transition: 'width 1s ease' }} />
        )}
      </div>

      {/* Counts */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
        {[
          { label: 'Completed',   count: stage.completed,  color: '#01847C', bg: '#F0FDF9' },
          { label: 'In Progress', count: stage.inProgress, color: '#E8A030', bg: '#FFFBEB' },
          { label: 'Not Started', count: stage.notStarted, color: '#94A3B8', bg: '#F8FAFC' },
        ].map(l => (
          <div key={l.label} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            background: l.bg, borderRadius: '8px', padding: '6px 4px',
          }}>
            <span style={{ fontSize: '16px', fontWeight: '800', color: l.color }}>{l.count}</span>
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '500', textAlign: 'center' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stage Detail Card (expandable) ───────────────────────────────────────────
function StageCard({ stage, active, onClick }) {
  const stageStatusColor =
    stage.status === 'DONE'        ? '#01847C' :
    stage.status === 'IN_PROGRESS' ? '#E8A030' : '#94A3B8'

  return (
    <div
      onClick={onClick}
      style={{
        background: active ? '#F0FDF9' : '#fff',
        border: `1.5px solid ${active ? '#01847C' : '#E2E8F0'}`,
        borderRadius: '14px', padding: '16px 20px', cursor: 'pointer',
        boxShadow: active ? '0 4px 16px rgba(1,132,124,.15)' : '0 1px 4px rgba(0,0,0,.06)',
        transition: 'all .2s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = '#6DB5B9' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = '#E2E8F0' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: stageStatusColor, color: '#fff', borderRadius: '8px',
            padding: '3px 10px', fontSize: '11px', fontWeight: '800',
          }}>{stage.name}</div>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{stage.activities.length} aktivitas</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: '800', color: stageStatusColor }}>
            {stage.pct.toFixed(stage.pct % 1 === 0 ? 0 : 1)}%
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
            background: stage.status === 'DONE' ? '#DCFCE7' : stage.status === 'IN_PROGRESS' ? '#FEF9C3' : '#F1F5F9',
            color: stage.status === 'DONE' ? '#166534' : stage.status === 'IN_PROGRESS' ? '#854D0E' : '#64748B',
          }}>
            {stage.status === 'DONE' ? 'Done' : stage.status === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
          </span>
        </div>
      </div>
      <ProgressBar value={stage.pct} color={stageStatusColor} height={6} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#01847C', fontWeight: '600' }}>✓ {stage.completed} selesai</span>
          {stage.inProgress > 0 && <span style={{ fontSize: '11px', color: '#E8A030', fontWeight: '600' }}>⚙ {stage.inProgress} ON PROGRESS</span>}
          {stage.notStarted > 0 && <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>○ {stage.notStarted} belum</span>}
        </div>
        <span style={{ fontSize: '11px', color: active ? '#01847C' : '#94A3B8', fontWeight: '600' }}>
          {active ? '▲ Tutup' : '▼ Lihat detail'}
        </span>
      </div>

      {active && (
        <div style={{ marginTop: '14px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px',
            padding: '7px 10px', background: '#0F172A', borderRadius: '8px', marginBottom: '6px',
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>Activity</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>Progress Status</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {stage.activities.map((a, i) => {
              const s = statusStyle(a.status)
              const rowBg = i % 2 === 0 ? '#FAFAFA' : '#fff'
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'flex-start',
                  padding: '9px 10px', borderRadius: '8px', background: rowBg,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: '4px' }} />
                    <span style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{a.activity}</span>
                  </div>
                  <StatusPill label={a.status} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Completed Activities Table ────────────────────────────────────────────────
function CompletedTable({ rows }) {
  const [sortCol, setSortCol] = useState('stage')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(0)
  const PER_PAGE = 8

  const sorted = [...rows].sort((a, b) => {
    const va = a[sortCol] || '', vb = b[sortCol] || ''
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
  })
  const total = sorted.length
  const slice = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const pages = Math.ceil(total / PER_PAGE)

  const colHead = (label, col) => (
    <th
      onClick={() => { setSortCol(col); setSortDir(sortCol === col && sortDir === 'asc' ? 'desc' : 'asc') }}
      style={{
        textAlign: 'left', padding: '10px 12px',
        fontSize: '10px', fontWeight: '700', color: '#94A3B8',
        textTransform: 'uppercase', letterSpacing: '.5px',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
      }}
    >
      {label} {sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #F1F5F9' }}>
              {colHead('Stage',         'stage')}
              {colHead('Activity',      'activity')}
              {colHead('Plan Start',    'plan_start')}
              {colHead('Plan End',      'plan_end')}
              {colHead('Actual Start',  'actual_start')}
              {colHead('Actual End',    'actual_end')}
              {colHead('Status',        'progress_status')}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const s = statusStyle(r.progress_status)
              return (
                <tr key={i} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFCFF' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      background: '#0F172A', color: '#fff', borderRadius: '6px',
                      padding: '2px 8px', fontSize: '10px', fontWeight: '700',
                    }}>{r.stage}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#334155', maxWidth: '260px' }}>{r.activity}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.plan_start}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.plan_end}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.actual_start}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{r.actual_end}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      background: s.bg, color: s.color, borderRadius: '99px',
                      padding: '3px 10px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot }} />
                      {r.progress_status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>
          {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} dari {total} aktivitas
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          {Array.from({ length: pages }, (_, p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                width: '30px', height: '30px', borderRadius: '8px', border: 'none',
                background: page === p ? '#01847C' : '#F1F5F9',
                color: page === p ? '#fff' : '#64748B',
                fontWeight: '700', fontSize: '12px', cursor: 'pointer',
              }}
            >
              {p + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SVG Donut Chart (inline, no external dep) ────────────────────────────────
function OverallDonut({ completed, inProgress, notStarted, size = 180 }) {
  const r = 64, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r

  // Build segments from percentages
  const segments = [
    { pct: completed,   color: '#01847C' },
    { pct: inProgress,  color: '#E8A030' },
    { pct: notStarted,  color: '#CBD5E1' },
  ]

  let offset = 0
  const paths = segments.map((seg, i) => {
    const len = (seg.pct / 100) * circ
    const el = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth="18"
        strokeDasharray={`${len} ${circ - len}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        style={{ transition: 'stroke-dasharray 1.2s ease, stroke-dashoffset 1.2s ease' }}
      />
    )
    offset += len
    return el
  })

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth="18" />
        {paths}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '28px', fontWeight: '900', color: '#01847C', lineHeight: 1 }}>
          {completed.toFixed(1)}%
        </span>
        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500', marginTop: '2px' }}>Completed</span>
      </div>
    </div>
  )
}



// ── Helpers: parse datetime string "dd/MM/yyyy HH:mm" ─────────────────────────
function parseDate(str) {
  if (!str || str.includes('--') || str.includes('#')) return null
  const [datePart, timePart] = str.split(' ')
  const [d, m, y] = datePart.split('/')
  return new Date(`${y}-${m}-${d}T${timePart || '00:00'}`)
}

const STAGE_COLORS = {
  'STAGE 0': '#6366F1',
  'STAGE 1': '#0EA5E9',
  'STAGE 2': '#01847C',
  'STAGE 3': '#8B5CF6',
  'STAGE 4': '#E8A030',
  'STAGE 5': '#94A3B8',
}

// ── Mini Gantt Bar ─────────────────────────────────────────────────────────────
function GanttBar({ planStart, planEnd, actualStart, actualEnd, status }) {
  const ps = parseDate(planStart), pe = parseDate(planEnd)
  const as = parseDate(actualStart), ae = parseDate(actualEnd)
  if (!ps || !pe) return <span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span>

  // Compute timeline window: earliest start to latest end
  const minT = Math.min(ps.getTime(), as ? as.getTime() : ps.getTime())
  const maxT = Math.max(pe.getTime(), ae ? ae.getTime() : pe.getTime(), ps.getTime() + 3600000)
  const span = maxT - minT || 3600000

  const toX = t => ((t - minT) / span) * 100

  const planL  = toX(ps.getTime())
  const planW  = Math.max(toX(pe.getTime()) - planL, 1)
  const actL   = as ? toX(as.getTime()) : null
  const actW   = as && ae ? Math.max(toX(ae.getTime()) - actL, 1) : as ? Math.max(toX(Date.now()) - actL, 1) : null

  const isDelayed = (status || '').toLowerCase().includes('delayed')
  const isAhead   = (status || '').toLowerCase().includes('ahead')
  const actColor  = isDelayed ? '#F59E0B' : isAhead ? '#01847C' : '#3B82F6'

  const fmtShort = d => d ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div title={`Plan: ${fmtShort(ps)} → ${fmtShort(pe)}\nActual: ${fmtShort(as)} → ${fmtShort(ae)}`}>
      {/* Timeline track */}
      <div style={{ position: 'relative', height: '28px', background: '#F8FAFC', borderRadius: '6px', overflow: 'hidden' }}>
        {/* Plan bar */}
        <div style={{
          position: 'absolute', top: '6px', height: '8px',
          left: `${planL}%`, width: `${planW}%`,
          background: '#CBD5E1', borderRadius: '4px', minWidth: '3px',
        }} />
        {/* Actual bar */}
        {actL !== null && actW !== null && (
          <div style={{
            position: 'absolute', top: '14px', height: '8px',
            left: `${Math.max(0, actL)}%`, width: `${Math.min(actW, 100 - Math.max(0, actL))}%`,
            background: actColor, borderRadius: '4px', minWidth: '3px',
            opacity: 0.9,
          }} />
        )}
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>{fmtShort(ps)}</span>
        <span style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace' }}>{fmtShort(pe)}</span>
      </div>
    </div>
  )
}

// ── Activity Card (detail mode) ────────────────────────────────────────────────
function ActivityCard({ act, index }) {
  const ss   = statusStyle(act.status)
  const sc   = STAGE_COLORS[act.stage] || '#94A3B8'
  const isDone = act.status.toLowerCase().includes('done') || act.progress_status === 'On-track' || act.progress_status === 'On-track (Ahead)'
  const isInProg = act.status.toLowerCase().includes('in progress')
  const isNotStarted = act.status.toLowerCase().includes('not started')

  return (
    <div style={{
      background: '#fff',
      border: `1.5px solid ${isInProg ? '#E8A030' : '#F1F5F9'}`,
      borderRadius: '16px', padding: '18px 20px',
      boxShadow: isInProg ? '0 4px 20px rgba(232,160,48,.10)' : '0 1px 6px rgba(0,0,0,.05)',
      transition: 'box-shadow .2s',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
        background: ss.dot, borderRadius: '16px 0 0 16px',
      }} />

      <div style={{ paddingLeft: '10px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
          <div style={{ flex: 1 }}>
            {/* Stage pill + index */}
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
            {/* Activity name */}
            <p style={{
              fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.5,
              textDecoration: isDone && !isInProg ? 'none' : 'none',
            }}>
              {act.activity}
            </p>
          </div>
          <StatusPill label={act.status} />
        </div>

        {/* Gantt timeline */}
        {act.plan_start && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '4px', background: '#CBD5E1', borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>Plan</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '4px', background: ss.dot, borderRadius: '2px', display: 'inline-block' }} />
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>Actual</span>
              </div>
              {act.progress_status && (
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', fontWeight: '700',
                  color: act.progress_status.includes('Ahead') ? '#166534' :
                         act.progress_status.includes('Delayed') ? '#92400E' : '#1E40AF',
                  background: act.progress_status.includes('Ahead') ? '#DCFCE7' :
                              act.progress_status.includes('Delayed') ? '#FEF3C7' : '#DBEAFE',
                  padding: '1px 8px', borderRadius: '99px',
                }}>⏱ {act.progress_status}</span>
              )}
            </div>
            <GanttBar
              planStart={act.plan_start} planEnd={act.plan_end}
              actualStart={act.actual_start} actualEnd={act.actual_end}
              status={act.progress_status}
            />
          </div>
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
      <span style={{
        fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace', textAlign: 'right',
      }}>
        {act.plan_start ? act.plan_start.split(' ')[0] : '—'}
      </span>
    </div>
  )
}

// ── DetailAktivitas — main section ────────────────────────────────────────────
function DetailAktivitas({ items = [] }) {
  const [view,          setView]          = useState('detail')   // 'detail' | 'ringkas'
  const [filterStage,   setFilterStage]   = useState('ALL')
  const [filterStatus,  setFilterStatus]  = useState('ALL')
  const [search,        setSearch]        = useState('')

  const stageNames = [...new Set(items.map(r => r.Stage).filter(Boolean))].sort()
  const stages = ['ALL', ...stageNames]
  const statusGroups = ['ALL', 'Done', 'In Progress', 'Not Started', 'Delayed', 'N/A']

  // Map Excel rows → same shape as old ALL_ACTIVITIES
  const allActivities = items.map(r => ({
    stage:           r.Stage || '',
    stageStatus:     r.Status || '',
    activity:        r.Activity || '',
    status:          r.Status || '',
    plan_start:      r['Planned Start Time'] ? new Date(r['Planned Start Time']).toLocaleString('id-ID') : null,
    plan_end:        r['Planned End Time']   ? new Date(r['Planned End Time']).toLocaleString('id-ID')   : null,
    actual_start:    r['Actual Start Time']  ? new Date(r['Actual Start Time']).toLocaleString('id-ID')  : null,
    actual_end:      r['Actual End Time']    ? new Date(r['Actual End Time']).toLocaleString('id-ID')    : null,
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

      {/* ── Section header ── */}
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

          {/* View toggle */}
          <div style={{
            display: 'flex', background: '#F1F5F9', borderRadius: '10px', padding: '3px', gap: '2px',
          }}>
            {[
              { key: 'ringkas', label: '☰  Ringkas', title: 'Tampilan ringkas untuk direksi' },
              { key: 'detail',  label: '⊞  Detail',  title: 'Tampilan detail dengan Gantt timeline' },
            ].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} title={v.title} style={{
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

        {/* ── Filters row ── */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Search */}
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
              style={{
                border: 'none', background: 'transparent', outline: 'none',
                fontSize: '12px', color: '#0F172A', width: '100%', fontFamily: 'inherit',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0 }}>×</button>
            )}
          </div>

          {/* Stage filter pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {stages.map(s => (
              <button key={s} onClick={() => setFilterStage(s)} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: '700', fontSize: '11px', fontFamily: 'inherit',
                background: filterStage === s
                  ? (s === 'ALL' ? '#0F172A' : STAGE_COLORS[s] || '#0F172A')
                  : '#F1F5F9',
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

          {/* Status filter */}
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

      {/* ── Status legend bar ── */}
      <div style={{
        display: 'flex', gap: '16px', padding: '10px 28px',
        background: '#FAFCFF', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap',
      }}>
        {[
          { label: 'Done / On-track', dot: '#16A34A', bg: '#DCFCE7' },
          { label: 'On-track (Ahead)', dot: '#3B82F6', bg: '#DBEAFE' },
          { label: 'Delayed', dot: '#D97706', bg: '#FEF3C7' },
          { label: 'In Progress', dot: '#F59E0B', bg: '#FEF9C3' },
          { label: 'Not Started', dot: '#DC2626', bg: '#FEE2E2' },
          { label: 'N/A', dot: '#94A3B8', bg: '#F1F5F9' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.dot }} />
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>{l.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94A3B8' }}>
          Gantt: <span style={{ color: '#CBD5E1', fontWeight: '600' }}>■</span> Plan &nbsp;
          <span style={{ color: '#01847C', fontWeight: '600' }}>■</span> Actual
        </span>
      </div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
          <p style={{ fontWeight: '600', fontSize: '14px' }}>Tidak ada aktivitas ditemukan</p>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>Coba ubah filter atau kata kunci pencarian</p>
        </div>
      ) : view === 'detail' ? (
        /* ─ DETAIL VIEW: Card grid ─ */
        <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '14px' }}>
          {filtered.map((act, i) => <ActivityCard key={i} act={act} index={i} />)}
        </div>
      ) : (
        /* ─ RINGKAS VIEW: compact table ─ */
        <div>
          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 130px 140px',
            gap: '12px', padding: '10px 16px',
            background: '#0F172A', margin: '16px 28px 0',
            borderRadius: '10px 10px 0 0',
          }}>
            {['Stage', 'Aktivitas', 'Status', 'Tgl Plan'].map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</span>
            ))}
          </div>
          <div style={{ margin: '0 28px 20px', border: '1px solid #F1F5F9', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: '10px' }}>
      {activities.map((a, i) => {
        const sc = statusMap[a.status] || statusMap['Not Started']
        const stageColor = stageColors[a.stage] || '#64748B'
        const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'
        return (
          <div key={i} style={{
            background: '#fff', borderRadius: '14px',
            border: `1.5px solid ${a.status === 'In Progress' ? '#E8A030' : '#F1F5F9'}`,
            padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start',
            boxShadow: a.status === 'In Progress' ? '0 4px 16px rgba(232,160,48,.12)' : '0 1px 4px rgba(0,0,0,.04)',
          }}>
            {/* Left: time */}
            <div style={{ minWidth: '52px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace', lineHeight: 1.2 }}>{fmtTime(a.planned_start)}</div>
              <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>–{fmtTime(a.planned_end)}</div>
            </div>
            {/* Center */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <span style={{ background: stageColor, color: '#fff', borderRadius: '5px', padding: '1px 7px', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>{a.stage}</span>
                <span style={{ fontSize: '10px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.event}</span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', lineHeight: 1.4, marginBottom: '3px' }}>{a.activity}</div>
              {a.area && <div style={{ fontSize: '11px', color: '#94A3B8' }}>Area: {a.area}</div>}
            </div>
            {/* Right: status + progress */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: sc.bg, color: sc.color, borderRadius: '99px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot }} />
                {a.status}
              </span>
              <span style={{ fontSize: '10px', color: a.progress === 1 ? '#16A34A' : '#94A3B8', fontWeight: '700' }}>
                {a.progress === 1 ? '✓ Done' : '○ Pending'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Upload Panel (Admin only) ─────────────────────────────────────────────────
function UploadFDRPanel({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [status,    setStatus]    = useState(null)   // {type:'ok'|'err', msg}
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
      border: '1.5px dashed #01847C55',
      boxShadow: '0 1px 6px rgba(0,0,0,.05)',
      display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>
          Upload FDR Excel
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
          Upload file <code style={{ background:'#F1F5F9', padding:'1px 4px', borderRadius:'4px' }}>fdr-all-progress.xlsx</code> yang didownload dari SharePoint
        </div>
        {status && (
          <div style={{
            marginTop: '8px', fontSize: '12px', fontWeight: '600',
            color: status.type === 'ok' ? '#16A34A' : '#DC2626',
            background: status.type === 'ok' ? '#F0FDF4' : '#FEF2F2',
            padding: '6px 10px', borderRadius: '8px',
          }}>
            {status.msg}
          </div>
        )}
      </div>
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '9px 18px', borderRadius: '10px', cursor: uploading ? 'not-allowed' : 'pointer',
        background: uploading ? '#94A3B8' : '#01847C',
        color: '#fff', fontSize: '13px', fontWeight: '700',
        boxShadow: uploading ? 'none' : '0 2px 8px rgba(1,132,124,.35)',
        transition: 'all .2s', whiteSpace: 'nowrap',
      }}>
        {uploading ? '⏳ Mengupload...' : '📂 Pilih File'}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload}
          disabled={uploading} style={{ display: 'none' }} />
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

  // ── Derive display values from API data ──────────────────────────────────
  const items          = fdrData?.items    || []
  const overall        = fdrData?.overall  || {}
  const stages         = fdrData?.stages   || []
  const timelines      = fdrData?.timelines || []

  // ── Today Activities: derived dynamically from items based on today's date ──
  const todayActivities = React.useMemo(() => {
    const todayStr = new Date().toDateString()
    return items
      .filter(r => {
        const ps = r['Planned Start Time']
        if (!ps) return false
        return new Date(ps).toDateString() === todayStr
      })
      .map(r => ({
        stage:         r.Stage        || '',
        activity:      r.Activity     || '',
        status:        r.Status       || 'Not Started',
        planned_start: r['Planned Start Time'] || null,
        planned_end:   r['Planned End Time']   || null,
        actual_start:  r['Actual Start Time']  || null,
        actual_end:    r['Actual End Time']    || null,
        event:         r.Event        || '',
        area:          r.Area         || '',
        progress:      (r.Status || '').toLowerCase().includes('done') ? 1 : 0,
      }))
      .sort((a, b) => {
        const ta = a.planned_start ? new Date(a.planned_start) : 0
        const tb = b.planned_start ? new Date(b.planned_start) : 0
        return ta - tb
      })
  }, [items])

  const completedActs   = overall.done        || 0
  const inProgressActs  = overall.in_progress || 0
  const notStartedActs  = overall.not_started || 0
  const totalActs       = overall.total       || 1
  const completedPct    = overall.done_pct    || 0
  const inProgressPct   = overall.in_progress_pct || 0
  const notStartedPct   = overall.not_started_pct || 0

  // META derived from API
  const overallPct = overall.progress_pct ?? completedPct
  const overallStatus = completedPct === 100 ? 'SELESAI' : inProgressPct > 0 ? 'ON PROGRESS' : 'BELUM MULAI'

  if (loading && !fdrData) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4F8', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTopColor: '#01847C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ color: '#64748B', fontSize: '14px' }}>Memuat data FDR dari Excel...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

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
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#01847C', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '13px',
          }}>BSI</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A', lineHeight: 1.2 }}>FDR Master Dashboard</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Full Dress Rehearsal · NEOM Core Banking</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#16A34A', borderRadius: '50%', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
            <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '600' }}>Live</span>
          </div>
          <span style={{ fontSize: '12px', color: '#94A3B8' }}>
            Update: {lastRefresh.toLocaleTimeString('id-ID')}
          </span>
          {user && (
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
                <div style={{ fontSize: '11px', color: '#64748B' }}>{user?.institution || 'Admin BSI'}</div>
              </div>
            </div>
          )}
          {onLogout && (
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
          )}
        </div>
      </nav>

      {/* ── HEADER BANNER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #01847C 0%, #016860 50%, #0F172A 100%)',
        padding: '28px 32px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: .05,
          backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        {/* Decorative circle */}
        <div style={{
          position: 'absolute', right: '-60px', top: '-60px',
          width: '280px', height: '280px', borderRadius: '50%',
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: '20px', top: '-20px',
          width: '160px', height: '160px', borderRadius: '50%',
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ background: 'rgba(232,160,48,.2)', color: '#E8A030', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(232,160,48,.3)' }}>
                CONFIDENTIAL
              </span>
              <span style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '600' }}>
                FDR 3 - April 2026
              </span>
            </div>
            <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-.5px', lineHeight: 1.1 }}>
              Dashboard Master FDR
            </h1>
            <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', marginTop: '6px' }}>
              Full Dress Rehearsal — NEOM Core Banking Upgrade BSI
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '6px' }}>OVERALL STATUS</div>
            <span style={{ padding: '6px 20px', borderRadius: '99px', background: '#DC2626', color: '#fff', fontWeight: '800', fontSize: '14px', display: 'inline-block' }}>
              {overallStatus}
            </span>
            <div style={{ marginTop: '10px', color: '#fff', fontFamily: 'monospace', fontSize: '32px', fontWeight: '800', lineHeight: 1 }}>
              {overallPct.toFixed(1)}%
            </div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', marginTop: '2px' }}>Overall Progress</div>
            <div style={{ marginTop: '6px', color: 'rgba(255,255,255,.55)', fontSize: '11px', fontFamily: 'monospace' }}>
              Target: FDR 3 — April 2026
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <main style={{ padding: '28px 32px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>

        {/* ── UPLOAD PANEL — admin only, hidden from presenter/OJK view ── */}
        {!readOnly && (
          <div style={{ marginBottom: '20px' }}>
            <UploadFDRPanel onSuccess={loadData} />
          </div>
        )}

        {/* ── ROW 1: Donut card + 3 Summary Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>

          {/* Donut card — "Upgrade Progress" style */}
          <div style={{
            background: '#fff', borderRadius: '20px', padding: '28px 24px',
            boxShadow: '0 1px 8px rgba(0,0,0,.06)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0', minWidth: '220px',
          }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', alignSelf: 'flex-start', marginBottom: '16px' }}>
              Upgrade Progress
            </div>
            <OverallDonut completed={completedPct} inProgress={inProgressPct} notStarted={notStartedPct} size={160} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '16px' }}>
              {[
                { label: 'Completed',   pct: completedPct,   count: completedActs,  color: '#01847C' },
                { label: 'In Progress', pct: inProgressPct,  count: inProgressActs, color: '#E8A030' },
                { label: 'Not Started', pct: notStartedPct,  count: notStartedActs, color: '#CBD5E1' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{s.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{s.pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3 Summary cards */}
          {[
            {
              label: 'Completed',
              value: completedActs,
              pct: completedPct,
              color: '#01847C',
              sub: `${completedPct.toFixed(1)}%`,
              tasks: `${completedActs} tasks`,
            },
            {
              label: 'In Progress',
              value: inProgressActs,
              pct: inProgressPct,
              color: '#E8A030',
              sub: `${inProgressPct.toFixed(1)}%`,
              tasks: `${inProgressActs} tasks`,
            },
            {
              label: 'Not Started',
              value: notStartedActs,
              pct: notStartedPct,
              color: '#64748B',
              sub: `${notStartedPct.toFixed(1)}%`,
              tasks: `${notStartedActs} tasks`,
            },
          ].map(k => (
            <div key={k.label} style={{
              background: '#fff', borderRadius: '20px', padding: '28px',
              boxShadow: '0 1px 8px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: k.color }} />
              <div>
                <p style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.6px' }}>{k.label}</p>
                <p style={{ fontSize: '48px', fontWeight: '800', color: '#0F172A', lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: '22px', fontWeight: '700', color: k.color, marginTop: '6px', lineHeight: 1 }}>{k.sub}</p>
                <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>{k.tasks}</p>
              </div>
              <div style={{ marginTop: '24px' }}>
                <div style={{ height: '5px', borderRadius: '99px', background: '#F1F5F9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${k.pct}%`, background: k.color, borderRadius: '99px', transition: 'width 1s ease' }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── TODAY ACTIVITIES ── */}
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

        {/* ── ROW 3: Progress per Stage — Vertical stacked bar list ── */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Progress per Stage</h2>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
              {[
                { color: '#01847C', label: 'Completed' },
                { color: '#E8A030', label: 'In Progress' },
                { color: '#E2E8F0', label: 'Not Started' },
              ].map(l => (
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
            ) : stages.map((s, i) => {
              const cPct = s.progress_pct    || s.done_pct        || 0  // Progress column
              const iPct = s.in_progress_pct || 0
              const nPct = Math.max(0, 100 - cPct - iPct)
              const statusRaw = cPct >= 100 ? 'DONE'
                : cPct > 0 || s.in_progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED'
              const statusColor =
                statusRaw === 'DONE'        ? '#01847C' :
                statusRaw === 'IN_PROGRESS' ? '#E8A030' : '#94A3B8'
              const statusLabel =
                statusRaw === 'DONE'        ? 'Completed' :
                statusRaw === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'
              const statusBg =
                statusRaw === 'DONE'        ? '#F0FDF9' :
                statusRaw === 'IN_PROGRESS' ? '#FFFBEB' : '#F8FAFC'

              return (
                <div key={i} style={{
                  padding: '18px 0',
                  borderBottom: i < stages.length - 1 ? '1px solid #F1F5F9' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                      <div style={{
                        background: statusColor, color: '#fff',
                        borderRadius: '8px', padding: '4px 10px',
                        fontSize: '11px', fontWeight: '800', letterSpacing: '.3px', whiteSpace: 'nowrap',
                      }}>
                        {s.stage}
                      </div>
                      {statusRaw === 'IN_PROGRESS' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          background: '#FFFBEB', color: '#92400E',
                          borderRadius: '99px', padding: '2px 8px', fontSize: '10px', fontWeight: '700',
                        }}>
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
                    <span style={{
                      padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: '700',
                      background: statusBg, color: statusColor,
                      border: `1px solid ${statusColor}20`, whiteSpace: 'nowrap', minWidth: '90px', textAlign: 'center',
                    }}>
                      {statusLabel}
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: statusColor, minWidth: '60px', textAlign: 'right' }}>
                      {(s.progress_pct || cPct).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', paddingLeft: '174px' }}>
                    <span style={{ fontSize: '12px', color: '#01847C', fontWeight: '600' }}>
                      ● Completed: <strong>{s.done}</strong>
                    </span>
                    <span style={{ fontSize: '12px', color: '#E8A030', fontWeight: '600' }}>
                      ● In Progress: <strong>{s.in_progress}</strong>
                    </span>
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>
                      ● Not Started: <strong>{s.not_started}</strong>
                    </span>
                    <span style={{ fontSize: '12px', color: '#CBD5E1', marginLeft: 'auto', fontWeight: '500' }}>
                      {s.total} aktivitas
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── ROW 4 + 5: Enhanced Detail Aktivitas ── */}
        <DetailAktivitas items={items} />

      </main>

      <footer style={{ padding: '16px 32px', borderTop: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>© 2026 Bank Syariah Indonesia · Dokumen Rahasia</span>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>Data diperbarui setiap 60 detik</span>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )
}