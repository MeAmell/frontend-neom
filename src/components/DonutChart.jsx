export default function DonutChart({ completed, inProgress, notStarted, size = 180 }) {
  const r = 70
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r

  const segments = [
    { pct: completed,   color: '#01847C', label: 'Completed' },
    { pct: inProgress,  color: '#E8A030', label: 'In Progress' },
    { pct: notStarted,  color: '#E2E8F0', label: 'Not Started' },
  ]

  let offset = 0
  const slices = segments.map(s => {
    const dash = (s.pct / 100) * circ
    const gap = circ - dash
    const el = { ...s, dash, gap, offset }
    offset += dash
    return el
  })

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.2s ease' }}
          />
        ))}
        {/* Inner ring */}
        <circle cx={cx} cy={cy} r={48} fill="none" stroke="#F0F4F8" strokeWidth="1.5" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '30px', fontWeight: '800', color: '#01847C', lineHeight: 1 }}>
          {completed.toFixed(0)}%
        </span>
        <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontWeight: '600' }}>
          Completed
        </span>
      </div>
    </div>
  )
}
