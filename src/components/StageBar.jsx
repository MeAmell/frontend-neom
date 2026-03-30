import { RAGBadge } from './RAGBadge'

export default function StageBar({ stage, onClick, active }) {
  const segments = [
    { key: 'completed',   pct: stage.completed,   color: '#01847C', label: 'Completed' },
    { key: 'in_progress', pct: stage.in_progress, color: '#E8A030', label: 'In Progress' },
    { key: 'not_started', pct: stage.not_started, color: '#E2E8F0', label: 'Not Started' },
  ]

  return (
    <div
      onClick={() => onClick && onClick(stage)}
      style={{
        background: active ? '#F0FDF9' : '#fff',
        border: `1.5px solid ${active ? '#01847C' : '#E2E8F0'}`,
        borderRadius: '14px', padding: '16px 20px',
        cursor: 'pointer', transition: 'all .2s',
        boxShadow: active ? '0 4px 16px rgba(1,132,124,.15)' : '0 1px 4px rgba(0,0,0,.06)',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = '#6DB5B9' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = '#E2E8F0' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div>
          <span style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>{stage.name}</span>
          <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '8px' }}>{stage.description}</span>
        </div>
        <RAGBadge status={stage.status} />
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: '10px', borderRadius: '99px', overflow: 'hidden', gap: '2px' }}>
        {segments.filter(s => s.pct > 0).map(s => (
          <div key={s.key} style={{
            flex: s.pct, background: s.color, transition: 'flex 1s ease',
            borderRadius: '99px',
          }} title={`${s.label}: ${s.pct}%`} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
        {segments.map(s => (
          <span key={s.key} style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, display: 'inline-block' }} />
            {s.label}: <b style={{ color: '#0F172A' }}>{s.pct}%</b>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748B' }}>
          Target: <b style={{ color: '#0F172A' }}>{stage.target_date}</b>
        </span>
      </div>
    </div>
  )
}
