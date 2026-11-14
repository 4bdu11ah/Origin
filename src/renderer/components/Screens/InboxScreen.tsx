import { Face } from '../shared/Face'
import { SystemPill } from '../shared/StatusIcon'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { InboxKind } from '../../types/work'

// Everything agents noticed while doing something else. Nothing gets lost:
// keep it as a ticket, or let it go.

const KIND: Record<InboxKind, { icon: string; label: string }> = {
  bug: { icon: '🐞', label: 'Bug' },
  risk: { icon: '⚠️', label: 'Risk' },
  idea: { icon: '💡', label: 'Idea' },
  question: { icon: '❓', label: 'Question' }
}

export function InboxScreen() {
  const { inbox, acceptInbox, dismissInbox, openTicket } = useWorkspace()

  return (
    <div className="screen">
      <ScreenHeader title="Inbox" sub="Found by agents along the way. Keep what matters." />
      <div className="screen-scroll">
        {inbox.length === 0 ? (
          <div className="zero">
            <span className="zero-icon">🎉</span>
            <strong>Inbox zero</strong>
            <span>Everything found has been sorted.</span>
          </div>
        ) : (
          <ul className="inbox-list">
            {inbox.map((item) => (
              <li key={item.id} className={`inbox-item kind-${item.kind}`}>
                <span className="inbox-kind" title={KIND[item.kind].label}>
                  {KIND[item.kind].icon}
                </span>
                <div className="inbox-main">
                  <span className="inbox-title">{item.title}</span>
                  <span className="inbox-summary">{item.summary}</span>
                  <span className="inbox-meta">
                    <span className="who-inline">
                      <Face person={item.foundBy} size={20} />
                      {item.foundBy.name.startsWith('Contractor') ? 'A contractor' : item.foundBy.name}
                    </span>
                    <button className="chip-link" onClick={() => openTicket(item.foundWhile)} title="Open the ticket it was found on">
                      while on {item.foundWhile}
                    </button>
                    {item.system && <SystemPill {...item.system} />}
                    <span className="muted">{item.when}</span>
                  </span>
                </div>
                <div className="inbox-actions">
                  <button className="btn-primary" onClick={() => acceptInbox(item.id)}>
                    Make ticket
                  </button>
                  <button className="btn-ghost" onClick={() => dismissInbox(item.id)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
