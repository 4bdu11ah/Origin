import type { ReactNode } from 'react'
import { statusOf, useAgents } from '../Canvas/agentStore'
import { useWorkspace, type Screen } from '../Workspace/WorkspaceContext'
import './Rail.css'

// The window's main navigation: a slim rail of screens. The canvas is home;
// the chief of staff sits apart at the bottom. Badges show what wants you.

const I = {
  canvas: (
    <>
      <circle cx="6" cy="7" r="2.6" />
      <circle cx="18" cy="7" r="2.6" />
      <circle cx="12" cy="17.5" r="2.6" />
      <path d="M8.3 8.4l2.4 6.8M15.7 8.4l-2.4 6.8M8.6 7h6.8" />
    </>
  ),
  board: (
    <>
      <rect x="3.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
      <rect x="15.5" y="4" width="5" height="7" rx="1.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5l2.2-7.3A2 2 0 0 1 8.1 4.8h7.8a2 2 0 0 1 1.9 1.4l2.2 7.3" />
      <path d="M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5h-4.5l-1.2 2h-4.6l-1.2-2z" />
    </>
  ),
  releases: (
    <>
      <path d="M12 3.5c3 2.2 4.5 5.3 4.5 9.2L14.8 16H9.2l-1.7-3.3C7.5 8.8 9 5.7 12 3.5z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M9.2 16l-1.7 3.5M14.8 16l1.7 3.5M12 17v3" />
    </>
  ),
  meetings: (
    <>
      <rect x="3.5" y="6" width="12" height="12" rx="2.5" />
      <path d="M15.5 10.5l5-3v9l-5-3" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M15.8 14.2c2.4-.2 4.2 1.3 4.7 4.3" />
    </>
  ),
  connections: (
    <>
      <path d="M9 3.5v4M15 3.5v4" />
      <path d="M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 16.5v4" />
    </>
  ),
  chief: (
    <>
      <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6.5L6 19.5V16H7a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M9 9.5h6M9 12.2h3.5" />
    </>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

const ITEMS: { id: Screen; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'board', label: 'Board' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'releases', label: 'Releases' },
  { id: 'meetings', label: 'Meet' },
  { id: 'team', label: 'Team' },
  { id: 'connections', label: 'Connect' }
]

export function Rail() {
  const { screen, setScreen, inbox, connections, meetings } = useWorkspace()
  const { agents } = useAgents()

  const badges: Partial<Record<Screen, { n: number; tone: 'warn' | 'info' }>> = {}
  const needYou = agents.filter((a) => ['needs-you', 'error'].includes(statusOf(a))).length
  const unread = agents.filter((a) => statusOf(a) === 'unread').length
  if (needYou) badges.canvas = { n: needYou, tone: 'warn' }
  else if (unread) badges.canvas = { n: unread, tone: 'info' }
  if (inbox.length) badges.inbox = { n: inbox.length, tone: 'info' }
  const broken = connections.filter((c) => c.status !== 'ok').length
  if (broken) badges.connections = { n: broken, tone: 'warn' }
  const upcoming = meetings.filter((m) => m.status === 'upcoming').length
  if (upcoming) badges.meetings = { n: upcoming, tone: 'info' }

  const item = (id: Screen, label: string) => {
    const badge = badges[id]
    return (
      <button key={id} className={`rail-item${screen === id ? ' is-active' : ''}`} onClick={() => setScreen(id)} aria-current={screen === id ? 'page' : undefined} title={label}>
        <span className="rail-icon">
          <Icon>{I[id]}</Icon>
          {badge && <span className={`rail-badge tone-${badge.tone}`}>{badge.n}</span>}
        </span>
        <span className="rail-label">{label}</span>
      </button>
    )
  }

  return (
    <nav className="rail" aria-label="Screens">
      {ITEMS.map((i) => item(i.id, i.label))}
      <span className="rail-spacer" />
      {item('chief', 'Chief')}
    </nav>
  )
}
