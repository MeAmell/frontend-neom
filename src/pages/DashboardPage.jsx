import { useState, useEffect, useCallback } from 'react'
import { fetchDashboard, downloadPDF } from '../utils/api'
import DonutChart from '../components/DonutChart'
import StageBar from '../components/StageBar'
import { RAGBadge, ProgressBar } from '../components/RAGBadge'

const REFRESH_INTERVAL = 60_000
const API_BASE = import.meta.env.VITE_API_URL || ''

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchFDR() {
  const token = sessionStorage.getItem('neom_token')
  const res = await fetch(`${API_BASE}/api/fdr-progress/stages`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('FDR fetch failed')
  return res.json()
}

async function fetchFDRToday() {
  const token = sessionStorage.getItem('neom_token')
  const res = await fetch(`${API_BASE}/api/fdr-progress/today`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Today fetch failed')
  return res.json()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date(new Date().toDateString())
  return Math.round(diff / 86400000)
}

function fmtDate(iso) {
  if (!iso) return null
  try { return new Date(iso) } catch { return null }
}

function fmtTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

function fmtDateShort(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
  } catch { return '—' }
}

// ─── Status style ─────────────────────────────────────────────────────────────
function statusStyle(s = '') {
  const sl = (s || '').toLowerCase()
  if (sl === 'done')         return { bg: '#DCFCE7', color: '#166534', dot: '#16A34A', label: 'Done' }
  if (sl === 'in progress')  return { bg: '#FEF9C3', color: '#854D0E', dot: '#E8A030', label: 'In Progress' }
  return                            { bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8', label: 'Not Started' }
}

function StatusChip({ status }) {
  const s = statusStyle(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: s.bg, color: s.color, borderRadius: '99px',
      padding: '3px 10px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

// ─── Gantt Chart Timeline ─────────────────────────────────────────────────────
const GANTT_MILESTONES = [
  { label: 'Pre-Cutover 1',  start: '2026-01-15', end: '2026-02-14', color: '#6366F1', phase: 'pre' },
  { label: 'Pre-Cutover 2',  start: '2026-02-15', end: '2026-02-28', color: '#8B5CF6', phase: 'pre' },
  { label: 'FDR 1',          start: '2026-02-17', end: '2026-02-21', color: '#0EA5E9', phase: 'fdr' },
  { label: 'FDR 2',          start: '2026-03-05', end: '2026-03-08', color: '#0EA5E9', phase: 'fdr' },
  { label: 'Cutover',        start: '2026-03-05', end: '2026-03-08', color: '#E8A030', phase: 'cut' },
  { label: 'Post-Cutover',   start: '2026-03-08', end: '2026-05-08', color: '#01847C', phase: 'post' },
  { label: 'Go-Live',        start: '2026-05-08', end: '2026-05-08', color: '#DC2626', phase: 'live', milestone: true },
]

function GanttTimeline() {
  const today = new Date()
  // Window: Jan 1 → Jun 30 2026
  const windowStart = new Date('2026-01-01')
  const windowEnd   = new Date('2026-06-30')
  const totalMs = windowEnd - windowStart

  const toX = (dateStr) => {
    const d = new Date(dateStr)
    const pct = Math.max(0, Math.min(100, ((d - windowStart) / totalMs) * 100))
    return pct
  }

  const todayX = toX(today.toISOString())

  // Month labels
  const months = []
  for (let m = 0; m <= 5; m++) {
    const d = new Date(2026, m, 1)
    months.push({
      label: d.toLocaleDateString('id-ID', { month: 'short' }),
      x: toX(d.toISOString()),
    })
  }

  const rows = [
    { key: 'pre',  label: 'Pre-Cutover',  bars: GANTT_MILESTONES.filter(m => m.phase === 'pre') },
    { key: 'fdr',  label: 'FDR',          bars: GANTT_MILESTONES.filter(m => m.phase === 'fdr') },
    { key: 'cut',  label: 'Cutover',      bars: GANTT_MILESTONES.filter(m => m.phase === 'cut') },
    { key: 'post', label: 'Post-Cutover', bars: GANTT_MILESTONES.filter(m => m.phase === 'post') },
    { key: 'live', label: 'Go-Live',      bars: GANTT_MILESTONES.filter(m => m.phase === 'live') },
  ]

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Month ruler */}
      <div style={{ position: 'relative', height: '28px', marginBottom: '6px', marginLeft: '88px' }}>
        {months.map((m, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${m.x}%`,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            transform: 'translateX(-50%)',
          }}>
            <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600', whiteSpace: 'nowrap' }}>{m.label}</span>
            <div style={{ width: '1px', height: '8px', background: '#E2E8F0', marginTop: '2px' }} />
          </div>
        ))}
        {/* Today line on ruler */}
        <div style={{
          position: 'absolute', left: `${todayX}%`,
          top: 0, bottom: 0, width: '2px',
          background: 'rgba(220,38,38,.5)',
          transform: 'translateX(-50%)',
        }} />
      </div>

      {/* Gantt rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {rows.map(row => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Row label */}
            <div style={{
              width: '80px', flexShrink: 0,
              fontSize: '11px', fontWeight: '600', color: '#64748B',
              textAlign: 'right',
            }}>
              {row.label}
            </div>

            {/* Track */}
            <div style={{ flex: 1, height: '28px', position: 'relative', background: '#F8FAFC', borderRadius: '6px' }}>
              {/* Grid lines */}
              {months.map((m, i) => (
                <div key={i} style={{
                  position: 'absolute', left: `${m.x}%`, top: 0, bottom: 0,
                  width: '1px', background: '#E2E8F0',
                }} />
              ))}

              {/* Bars */}
              {row.bars.map((bar, bi) => {
                const x1 = toX(bar.start)
                const x2 = toX(bar.end)
                const w  = Math.max(x2 - x1, bar.milestone ? 0 : 0.5)
                const isPast = new Date(bar.end) < today
                const isActive = new Date(bar.start) <= today && new Date(bar.end) >= today

                if (bar.milestone) {
                  return (
                    <div key={bi} title={`${bar.label}: ${fmtDateShort(bar.start)}`} style={{
                      position: 'absolute', left: `${x1}%`, top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '14px', height: '14px',
                      background: bar.color, borderRadius: '3px',
                      rotate: '45deg',
                      boxShadow: `0 0 0 3px ${bar.color}30`,
                      zIndex: 2,
                    }} />
                  )
                }

                return (
                  <div key={bi} title={`${bar.label}: ${fmtDateShort(bar.start)} → ${fmtDateShort(bar.end)}`} style={{
                    position: 'absolute',
                    left: `${x1}%`, width: `${w}%`,
                    top: '6px', height: '16px',
                    background: isPast
                      ? `${bar.color}cc`
                      : isActive
                      ? bar.color
                      : `${bar.color}55`,
                    borderRadius: '4px',
                    border: isActive ? `2px solid ${bar.color}` : 'none',
                    boxShadow: isActive ? `0 2px 8px ${bar.color}40` : 'none',
                    display: 'flex', alignItems: 'center', overflow: 'hidden',
                    paddingLeft: '5px',
                    cursor: 'default',
                    zIndex: 1,
                  }}>
                    {w > 8 && (
                      <span style={{ fontSize: '9px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {bar.label}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* Today vertical line */}
              <div style={{
                position: 'absolute', left: `${todayX}%`, top: 0, bottom: 0,
                width: '2px', background: '#DC2626',
                transform: 'translateX(-50%)', zIndex: 3,
              }}>
                {/* dot at top */}
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DC2626', marginLeft: '-2px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', marginLeft: '88px', flexWrap: 'wrap' }}>
        {[
          { color: '#6366F1', label: 'Pre-Cutover' },
          { color: '#0EA5E9', label: 'FDR' },
          { color: '#E8A030', label: 'Cutover' },
          { color: '#01847C', label: 'Post-Cutover' },
          { color: '#DC2626', label: 'Go-Live ◆' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '12px', height: '6px', background: l.color, borderRadius: '2px', display: 'inline-block' }} />
            <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '500' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '2px', height: '12px', background: '#DC2626' }} />
          <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: '600' }}>Hari Ini</span>
        </div>
      </div>
    </div>
  )
}

// ─── Today Activities section ─────────────────────────────────────────────────
function TodayActivities({ activities = [] }) {
  const today = new Date()
  const todayLabel = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const doneCount    = activities.filter(a => a.status === 'Done').length
  const inProgCount  = activities.filter(a => a.status === 'In Progress').length
  const notStCount   = activities.filter(a => a.status === 'Not Started').length

  if (activities.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📅</div>
        <p style={{ fontWeight: '600', fontSize: '13px' }}>Tidak ada aktivitas terjadwal hari ini</p>
        <p style={{ fontSize: '12px', marginTop: '4px' }}>{todayLabel}</p>
      </div>
    )
  }

  return (
    <div>
      {/* Mini summary bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Done',        count: doneCount,   color: '#01847C', bg: '#F0FDF9' },
          { label: 'In Progress', count: inProgCount, color: '#E8A030', bg: '#FFFBEB' },
          { label: 'Not Started', count: notStCount,  color: '#94A3B8', bg: '#F8FAFC' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: '10px 12px', background: s.bg, borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>{s.label}</span>
            <span style={{ fontSize: '18px', fontWeight: '800', color: s.color }}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Activity list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
        {activities.map((act, i) => {
          const ss = statusStyle(act.status)
          const isActive = act.status === 'In Progress'

          return (
            <div key={i} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              padding: '12px 14px',
              background: isActive ? '#FFFBEB' : '#F8FAFC',
              borderRadius: '12px',
              border: `1.5px solid ${isActive ? '#E8A03040' : '#F1F5F9'}`,
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Left accent */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                background: ss.dot, borderRadius: '12px 0 0 12px',
              }} />

              {/* Time block */}
              <div style={{
                flexShrink: 0, textAlign: 'center',
                background: '#fff', borderRadius: '8px', padding: '6px 8px',
                border: '1px solid #E2E8F0', minWidth: '58px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', lineHeight: 1 }}>
                  {fmtTime(act.planned_start)}
                </div>
                <div style={{ fontSize: '9px', color: '#94A3B8', marginTop: '2px', fontWeight: '500' }}>
                  → {fmtTime(act.planned_end)}
                </div>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  {act.stage && (
                    <span style={{
                      background: '#0F172A', color: '#fff', borderRadius: '4px',
                      padding: '1px 6px', fontSize: '9px', fontWeight: '800',
                    }}>{act.stage}</span>
                  )}
                  {act.event && (
                    <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '500' }}>{act.event}</span>
                  )}
                </div>
                <p style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', lineHeight: 1.4, margin: 0 }}>
                  {act.activity}
                </p>
                {act.area && (
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', margin: 0 }}>
                    Area: {act.area}
                  </p>
                )}
              </div>

              {/* Status + progress */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                <StatusChip status={act.status} />
                {act.progress > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: ss.color }}>
                    {Math.round(act.progress * 100)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── OJK Activities — reads from FDR Excel stages ────────────────────────────
const PHASE_COLOR = {
  'Pre-Cutover':  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'Cutover':      { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  'Post-Cutover': { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
}
const OJK_STATUS = {
  DONE:        { bg: '#DCFCE7', color: '#15803D', label: 'Done'        },
  IN_PROGRESS: { bg: '#FEF9C3', color: '#854D0E', label: 'On Going'    },
  NOT_STARTED: { bg: '#F1F5F9', color: '#64748B', label: 'Not Started' },
}

function OJKActivities({ stages = [] }) {
  const [openStage, setOpenStage] = useState(null)
  const [openEvent, setOpenEvent] = useState({})

  if (!stages.length) return (
    <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
      <p style={{ fontSize: '13px', fontWeight: '600' }}>Upload FDR Excel untuk melihat aktivitas</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {stages.map((stage, si) => {
        const isOpen = openStage === si
        const ss     = OJK_STATUS[stage.ojk_status] || OJK_STATUS.NOT_STARTED
        const pc     = PHASE_COLOR[stage.phase]      || PHASE_COLOR['Cutover']
        const progPct = stage.progress_pct || 0

        return (
          <div key={si} style={{ borderRadius: '12px', border: `1px solid ${isOpen ? '#01847C30' : '#E2E8F0'}`, overflow: 'hidden', boxShadow: isOpen ? '0 2px 12px rgba(1,132,124,.08)' : 'none' }}>
            {/* Stage header row */}
            <div
              onClick={() => setOpenStage(p => p === si ? null : si)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', background: isOpen ? '#F8FFFE' : '#fff', transition: 'background .15s' }}
            >
              {/* Stage badge */}
              <div style={{ flexShrink: 0, borderRadius: '8px', padding: '4px 10px', background: '#0F172A', color: '#fff', fontSize: '10px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                {stage.stage}
              </div>
              {/* Title */}
              <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: '#0F172A', minWidth: 0 }}>
                {stage.title || stage.stage}
              </span>
              {/* Progress */}
              <span style={{ fontSize: '12px', fontWeight: '800', color: progPct > 0 ? '#01847C' : '#94A3B8', whiteSpace: 'nowrap' }}>
                {progPct}%
              </span>
              {/* Phase pill */}
              <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: 0, background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                {stage.phase}
              </span>
              {/* Status pill */}
              <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '99px', whiteSpace: 'nowrap', flexShrink: 0, background: ss.bg, color: ss.color }}>
                {ss.label}
              </span>
              <span style={{ fontSize: '14px', color: '#94A3B8', flexShrink: 0, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
            </div>

            {/* Progress bar under header */}
            {progPct > 0 && (
              <div style={{ height: '3px', background: '#F1F5F9' }}>
                <div style={{ height: '100%', width: `${progPct}%`, background: '#01847C', transition: 'width .6s' }} />
              </div>
            )}

            {/* Expanded: events from Excel */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #F1F5F9', background: '#FAFCFF' }}>
                {(stage.events || []).length === 0 ? (
                  <div style={{ padding: '16px 48px', fontSize: '12px', color: '#94A3B8' }}>Tidak ada event data</div>
                ) : (stage.events || []).map((ev, ei) => {
                  const evKey = `${si}-${ei}`
                  const evOpen = openEvent[evKey]
                  const evDone = ev.done || 0
                  const evTotal = ev.total || 1
                  const evProg = ev.progress_pct || ev.done_pct || 0
                  const evColor = evProg >= 100 ? '#16A34A' : evProg > 0 ? '#E8A030' : '#94A3B8'

                  return (
                    <div key={ei} style={{ borderBottom: ei < stage.events.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                      <div
                        onClick={() => setOpenEvent(p => ({ ...p, [evKey]: !p[evKey] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px 10px 44px', cursor: 'pointer', background: evOpen ? '#F1F5F9' : 'transparent', transition: 'background .12s' }}
                      >
                        {/* Event dot */}
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: evColor, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '12px', fontWeight: '600', color: '#334155' }}>{ev.event}</span>
                        {/* Mini progress */}
                        <span style={{ fontSize: '11px', color: evColor, fontWeight: '700', whiteSpace: 'nowrap' }}>
                          {evDone}/{evTotal} done · {evProg}%
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8', transform: evOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
                      </div>

                      {/* Activity list */}
                      {evOpen && (
                        <div style={{ padding: '4px 16px 12px 68px', background: '#F8FAFC' }}>
                          {(ev.activity_list || []).length === 0 ? (
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Tidak ada aktivitas</span>
                          ) : (ev.activity_list || []).map((act, ai) => (
                            <div key={ai} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 0', borderBottom: ai < ev.activity_list.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#01847C', flexShrink: 0, marginTop: '5px' }} />
                              <span style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{act}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Stage summary footer */}
                <div style={{ padding: '10px 16px', display: 'flex', gap: '16px', background: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '11px', color: '#01847C', fontWeight: '600' }}>✓ Done: {stage.done}</span>
                  <span style={{ fontSize: '11px', color: '#E8A030', fontWeight: '600' }}>⚙ In Progress: {stage.in_progress}</span>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500' }}>○ Not Started: {stage.not_started}</span>
                  <span style={{ fontSize: '11px', color: '#CBD5E1', marginLeft: 'auto' }}>{stage.total} aktivitas total</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stage Progress (consume FDR data) ────────────────────────────────────────
function FDRStageBar({ stage }) {
  const cPct = stage.done_pct      || 0
  const iPct = stage.in_progress_pct || 0
  const nPct = stage.not_started_pct || 0
  const progPct = stage.progress_pct || 0

  const statusColor = cPct >= 100 ? '#01847C' : iPct > 0 ? '#E8A030' : '#94A3B8'
  const statusLabel = cPct >= 100 ? 'Done' : iPct > 0 ? 'In Progress' : 'Not Started'
  const statusBg    = cPct >= 100 ? '#DCFCE7' : iPct > 0 ? '#FEF9C3' : '#F1F5F9'

  return (
    <div style={{
      background: '#fff', borderRadius: '14px', padding: '16px 20px',
      border: `1.5px solid ${iPct > 0 && cPct < 100 ? '#E8A03040' : '#F1F5F9'}`,
      boxShadow: '0 1px 4px rgba(0,0,0,.05)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: statusColor, color: '#fff', borderRadius: '8px', padding: '3px 10px', fontSize: '11px', fontWeight: '800' }}>
            {stage.stage}
          </div>
          {iPct > 0 && cPct < 100 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FEF9C3', color: '#92400E', borderRadius: '99px', padding: '2px 8px', fontSize: '10px', fontWeight: '700' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#E8A030', animation: 'blink 1.5s infinite' }} />
              On Going
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ padding: '2px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '700', background: statusBg, color: statusColor }}>{statusLabel}</span>
          <span style={{ fontSize: '20px', fontWeight: '800', color: statusColor }}>{progPct}%</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{ height: '8px', borderRadius: '99px', overflow: 'hidden', background: '#F1F5F9', display: 'flex' }}>
        {cPct > 0 && <div style={{ width: `${cPct}%`, background: '#01847C' }} />}
        {iPct > 0 && <div style={{ width: `${iPct}%`, background: '#E8A030' }} />}
        {nPct > 0 && <div style={{ width: `${nPct}%`, background: '#E2E8F0' }} />}
      </div>

      {/* Sub stats */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
        <span style={{ fontSize: '11px', color: '#01847C', fontWeight: '600' }}>✓ Done: {cPct}%</span>
        <span style={{ fontSize: '11px', color: '#E8A030', fontWeight: '600' }}>⚙ Progress: {iPct}%</span>
        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '500' }}>○ Not Started: {nPct}%</span>
        <span style={{ fontSize: '11px', color: '#CBD5E1', marginLeft: 'auto' }}>{stage.total} aktivitas</span>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', padding: '32px' }}>
      <div style={{ height: '64px', background: '#fff', borderRadius: '12px', marginBottom: '24px', opacity: .5 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: '140px', background: '#fff', borderRadius: '20px', opacity: .4 }} />)}
      </div>
      {[1, 2, 3].map(i => <div key={i} style={{ height: '80px', background: '#fff', borderRadius: '14px', marginBottom: '12px', opacity: .4 }} />)}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage({ user, onLogout }) {
  const [ojkData,     setOjkData]     = useState(null)
  const [fdrData,     setFdrData]     = useState(null)
  const [todayActs,   setTodayActs]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [filterStage, setFilterStage] = useState(null)

  // Load OJK-side data (Google Sheets / dummy)
  const loadOJK = useCallback(async () => {
    try {
      const d = await fetchDashboard(filterStage)
      setOjkData(d)
    } catch (e) { console.error('[OJK]', e) }
  }, [filterStage])

  // Load FDR Excel data
  const loadFDR = useCallback(async () => {
    try {
      const d = await fetchFDR()
      setFdrData(d)
      // Pull today activities from overall FDR response
      if (d.today_activities) setTodayActs(d.today_activities)
    } catch (e) {
      console.error('[FDR]', e)
      // Fallback: try dedicated today endpoint
      try {
        const t = await fetchFDRToday()
        setTodayActs(t.activities || [])
      } catch {}
    }
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([loadOJK(), loadFDR()])
    setLastRefresh(new Date())
    setLoading(false)
  }, [loadOJK, loadFDR])

  useEffect(() => {
    setLoading(true)
    loadAll()
    const t = setInterval(loadAll, REFRESH_INTERVAL)
    return () => clearInterval(t)
  }, [loadAll])

  const handleDownload = async () => {
    setDownloading(true)
    try { await downloadPDF() } finally { setDownloading(false) }
  }

  if (loading && !ojkData && !fdrData) return <Skeleton />

  // Merge: prefer FDR overall if available, else fall back to OJK overall
  const fdrOverall  = fdrData?.overall   || {}
  const ojkOverall  = ojkData?.overall   || {}
  const o           = fdrOverall.total ? fdrOverall : ojkOverall

  const fdrStages   = fdrData?.stages    || []
  const ojkStages   = ojkData?.stages    || []

  const detail      = ojkData?.detail_summary        || []
  const ops         = ojkData?.operational_readiness || []
  const acts        = ojkData?.ojk_activities        || []

  const today       = new Date()
  const todayLabel  = today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Go-live from OJK calendar
  const cal     = ojkData?.calendar || []
  const goLive  = cal.find(c => c.type === 'golive')
  const dGoLive = goLive ? daysUntil(goLive.date) : null

  // Displayed stages: FDR stages if available else OJK
  const displayStages = fdrStages.length > 0 ? fdrStages : ojkStages

  // Filter stages by index (pill 0=Stage 0, 1=Stage 1, etc.)
  const filteredStages = filterStage !== null
    ? displayStages.filter((s, i) =>
        i === filterStage ||
        s.stage === `Stage ${filterStage}` ||
        s.id === filterStage
      )
    : displayStages

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── TOP NAV ── */}
      <nav style={{
        background: '#fff', borderBottom: '1px solid #E2E8F0',
        padding: '0 32px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#01847C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '13px' }}>BSI</div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A', lineHeight: 1.2 }}>NEOM Dashboard</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Core Banking Upgrade · OJK View</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: '#16A34A', borderRadius: '50%', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
            <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '600' }}>Live</span>
          </div>
          {lastRefresh && (
            <span style={{ fontSize: '12px', color: '#94A3B8' }}>Update: {lastRefresh.toLocaleTimeString('id-ID')}</span>
          )}
          <button onClick={handleDownload} disabled={downloading} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '10px',
            background: '#E8A030', color: '#fff', fontWeight: '600', fontSize: '13px',
            cursor: downloading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: downloading ? .7 : 1,
          }}>
            {downloading ? '⏳' : '⬇️'} Download PDF
          </button>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', borderRadius: '10px', padding: '6px 12px', border: '1px solid #E2E8F0' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#01847C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '11px' }}>{user?.name?.[0] || 'U'}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.2 }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>{user?.institution}</div>
              </div>
            </div>
          )}
          <button onClick={() => { sessionStorage.removeItem('neom_token'); onLogout() }} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: '1.5px solid #FCA5A5', borderRadius: '10px',
            background: '#FFF1F1', color: '#DC2626', fontWeight: '700', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#FFF1F1'; e.currentTarget.style.color = '#DC2626' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Keluar
          </button>
        </div>
      </nav>

      {/* ── HEADER BANNER ── */}
      <div style={{ background: 'linear-gradient(135deg, #01847C 0%, #016860 50%, #0F172A 100%)', padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .05, backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div style={{ position: 'absolute', right: '-60px', top: '-60px', width: '260px', height: '260px', borderRadius: '50%', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ background: 'rgba(232,160,48,.2)', color: '#E8A030', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(232,160,48,.3)' }}>CONFIDENTIAL</span>
              <span style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '600' }}>
                {ojkData?.location || 'Jakarta, Indonesia'}
              </span>
            </div>
            <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', letterSpacing: '-.5px', lineHeight: 1.1 }}>
              {ojkData?.project_name || 'NEOM Core Banking Upgrade'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', marginTop: '6px' }}>
              Laporan Progress untuk Otoritas Jasa Keuangan (OJK)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {/* Last update */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>LATEST UPDATE</div>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '12px' }}>
                {fdrData?.last_update
                  ? new Date(fdrData.last_update).toLocaleString('id-ID')
                  : ojkData?.last_update
                  ? new Date(ojkData.last_update).toLocaleString('id-ID')
                  : '—'}
              </div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: 'rgba(255,255,255,.4)' }}>
                {fdrData ? '📊 Sumber: Excel FDR' : '📡 Sumber: Google Sheets'}
              </div>
            </div>
            {/* Go-Live countdown */}
            {dGoLive !== null && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>GO-LIVE</div>
                <div style={{ background: 'rgba(220,38,38,.2)', color: '#FCA5A5', padding: '6px 16px', borderRadius: '99px', fontSize: '14px', fontWeight: '800', border: '1px solid rgba(220,38,38,.3)' }}>
                  D-{Math.abs(dGoLive)}
                </div>
              </div>
            )}
            {/* Overall progress */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>OVERALL PROGRESS</div>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '32px', fontWeight: '800', lineHeight: 1 }}>
                {(o.progress_pct ?? o.completed_pct ?? 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN BODY ── */}
      <main style={{ padding: '28px 32px', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>

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

        {/* ── ROW 1: KPI Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {/* Donut */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '210px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', alignSelf: 'flex-start', marginBottom: '14px' }}>Upgrade Progress</div>
            <DonutChart
              completed={o.done_pct || o.completed_pct || 0}
              inProgress={o.in_progress_pct || 0}
              notStarted={o.not_started_pct || 0}
            />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '14px' }}>
              {[
                { label: 'Completed',   pct: o.done_pct || o.completed_pct || 0, color: '#01847C' },
                { label: 'In Progress', pct: o.in_progress_pct || 0,              color: '#E8A030' },
                { label: 'Not Started', pct: o.not_started_pct || 0,              color: '#CBD5E1' },
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

          {/* 3 KPI cards */}
          {[
            { label: 'Total Tasks',  value: (o.total || o.total_tasks || 0).toLocaleString(), sub: `${o.done || o.completed_count || 0} selesai`, color: '#01847C', icon: '📋' },
            { label: 'Completed',    value: `${(o.done_pct || o.completed_pct || 0).toFixed(1)}%`, sub: `${o.done || o.completed_count || 0} tasks`, color: '#16A34A', icon: '✅' },
            { label: 'In Progress',  value: `${(o.in_progress_pct || 0).toFixed(1)}%`, sub: `${o.in_progress || o.in_progress_count || 0} tasks`, color: '#E8A030', icon: '⚙️' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: '20px', padding: '28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden' }}>
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
                <ProgressBar value={parseFloat(k.value) || 0} color={k.color} />
              </div>
            </div>
          ))}
        </div>

        {/* ── ROW 2: Stage Progress (dari FDR Excel) ── */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Stage Progress</h2>
              {fdrData && (
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  Data real-time dari Excel FDR · diperbarui otomatis saat file berubah
                </p>
              )}
            </div>
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
            {filteredStages.length > 0
              ? filteredStages.map((s, i) => <FDRStageBar key={i} stage={s} />)
              : ojkStages.map(s => (
                  <StageBar key={s.id} stage={s} />
                ))
            }
          </div>
        </div>

        {/* ── ROW 3: Gantt Timeline + Today Activities ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', marginBottom: '24px' }}>

          {/* Gantt */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Timeline NEOM 2026</h2>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Jan – Jun 2026 · Garis merah = Hari ini</p>
              </div>
              <span style={{ background: '#F1F5F9', borderRadius: '8px', padding: '4px 12px', fontSize: '11px', color: '#64748B', fontWeight: '600', fontFamily: 'monospace' }}>
                {today.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <GanttTimeline />
          </div>

          {/* Today Activities */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Aktivitas Hari Ini</h2>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{todayLabel}</p>
              </div>
              {todayActs.length > 0 && (
                <span style={{ background: '#01847C', color: '#fff', borderRadius: '99px', padding: '3px 10px', fontSize: '11px', fontWeight: '700' }}>
                  {todayActs.length} aktivitas
                </span>
              )}
            </div>
            <TodayActivities activities={todayActs} />
          </div>
        </div>

        {/* ── ROW 4: OJK Activities + Detail Summary ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '24px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                Aktivitas per Stage — OJK View
                {fdrStages.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: '500', color: '#94A3B8', marginLeft: '8px' }}>
                    dari Excel FDR · {fdrStages.length} stage
                  </span>
                )}
              </h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ bg: '#EFF6FF', text: '#1D4ED8', label: 'Pre-Cutover' }, { bg: '#FFF7ED', text: '#C2410C', label: 'Cutover' }, { bg: '#F0FDF4', text: '#15803D', label: 'Post' }].map(p => (
                  <span key={p.label} style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '99px', background: p.bg, color: p.text }}>{p.label}</span>
                ))}
              </div>
            </div>
            <OJKActivities stages={fdrStages.length > 0 ? fdrStages : []} />
          </div>

          {/* Detail Summary */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Detail Summary</h2>
            {detail.length > 0 ? (
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
                      <td style={{ padding: '10px 4px', width: '90px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ flex: 1 }}>
                            <ProgressBar value={d.progress} color={d.status === 'GREEN' ? '#16A34A' : d.status === 'RED' ? '#DC2626' : '#D97706'} height={5} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>{d.progress}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 4px', fontSize: '12px', color: '#64748B' }}>{d.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
                <p style={{ fontSize: '13px', fontWeight: '600' }}>Data belum tersedia</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 5: Operational Readiness ── */}
        {ops.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px 28px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '16px' }}>Operational Readiness</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
              {ops.map((op, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', color: '#0F172A' }}>{op.area}</div>
                    {op.notes && <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{op.notes}</div>}
                  </div>
                  <RAGBadge status={op.status} />
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer style={{ padding: '16px 32px', borderTop: '1px solid #E2E8F0', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>© 2026 Bank Syariah Indonesia · Dokumen Rahasia</span>
        <span style={{ fontSize: '12px', color: '#94A3B8' }}>
          Data diperbarui setiap {REFRESH_INTERVAL / 1000}s
          {fdrData && <> · <span style={{ color: '#01847C', fontWeight: '600' }}>📊 FDR Excel aktif</span></>}
        </span>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 99px; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
      `}</style>
    </div>
  )
}