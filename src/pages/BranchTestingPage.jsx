import React, { useState, useEffect, useCallback } from 'react'
import { fetchBranchTesting } from '../utils/api'

const REFRESH_INTERVAL = 60_000

const C = {
  teal:      '#01847C',
  tealDark:  '#016860',
  passed:    '#16A34A',
  passedBg:  '#F0FDF4',
  failed:    '#FB7185',
  failedBg:  '#FFF1F3',
  failedDark:'#E11D48',
  slate:     '#64748B',
  muted:     '#94A3B8',
  border:    '#E2E8F0',
  surface:   '#F8FAFC',
  bg:        '#F0F4F8',
}

function StatusPill({ status }) {
  const map = {
    Passed:        { bg: C.passedBg, color: C.passed,     label: 'Done'        },
    Failed:        { bg: C.failedBg, color: C.failedDark, label: 'On Progress' },
    'Not Started': { bg: C.surface,  color: C.slate,      label: 'Not Started' },
  }
  const s = map[status] || map['Not Started']
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '99px', background: s.bg, color: s.color, fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function DonutSmall({ passed, failed, notStarted, total, size = 88, strokeW = 10 }) {
  const r = (size / 2) - strokeW, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  const pPct = total > 0 ? passed / total : 0
  const fPct = total > 0 ? failed / total : 0
  const nPct = total > 0 ? notStarted / total : 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={strokeW} />
      {total > 0 && <>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.teal} strokeWidth={strokeW}
          strokeDasharray={`${circ*pPct} ${circ}`} strokeDashoffset="0"
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.failed} strokeWidth={strokeW}
          strokeDasharray={`${circ*fPct} ${circ}`} strokeDashoffset={`${-(circ*pPct)}`}
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#CBD5E1" strokeWidth={strokeW}
          strokeDasharray={`${circ*nPct} ${circ}`} strokeDashoffset={`${-(circ*(pPct+fPct))}`}
          transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
      </>}
      <text x={cx} y={cy-4} textAnchor="middle" fontSize={size>100?20:13} fontWeight="800" fill="#0F172A">
        {total > 0 ? Math.round(pPct*100) : 0}%
      </text>
      <text x={cx} y={cy+(size>100?16:10)} textAnchor="middle" fontSize={size>100?11:9} fill={C.muted}>passed</text>
    </svg>
  )
}

