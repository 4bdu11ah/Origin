import type { TicketStatus } from '../../types/work'
import './shared.css'

/** Ticket status ring, in the spirit of Linear: empty, half, three-quarters, done. */
export function StatusIcon({ status, size = 14 }: { status: TicketStatus; size?: number }) {
  const fill = { todo: 0, 'in-progress': 0.5, 'in-review': 0.75, done: 1 }[status]
  const c = 2 * Math.PI * 2.5
  return (
    <svg className={`status-icon icon-${status}`} width={size} height={size} viewBox="0 0 14 14" aria-hidden>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {fill > 0 && fill < 1 && (
        <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={`${c * fill} ${c}`} transform="rotate(-90 7 7)" />
      )}
      {fill === 1 && <path d="M4.2 7.2l1.9 1.9 3.7-3.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}

/** A product area, coloured like on the map. */
export function SystemPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="system-pill" style={{ ['--sys' as string]: color }}>
      <span className="system-pill-swatch" />
      {label}
    </span>
  )
}

/** Marks a screen whose data is not real yet. */
export function PreviewBadge() {
  return (
    <span className="preview-badge" title="This screen shows sample data until it is wired up">
      Preview · sample data
    </span>
  )
}
