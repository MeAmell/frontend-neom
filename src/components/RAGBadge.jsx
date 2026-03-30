export function RAGBadge({ status }) {
  const map = {
    GREEN:  { bg: '#DCFCE7', color: '#166534', dot: '#16A34A', label: 'Green' },
    AMBER:  { bg: '#FEF3C7', color: '#92400E', dot: '#D97706', label: 'Amber' },
    RED:    { bg: '#FEE2E2', color: '#991B1B', dot: '#DC2626', label: 'Red' },
    DONE:   { bg: '#DCFCE7', color: '#166534', dot: '#16A34A', label: 'Done' },
    IN_PROGRESS: { bg: '#DBEAFE', color: '#1E40AF', dot: '#3B82F6', label: 'In Progress' },
    NOT_STARTED: { bg: '#F1F5F9', color: '#475569', dot: '#94A3B8', label: 'Not Started' },
  }
  const s = map[status] || map.AMBER
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: s.bg, color: s.color, borderRadius: '99px',
      padding: '3px 10px', fontSize: '12px', fontWeight: '600',
    }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

export function ProgressBar({ value, color = '#01847C', height = 8, animated = true }) {
  return (
    <div style={{
      width: '100%', height, background: '#E2E8F0', borderRadius: '99px', overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${Math.min(value, 100)}%`,
        background: color, borderRadius: '99px',
        transition: animated ? 'width 1s ease' : 'none',
      }} />
    </div>
  )
}