function SummaryCard({ label, value, total, color, pct, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: '20px', padding: '22px 24px', boxShadow: '0 1px 8px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '11px', color: C.slate, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>{label}</div>
          <div style={{ fontSize: '36px', fontWeight: '800', color: '#0F172A', lineHeight: 1 }}>{value}</div>
          {total != null && <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px' }}>dari {total}{pct != null ? ` (${pct}%)` : ''}</div>}
        </div>
        {icon && <div style={{ width: '46px', height: '46px', borderRadius: '14px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{icon}</div>}
      </div>
      {pct != null && (
        <div style={{ marginTop: '16px', height: '5px', background: '#F1F5F9', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width .6s' }} />
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '14px 16px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '10px', color: C.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
        <div style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  )
}

function IssueList({ branches }) {
  const issues = branches.filter(b => b.status === 'Failed' && b.keterangan && b.keterangan !== '-').slice(0, 5)
  if (!issues.length) return <div style={{ fontSize: '12px', color: C.muted, padding: '12px 0' }}>Tidak ada keterangan issue</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {issues.map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', background: C.failedBg, borderRadius: '10px', border: '1px solid #FECDD3' }}>
          <span style={{ width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0, background: '#FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800', color: C.failedDark }}>{i+1}</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>
              {b.kantor_cabang}
              {b.kode_cabang && <span style={{ fontWeight: '400', color: C.muted, marginLeft: '6px', fontFamily: 'monospace', fontSize: '10px' }}>{b.kode_cabang}</span>}
            </div>
            <div style={{ fontSize: '11px', color: C.failedDark, marginTop: '1px', opacity: .85 }}>{b.keterangan}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RegionalBreakdown({ branches }) {
  const map = {}
  branches.forEach(b => {
    if (!map[b.regional]) map[b.regional] = { passed: 0, failed: 0, total: 0 }
    map[b.regional].total++
    if (b.status === 'Passed') map[b.regional].passed++
    if (b.status === 'Failed') map[b.regional].failed++
  })
  const rows = Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  if (!rows.length) return <div style={{ fontSize: '12px', color: C.muted }}>Tidak ada data</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {rows.map(([regional, stat]) => {
        const pct = stat.total > 0 ? Math.round((stat.passed / stat.total) * 100) : 0
        const shortName = regional.replace(/^Regional\s+\S+\s+-\s+/i, '').replace(/^Region\s+\w+\s+-\s+/i, '') || regional
        return (
          <div key={regional} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: C.slate, minWidth: '130px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={regional}>{shortName}</div>
            <div style={{ flex: 1, height: '6px', background: C.border, borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: C.teal, borderRadius: '99px', transition: 'width .6s' }} />
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A', minWidth: '34px', textAlign: 'right' }}>{pct}%</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '99px', background: C.passedBg, color: C.passed, fontWeight: '700' }}>{stat.passed}✓</span>
              {stat.failed > 0 && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '99px', background: C.failedBg, color: C.failedDark, fontWeight: '700' }}>{stat.failed}✗</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BranchRow({ branch, onClickFailed }) {
  return (
    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{branch.kantor_cabang}</div>
        {branch.kode_cabang && <div style={{ fontSize: '10px', color: C.muted, marginTop: '2px', fontFamily: 'monospace' }}>{branch.kode_cabang}</div>}
      </td>
      <td style={{ padding: '10px 14px', fontSize: '12px', color: C.slate }}>{branch.area || branch.nama || '—'}</td>
      <td style={{ padding: '10px 14px' }}><StatusPill status={branch.status} /></td>
      <td style={{ padding: '10px 14px', fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{branch.tanggal || '—'}</td>
      <td style={{ padding: '10px 14px' }}>
        {branch.status === 'Failed' && (
          <button onClick={() => onClickFailed(branch)} style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '8px', background: C.failedBg, color: C.failedDark, border: '1px solid #FECDD3', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '600' }}>Lihat Detail</button>
        )}
      </td>
    </tr>
  )
}

function FailedModal({ branch, onClose }) {
  if (!branch) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px', color: '#0F172A' }}>{branch.kantor_cabang}</div>
            <div style={{ fontSize: '12px', color: C.slate, marginTop: '2px' }}>{branch.regional}{branch.area ? ` · ${branch.area}` : ''}{branch.kode_cabang ? ` · ${branch.kode_cabang}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ background: C.failedBg, borderRadius: '12px', padding: '14px 16px', marginBottom: '18px', border: '1px solid #FECDD3' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: C.failedDark, marginBottom: '4px' }}>{branch.failed_tcs?.length} Test Case On Progress / Failed</div>
          {branch.keterangan && branch.keterangan !== '-' && <div style={{ fontSize: '12px', color: C.failedDark, marginTop: '4px', opacity: .8 }}>Keterangan: {branch.keterangan}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {branch.failed_tcs?.map((tc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: '#FFF8F9', borderRadius: '10px', border: '1px solid #FCE7EB' }}>
              <span style={{ width: '24px', height: '24px', borderRadius: '7px', background: '#FECDD3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '800', color: C.failedDark, flexShrink: 0 }}>{tc.tc_id}</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>{tc.tc_name}</div>
                <div style={{ fontSize: '11px', color: C.failedDark, marginTop: '2px' }}>Result: {tc.result}</div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: '22px', padding: '11px', borderRadius: '10px', background: C.teal, color: '#fff', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Tutup</button>
      </div>
    </div>
  )
}

// ── Overall Progress Section ───────────────────────────────────────────────────
// Rule: % tested = (Passed + Failed) / Total branches
// Done = Passed, On Progress = Failed (tested but has issues), Not Started = belum submit
function OverallProgressSection({ exaData, t24Data }) {
  if (!exaData && !t24Data) return null

  const exaTotal  = exaData?.total_branches || 0
  const exaDone   = exaData?.passed || 0
  const exaOnProg = exaData?.failed || 0
  const exaNS     = exaData?.not_started || 0

  const t24Total  = t24Data?.total_branches || 0
  const t24Done   = t24Data?.passed || 0
  const t24OnProg = t24Data?.failed || 0
  const t24NS     = t24Data?.not_started || 0

  const grandTotal  = exaTotal + t24Total
  const grandDone   = exaDone + t24Done
  const grandOnProg = exaOnProg + t24OnProg
  const grandNS     = exaNS + t24NS
  const grandTested = grandDone + grandOnProg

  const testedPct  = grandTotal > 0 ? Math.round((grandTested / grandTotal) * 100) : 0
  const donePct    = grandTotal > 0 ? Math.round((grandDone   / grandTotal) * 100) : 0
  const onProgPct  = grandTotal > 0 ? Math.round((grandOnProg / grandTotal) * 100) : 0
  const nsPct      = grandTotal > 0 ? Math.round((grandNS     / grandTotal) * 100) : 0

  const channels = [
    { name: 'EXA', total: exaTotal, done: exaDone, onProg: exaOnProg, ns: exaNS, color: C.teal, tc: exaData?.tc_count || 28 },
    { name: 'T24 Browser / BOC', total: t24Total, done: t24Done, onProg: t24OnProg, ns: t24NS, color: C.tealDark, tc: t24Data?.tc_count || 13 },
  ].filter(ch => ch.total > 0)

  return (
    <div style={{
      background: '#fff', borderRadius: '20px',
      boxShadow: '0 2px 20px rgba(0,0,0,.08)',
      marginBottom: '24px', overflow: 'hidden',
      border: '1px solid #E2E8F0',
    }}>
      <div style={{ height: '4px', background: `linear-gradient(90deg, ${C.teal} 0%, #16A34A ${donePct}%, #E8A030 ${donePct+onProgPct}%, #CBD5E1 100%)` }} />

      <div style={{ padding: '24px 28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>📊</div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Overall Testing Progress</h2>
            </div>
            <p style={{ fontSize: '12px', color: C.muted, marginLeft: '46px' }}>
              {testedPct}% branch telah melakukan testing · {grandTested.toLocaleString()} dari {grandTotal.toLocaleString()} branch submit
            </p>
          </div>
          {/* Big % */}
          <div style={{ background: `linear-gradient(135deg, ${C.teal}, ${C.tealDark})`, borderRadius: '18px', padding: '16px 28px', textAlign: 'center', boxShadow: `0 4px 16px ${C.teal}44` }}>
            <div style={{ fontSize: '40px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>{testedPct}%</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.75)', fontWeight: '600', marginTop: '2px' }}>TOTAL TESTED</div>
          </div>
        </div>

        {/* Legend cards + channel breakdown side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '28px', alignItems: 'start' }}>

          <div>
            {/* 3 Legend cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Done',        count: grandDone,   pct: donePct,   bg: '#DCFCE7', color: '#166534', dot: '#16A34A', icon: '✅', desc: 'Semua TC passed' },
                { label: 'On Progress', count: grandOnProg, pct: onProgPct, bg: '#FEF9C3', color: '#92400E', dot: '#E8A030', icon: '🔄', desc: 'Ada TC gagal / in progress' },
                { label: 'Not Started', count: grandNS,     pct: nsPct,     bg: '#F1F5F9', color: '#64748B', dot: '#94A3B8', icon: '⏳', desc: 'Belum submit testing' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: '16px', padding: '16px 18px', border: `1.5px solid ${s.dot}25`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: s.dot, borderRadius: '16px 0 0 16px' }} />
                  <div style={{ paddingLeft: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '20px' }}>{s.icon}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: s.color, background: '#fff', borderRadius: '99px', padding: '2px 8px', border: `1px solid ${s.dot}30` }}>{s.pct}%</span>
                    </div>
                    <div style={{ fontSize: '30px', fontWeight: '800', color: '#0F172A', lineHeight: 1 }}>{s.count.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: s.color, marginTop: '4px' }}>{s.label}</div>
                    <div style={{ fontSize: '10px', color: s.color, opacity: .75, marginTop: '2px' }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stacked progress bar */}
            <div style={{ height: '10px', borderRadius: '99px', overflow: 'hidden', background: '#F1F5F9', display: 'flex', marginBottom: '6px' }}>
              {donePct  > 0 && <div style={{ width: `${donePct}%`,   height: '100%', background: '#16A34A', transition: 'width .8s' }} />}
              {onProgPct> 0 && <div style={{ width: `${onProgPct}%`, height: '100%', background: '#E8A030', transition: 'width .8s' }} />}
              {nsPct    > 0 && <div style={{ width: `${nsPct}%`,     height: '100%', background: '#CBD5E1', transition: 'width .8s' }} />}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { dot: '#16A34A', label: 'Done',        pct: donePct  },
                { dot: '#E8A030', label: 'On Progress', pct: onProgPct},
                { dot: '#CBD5E1', label: 'Not Started', pct: nsPct    },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '10px', height: '6px', background: l.dot, borderRadius: '2px', display: 'inline-block' }} />
                  <span style={{ fontSize: '11px', color: C.slate }}>{l.label} <strong style={{ color: '#0F172A' }}>{l.pct}%</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Per-channel breakdown */}
          <div style={{ minWidth: '260px' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginBottom: '12px' }}>Per Channel</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {channels.map(ch => {
                const chTested  = ch.done + ch.onProg
                const chTestedP = ch.total > 0 ? Math.round((chTested  / ch.total) * 100) : 0
                const chDoneP   = ch.total > 0 ? Math.round((ch.done   / ch.total) * 100) : 0
                const chOnProgP = ch.total > 0 ? Math.round((ch.onProg / ch.total) * 100) : 0
                const chNSP     = ch.total > 0 ? Math.round((ch.ns     / ch.total) * 100) : 0
                return (
                  <div key={ch.name} style={{ background: C.surface, borderRadius: '14px', padding: '14px 16px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: ch.color, color: '#fff', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: '800' }}>{ch.name}</span>
                        <span style={{ fontSize: '10px', color: C.muted }}>{ch.tc} TC · {ch.total} branch</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: ch.color }}>{chTestedP}%</span>
                    </div>
                    <div style={{ height: '7px', borderRadius: '99px', overflow: 'hidden', background: '#E2E8F0', display: 'flex', marginBottom: '6px' }}>
                      {chDoneP   > 0 && <div style={{ width: `${chDoneP}%`,   background: '#16A34A' }} />}
                      {chOnProgP > 0 && <div style={{ width: `${chOnProgP}%`, background: '#E8A030' }} />}
                      {chNSP     > 0 && <div style={{ width: `${chNSP}%`,     background: '#CBD5E1' }} />}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>✓ Done: {ch.done}</span>
                      <span style={{ fontSize: '10px', color: '#92400E', fontWeight: '700' }}>⚙ On Prog: {ch.onProg}</span>
                      <span style={{ fontSize: '10px', color: C.muted,   fontWeight: '600' }}>○ NS: {ch.ns}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Channel Panel ─────────────────────────────────────────────────────────────
function ChannelPanel({ data, channelName, accentColor }) {
  const [filterRegional, setFilterRegional] = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [failedBranch,   setFailedBranch]   = useState(null)

  if (!data) return null

  const regionals  = [...new Set(data.branches.map(b => b.regional))].sort()
  const filtered   = data.branches.filter(b => {
    if (filterRegional !== 'all' && b.regional !== filterRegional) return false
    if (filterStatus   !== 'all' && b.status   !== filterStatus)   return false
    return true
  })
  const passedPct  = data.total_branches > 0 ? Math.round(data.passed      / data.total_branches * 100) : 0
  const failedPct  = data.total_branches > 0 ? Math.round(data.failed      / data.total_branches * 100) : 0
  const notPct     = data.total_branches > 0 ? Math.round(data.not_started / data.total_branches * 100) : 0
  const testedPct  = data.total_branches > 0 ? Math.round((data.passed + data.failed) / data.total_branches * 100) : 0
  const failedBranches = data.branches.filter(b => b.status === 'Failed')
  const avgTCFailed = failedBranches.length > 0
    ? (failedBranches.reduce((s, b) => s + (b.failed_tcs?.length || 0), 0) / failedBranches.length).toFixed(1)
    : '—'

  return (
    <div style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 1px 12px rgba(0,0,0,.07)', overflow: 'hidden', marginBottom: '24px' }}>

      <div style={{ padding: '22px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '20px', borderLeft: `5px solid ${accentColor}`, flexWrap: 'wrap' }}>
        <DonutSmall passed={data.passed} failed={data.failed} notStarted={data.not_started} total={data.total_branches} size={88} strokeW={10} />

        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: '800', fontSize: '18px', color: '#0F172A' }}>{channelName}</div>
            <span style={{ background: accentColor, color: '#fff', borderRadius: '99px', padding: '3px 12px', fontSize: '12px', fontWeight: '800', boxShadow: `0 2px 8px ${accentColor}40` }}>
              {testedPct}% tested
            </span>
            <span style={{ fontSize: '11px', color: C.muted }}>
              ({data.passed + data.failed} dari {data.total_branches} branch)
            </span>
          </div>
          <div style={{ fontSize: '12px', color: C.muted, marginBottom: '10px' }}>
            {data.tc_count} Test Cases · Target {data.total_target?.toLocaleString()} {channelName === 'EXA' ? 'Cabang' : 'Area'}
          </div>
          <div style={{ height: '8px', display: 'flex', borderRadius: '99px', overflow: 'hidden', background: C.border }}>
            <div style={{ width: `${passedPct}%`, background: C.passed, transition: 'width .6s' }} />
            <div style={{ width: `${failedPct}%`, background: C.failed, transition: 'width .6s' }} />
            <div style={{ width: `${notPct}%`,    background: '#CBD5E1', transition: 'width .6s' }} />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '7px', flexWrap: 'wrap' }}>
            {[
              { label: 'Done',        count: data.passed,      pct: passedPct, dot: '#16A34A' },
              { label: 'On Progress', count: data.failed,      pct: failedPct, dot: '#E8A030' },
              { label: 'Not Started', count: data.not_started, pct: notPct,    dot: '#CBD5E1' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.dot, display: 'inline-block' }} />
                <span style={{ color: C.muted }}>{s.label}</span>
                <span style={{ fontWeight: '800', color: '#0F172A' }}>{s.count}</span>
                <span style={{ color: C.muted }}>({s.pct}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Done',        val: data.passed,      bg: C.passedBg, color: C.passed,     border: '#BBF7D0', pct: passedPct },
            { label: 'On Progress', val: data.failed,      bg: C.failedBg, color: C.failedDark, border: '#FECDD3', pct: failedPct },
            { label: 'Not Started', val: data.not_started, bg: C.surface,  color: C.slate,      border: C.border,  pct: notPct    },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', background: s.bg, borderRadius: '14px', padding: '12px 18px', border: `1px solid ${s.border}`, minWidth: '70px' }}>
              <div style={{ fontSize: '24px', fontWeight: '800', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '9px', color: s.color, fontWeight: '700', marginTop: '1px', textTransform: 'uppercase', letterSpacing: '.3px' }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: s.color, fontWeight: '600', marginTop: '1px' }}>{s.pct}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bt-mini-stats" style={{ padding: '16px clamp(14px,2vw,28px)', background: C.surface, borderBottom: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        <MiniStat label="Pass Rate"  value={`${passedPct}%`}               sub="dari total branch"             color={C.teal}      icon="📊" />
        <MiniStat label="% Tested"   value={`${testedPct}%`}               sub={`${data.passed+data.failed} submit`} color={accentColor} icon="🔬" />
        <MiniStat label="Avg TC Fail" value={avgTCFailed}                   sub="per branch on progress"        color="#E8A030"     icon="🔍" />
        <MiniStat label="Not Started" value={data.not_started}              sub={`dari ${data.total_branches}`} color={C.slate}     icon="⏳" />
      </div>

      <div className="bt-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ padding: '18px 28px', borderRight: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.failed, display: 'inline-block' }} />
            Top Issues ({failedBranches.length} branch on progress)
          </div>
          <IssueList branches={data.branches} />
        </div>
        <div style={{ padding: '18px 28px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor, display: 'inline-block' }} />
            Pass Rate per Regional
          </div>
          <RegionalBreakdown branches={data.branches} />
        </div>
      </div>

      <div style={{ padding: '12px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: C.slate, fontWeight: '600' }}>Filter:</span>
        {[
          { val: filterRegional, set: setFilterRegional, opts: [['all','Semua Regional'], ...regionals.map(r => [r, r])] },
          { val: filterStatus,   set: setFilterStatus,   opts: [['all','Semua Status'],['Passed','Done'],['Failed','On Progress'],['Not Started','Not Started']] },
        ].map((sel, i) => (
          <select key={i} value={sel.val} onChange={e => sel.set(e.target.value)} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', color: '#0F172A', cursor: 'pointer', outline: 'none' }}>
            {sel.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <span style={{ fontSize: '11px', color: C.muted, marginLeft: 'auto' }}>Menampilkan {filtered.length} dari {data.branches.length}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.surface, borderBottom: `2px solid ${C.border}` }}>
              {[channelName === 'EXA' ? 'Kantor Cabang (KC)' : 'Area / Cabang', 'Area / Tester', 'Status', 'Tanggal', 'Aksi'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: C.muted, fontSize: '13px' }}>Tidak ada data</td></tr>
              : filtered.map(b => <BranchRow key={b.id} branch={b} onClickFailed={setFailedBranch} />)
            }
          </tbody>
        </table>
      </div>
      <FailedModal branch={failedBranch} onClose={() => setFailedBranch(null)} />
    </div>
  )
}

function ChannelTabs({ active, onChange, exaData, t24Data }) {
  const tabs = [
    { id: 'all', label: 'Semua Channel', data: null },
    { id: 'exa', label: 'EXA',           data: exaData },
    { id: 't24', label: 'T24 Browser / BOC', data: t24Data },
  ]
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {tabs.map(t => {
        const isActive = active === t.id
        const total    = t.data?.total_branches || 0
        const tested   = (t.data?.passed || 0) + (t.data?.failed || 0)
        const tPct     = total > 0 ? Math.round((tested / total) * 100) : null
        const onProg   = t.data?.failed || 0
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: '8px 18px', borderRadius: '99px', border: 'none',
            fontWeight: '600', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
            background: isActive ? C.teal : '#fff', color: isActive ? '#fff' : C.slate,
            boxShadow: isActive ? `0 2px 8px ${C.teal}44` : '0 1px 3px rgba(0,0,0,.08)',
            transition: 'all .2s', display: 'flex', alignItems: 'center', gap: '7px',
          }}>
            {t.label}
            {tPct !== null && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '99px', background: isActive ? 'rgba(255,255,255,.22)' : '#F0FDF4', color: isActive ? '#fff' : C.passed, fontWeight: '700' }}>
                {tPct}% tested
              </span>
            )}
            {onProg > 0 && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '99px', background: isActive ? 'rgba(255,255,255,.15)' : C.failedBg, color: isActive ? '#fff' : C.failedDark, fontWeight: '700' }}>
                {onProg} on progress
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function UploadBTPanel({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [status,    setStatus]    = useState(null)
  const fileRef = React.useRef()

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) { setStatus({ type: 'err', msg: 'File harus berformat .xlsx' }); return }
    setUploading(true); setStatus(null)
    try {
      const token = sessionStorage.getItem('neom_token')
      const form  = new FormData()
      form.append('file', file)
      const res  = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/upload/branch-testing-excel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload gagal')
      setStatus({ type: 'ok', msg: `✅ ${data.message} · ${data.total_rows} baris data` })
      onSuccess?.()
    } catch (err) { setStatus({ type: 'err', msg: `❌ ${err.message}` }) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '16px 20px', border: '1.5px dashed rgba(1,132,124,.4)', boxShadow: '0 1px 6px rgba(0,0,0,.05)', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>Upload Hasil Branch Testing</div>
        <div style={{ fontSize: '11px', color: '#94A3B8' }}>Upload file <code style={{ background:'#F1F5F9', padding:'1px 4px', borderRadius:'4px' }}>branch-testing.xlsx</code> export dari Forms/SharePoint</div>
        {status && <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: '600', color: status.type === 'ok' ? '#16A34A' : '#DC2626', background: status.type === 'ok' ? '#F0FDF4' : '#FEF2F2', padding: '6px 10px', borderRadius: '8px' }}>{status.msg}</div>}
      </div>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '10px', cursor: uploading ? 'not-allowed' : 'pointer', background: uploading ? '#94A3B8' : '#01847C', color: '#fff', fontSize: '13px', fontWeight: '700', boxShadow: uploading ? 'none' : '0 2px 8px rgba(1,132,124,.35)', whiteSpace: 'nowrap' }}>
        {uploading ? '⏳ Mengupload...' : '📂 Pilih File'}
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
      </label>
    </div>
  )
}

export default function BranchTestingPage({ user, onLogout, hideSidebar }) {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [error,       setError]       = useState(null)
  const [activeTab,   setActiveTab]   = useState('all')

  const load = useCallback(async () => {
    try { setError(null); const d = await fetchBranchTesting(); setData(d); setLastRefresh(new Date()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, REFRESH_INTERVAL); return () => clearInterval(t) }, [load])

  if (loading) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: C.slate }}>Memuat data branch testing…</div>
  if (error)   return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '14px', color: C.failedDark }}>⚠ {error}<button onClick={load} style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer' }}>Coba lagi</button></div>

  const exa = data?.exa
  const t24 = data?.t24
  const totalSubmit   = (exa?.total_branches || 0) + (t24?.total_branches || 0)
  const totalPassed   = (exa?.passed || 0) + (t24?.passed || 0)
  const totalFailed   = (exa?.failed || 0) + (t24?.failed || 0)
  const totalNotStart = (exa?.not_started || 0) + (t24?.not_started || 0)
  const totalTested   = totalPassed + totalFailed
  const overallTestedPct = totalSubmit > 0 ? Math.round((totalTested / totalSubmit) * 100) : 0

  const showExa = activeTab === 'all' || activeTab === 'exa'
  const showT24 = activeTab === 'all' || activeTab === 't24'

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'inherit', display: 'flex', flexDirection: 'column' }}>

      <nav style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 clamp(12px,3vw,32px)', minHeight: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 8px rgba(0,0,0,.06)', flexWrap: 'wrap', gap: '8px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!hideSidebar && <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '800', fontSize: '13px' }}>BSI</div>}
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A', lineHeight: 1.2 }}>Branch Testing Dashboard</div>
            <div style={{ fontSize: '11px', color: C.slate }}>NEOM Core Banking Upgrade · EXA & T24 Browser</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', background: C.passed, borderRadius: '50%', display: 'inline-block', animation: 'blink 1.5s infinite' }} />
            <span style={{ fontSize: '12px', color: C.passed, fontWeight: '600' }}>Live</span>
          </div>
          {lastRefresh && <span className="bt-nav-hide" style={{ fontSize: '12px', color: C.muted }}>Update: {lastRefresh.toLocaleTimeString('id-ID')}</span>}
          {!hideSidebar && <>
            <div className="bt-nav-hide" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: C.surface, borderRadius: '10px', padding: '6px 12px', border: `1px solid ${C.border}` }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '11px' }}>{user?.name?.[0] || 'U'}</div>
              <div><div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', lineHeight: 1.2 }}>{user?.name}</div><div style={{ fontSize: '11px', color: C.slate }}>{user?.institution}</div></div>
            </div>
            <button onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', border: '1.5px solid #FECDD3', borderRadius: '10px', background: '#FFF1F3', color: C.failedDark, fontWeight: '700', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.failedDark; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFF1F3'; e.currentTarget.style.color = C.failedDark }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="bt-nav-hide">Keluar</span>
            </button>
          </>}
        </div>
      </nav>

      <div style={{ background: 'linear-gradient(135deg, #01847C 0%, #016860 50%, #0F172A 100%)', padding: 'clamp(16px,3vw,28px) clamp(14px,3vw,32px)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .05, backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <span style={{ background: 'rgba(232,160,48,.2)', color: '#E8A030', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(232,160,48,.3)' }}>BRANCH TESTING</span>
              <span style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.7)', padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '600' }}>FDR 1 — 26-28 Mar 2026</span>
            </div>
            <h1 style={{ color: '#fff', fontSize: 'clamp(16px,3vw,26px)', fontWeight: '800', letterSpacing: '-.5px', lineHeight: 1.1, margin: 0 }}>Branch Testing · Core Banking Upgrade</h1>
            <p style={{ color: 'rgba(255,255,255,.55)', fontSize: '13px', marginTop: '6px' }}>EXA (28 TC · 1.130 Cabang) &nbsp;·&nbsp; T24 Browser / BOC (13 TC · 50+ Area)</p>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>TOTAL TESTED</div>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '36px', fontWeight: '800', lineHeight: 1 }}>{overallTestedPct}%</div>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '10px', marginTop: '2px' }}>{totalTested} dari {totalSubmit} branch</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>LATEST UPDATE</div>
              <div style={{ color: '#fff', fontFamily: 'monospace', fontSize: '13px' }}>{data?.last_update ? new Date(data.last_update).toLocaleString('id-ID') : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <main style={{ padding: 'clamp(14px,2.5vw,28px) clamp(14px,2.5vw,32px)', flex: 1, maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        <UploadBTPanel onSuccess={load} />
        <OverallProgressSection exaData={exa} t24Data={t24} />

        <div className="bt-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
          <SummaryCard label="Total Branch"         value={totalSubmit}   color={C.teal}   icon="🏦" />
          <SummaryCard label="Done (Passed)"         value={totalPassed}   total={totalSubmit} color={C.passed}    pct={totalSubmit > 0 ? Math.round(totalPassed/totalSubmit*100) : 0} icon="✅" />
          <SummaryCard label="On Progress (Failed)"  value={totalFailed}   total={totalSubmit} color={C.failed}    pct={totalSubmit > 0 ? Math.round(totalFailed/totalSubmit*100) : 0} icon="⚠️" />
          <SummaryCard label="Not Started"           value={totalNotStart} color={C.slate}  icon="⏳" />
        </div>

        <ChannelTabs active={activeTab} onChange={setActiveTab} exaData={exa} t24Data={t24} />
        {showExa && <ChannelPanel data={exa} channelName="EXA" accentColor={C.teal} />}
        {showT24 && <ChannelPanel data={t24} channelName="T24 Browser / BOC" accentColor={C.tealDark} />}
      </main>

      <footer style={{ padding: '16px clamp(14px,3vw,32px)', borderTop: `1px solid ${C.border}`, background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: C.muted }}>© 2026 Bank Syariah Indonesia · Internal Use Only</span>
        <span style={{ fontSize: '12px', color: C.muted }}>Refresh otomatis setiap 60 detik</span>
      </footer>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        @media (max-width: 768px) {
          .bt-nav-hide { display: none !important; }
        }
        @media (max-width: 900px) {
          .bt-summary-grid { grid-template-columns: repeat(2,1fr) !important; }
          .bt-mini-stats   { grid-template-columns: repeat(2,1fr) !important; }
          .bt-two-col      { grid-template-columns: 1fr !important; }
          .bt-two-col > div:first-child { border-right: none !important; border-bottom: 1px solid #E2E8F0; }
        }
        @media (max-width: 480px) {
          .bt-summary-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}