export default function DonutChart({ completed, inProgress, notStarted, size = 180 }) {
  // Use viewBox-based SVG so it scales naturally in any container
  const VB = 200        // internal coordinate space
  const r  = 75
  const cx = VB / 2
  const cy = VB / 2
  const circ = 2 * Math.PI * r

  const segments = [
    { pct: completed,   color: '#01847C', label: 'Completed'   },
    { pct: inProgress,  color: '#E8A030', label: 'In Progress' },
    { pct: notStarted,  color: '#E2E8F0', label: 'Not Started' },
  ]

  let offset = 0
  const slices = segments.map(s => {
    const dash = (s.pct / 100) * circ
    const gap  = circ - dash
    const el   = { ...s, dash, gap, offset }
    offset += dash
    return el
  })

  return (
    /*
     * Wrapper: square container that takes its width from the parent,
     * capped at `size` px. The SVG scales inside it.
     */
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: `${size}px`,
      /* keep it square */
      aspectRatio: '1 / 1',
    }}>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', display: 'block' }}
      >
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
        <circle cx={cx} cy={cy} r={50} fill="none" stroke="#F0F4F8" strokeWidth="1.5" />
      </svg>

      {/* Centre label – uses % font size so it scales */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 'clamp(18px, 8%, 30px)', fontWeight: '800', color: '#01847C', lineHeight: 1 }}>
          {completed.toFixed(0)}%
        </span>
        <span style={{ fontSize: 'clamp(9px, 4%, 11px)', color: '#64748B', marginTop: '4px', fontWeight: '600' }}>
          Completed
        </span>
      </div>
    </div>
  )
}