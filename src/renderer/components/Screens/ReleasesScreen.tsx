import { StatusIcon } from '../shared/StatusIcon'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { Release } from '../../types/work'

// What reached production and which tickets went with it. The latest live
// release leads; older ones form a timeline below.

function TicketChips({ keys }: { keys: string[] }) {
  const { tickets, openTicket } = useWorkspace()
  if (!keys.length) return <span className="muted">No tickets</span>
  return (
    <div className="chip-row">
      {keys.map((k) => {
        const t = tickets.find((x) => x.key === k)
        return (
          <button key={k} className="ticket-chip" onClick={() => openTicket(k)} title="Open ticket">
            {t && <StatusIcon status={t.status} />}
            <span className="ticket-key">{k}</span>
            {t?.title}
          </button>
        )
      })}
    </div>
  )
}

function ChecksBar({ checks }: { checks: Release['checks'] }) {
  const pct = Math.round((checks.passed / checks.total) * 100)
  const all = checks.passed === checks.total
  return (
    <span className={`checks-meter${all ? ' is-ok' : ''}`} title={`${checks.passed} of ${checks.total} checks passed`}>
      <span className="checks-meter-track">
        <span style={{ width: `${pct}%` }} />
      </span>
      {checks.passed}/{checks.total} checks
    </span>
  )
}

const STATUS: Record<Release['status'], string> = { live: 'Live', superseded: 'Shipped', 'rolled-back': 'Rolled back' }

export function ReleasesScreen() {
  const { releases } = useWorkspace()
  const [live, ...older] = releases

  return (
    <div className="screen">
      <ScreenHeader title="Releases" sub="What reached production, and the tickets that went with it." />
      <div className="screen-scroll">
        {live && (
          <section className="release-hero">
            <div className="release-hero-top">
              <span className="live-dot" />
              <span className="release-hero-label">Live in production</span>
              <span className="muted">{live.when}</span>
              <code className="commit">{live.commit}</code>
            </div>
            <h2 className="release-hero-name">{live.name}</h2>
            <ul className="highlights">
              {live.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            <div className="release-hero-foot">
              <TicketChips keys={live.tickets} />
              <ChecksBar checks={live.checks} />
            </div>
          </section>
        )}

        <ol className="release-timeline">
          {older.map((r) => (
            <li key={r.id} className={`release-row status-${r.status}`}>
              <span className="release-node" />
              <div className="release-row-body">
                <div className="release-row-top">
                  <strong>{r.name}</strong>
                  <span className={`release-status status-${r.status}`}>{STATUS[r.status]}</span>
                  <span className="muted">{r.when}</span>
                  <code className="commit">{r.commit}</code>
                  <ChecksBar checks={r.checks} />
                </div>
                <ul className="highlights is-compact">
                  {r.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <TicketChips keys={r.tickets} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
