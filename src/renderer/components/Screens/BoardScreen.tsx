import { useMemo } from 'react'
import { Face } from '../shared/Face'
import { StatusIcon, SystemPill } from '../shared/StatusIcon'
import { roleOf } from '../Canvas/personas'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { Ticket, TicketStatus } from '../../types/work'

// Linear's core: tickets in four columns. Done means every "done when" check
// passed, so a done ticket shows it's verified rather than just closed.

const COLUMNS: { status: TicketStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in-progress', label: 'In progress' },
  { status: 'in-review', label: 'In review' },
  { status: 'done', label: 'Done' }
]

function Checks({ ticket }: { ticket: Ticket }) {
  const total = ticket.doneWhen.length
  if (!total) return null
  const ok = ticket.doneWhen.filter((c) => c.ok).length
  const verified = ok === total && ticket.status === 'done'
  return (
    <span className={`checks${verified ? ' is-verified' : ''}`} title={`${ok} of ${total} done-when checks pass`}>
      {verified ? (
        '✓ Verified'
      ) : (
        <>
          <span className="checks-bar">
            {ticket.doneWhen.map((c, i) => (
              <span key={i} className={c.ok ? 'is-ok' : ''} />
            ))}
          </span>
          {ok}/{total}
        </>
      )}
    </span>
  )
}

function Card({ ticket, onOpen, active }: { ticket: Ticket; onOpen: () => void; active: boolean }) {
  return (
    <button className={`ticket-card${active ? ' is-active' : ''}`} onClick={onOpen}>
      <span className="ticket-card-top">
        <span className="ticket-key">{ticket.key}</span>
        {ticket.assignee ? <Face person={ticket.assignee} size={24} /> : <span className="ticket-unassigned" title="Nobody yet" />}
      </span>
      <span className="ticket-card-title">{ticket.title}</span>
      <span className="ticket-card-bottom">
        {ticket.system && <SystemPill {...ticket.system} />}
        <Checks ticket={ticket} />
      </span>
    </button>
  )
}

function Detail({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { releases, setScreen } = useWorkspace()
  const release = releases.find((r) => r.id === ticket.release)
  return (
    <aside className="ticket-detail">
      <div className="ticket-detail-bar">
        <StatusIcon status={ticket.status} size={16} />
        <span className="ticket-key">{ticket.key}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <h2 className="ticket-detail-title">{ticket.title}</h2>
      <div className="ticket-detail-meta">
        {ticket.assignee ? (
          <span className="who">
            <Face person={ticket.assignee} size={28} />
            <span>
              <strong>{ticket.assignee.name}</strong>
              <small>{roleOf(ticket.assignee.persona)}</small>
            </span>
          </span>
        ) : (
          <span className="who is-empty">Nobody yet</span>
        )}
        {ticket.system && <SystemPill {...ticket.system} />}
      </div>
      <p className="ticket-detail-summary">{ticket.summary}</p>

      {ticket.doneWhen.length > 0 && (
        <section>
          <h3 className="section-label">Done when</h3>
          <ul className="done-list">
            {ticket.doneWhen.map((c, i) => (
              <li key={i} className={c.ok ? 'is-ok' : ''}>
                <span className="done-mark">{c.ok ? '✓' : ''}</span>
                {c.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="section-label">What happened</h3>
        <ol className="history">
          {ticket.history.map((h, i) => (
            <li key={i}>
              <Face person={h.who} size={22} />
              <span className="history-text">{h.text}</span>
              <span className="history-when">{h.when}</span>
            </li>
          ))}
        </ol>
      </section>

      {release && (
        <button className="release-link" onClick={() => setScreen('releases')}>
          <span>🚀</span> Shipped in {release.name} · <code>{release.commit}</code>
        </button>
      )}
    </aside>
  )
}

export function BoardScreen() {
  const { tickets, openTicketKey, openTicket } = useWorkspace()
  const open = tickets.find((t) => t.key === openTicketKey) ?? null
  const byStatus = useMemo(() => Object.fromEntries(COLUMNS.map((c) => [c.status, tickets.filter((t) => t.status === c.status)])), [tickets])
  const active = tickets.filter((t) => t.status !== 'done').length

  return (
    <div className="screen board-screen">
      <ScreenHeader title="Board" sub={`${active} open · ${byStatus['done'].length} done this week`} />
      <div className="board-body">
        <div className="board-columns">
          {COLUMNS.map((col) => (
            <section key={col.status} className={`board-column col-${col.status}`}>
              <h2 className="board-column-head">
                <StatusIcon status={col.status} />
                {col.label}
                <span className="count">{byStatus[col.status].length}</span>
              </h2>
              <div className="board-cards">
                {byStatus[col.status].map((t) => (
                  <Card key={t.key} ticket={t} active={t.key === openTicketKey} onOpen={() => openTicket(t.key === openTicketKey ? null : t.key)} />
                ))}
              </div>
            </section>
          ))}
        </div>
        {open && <Detail ticket={open} onClose={() => openTicket(null)} />}
      </div>
    </div>
  )
}
