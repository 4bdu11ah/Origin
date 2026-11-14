import { useState } from 'react'
import { Avatar } from '../Canvas/Avatar'
import { ROSTER } from '../Canvas/personas'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { Connection, ConnectionStatus } from '../../types/work'

// Everything the team logs into or holds a key for, with its state. Problems
// float to the top with a one-click fix, so an agent never stalls on a login.

const GROUPS: { kind: Connection['kind']; label: string }[] = [
  { kind: 'login', label: 'Logins' },
  { kind: 'mcp', label: 'Tools' },
  { kind: 'key', label: 'Keys' }
]

const STATUS: Record<ConnectionStatus, { label: string; action: string }> = {
  ok: { label: 'Connected', action: 'Manage' },
  expiring: { label: 'Expiring', action: 'Renew' },
  expired: { label: 'Logged out', action: 'Log in again' },
  missing: { label: 'Not set up', action: 'Set up' }
}

const HUES = ['#e8853d', '#8fb0f5', '#7cc99a', '#b490ee', '#eccb5a', '#73daca', '#f29bb0']

function Logo({ name }: { name: string }) {
  const hue = HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  return (
    <span className="conn-logo" style={{ ['--hue' as string]: hue }}>
      {name[0]}
    </span>
  )
}

function Row({ c, fixed, onFix }: { c: Connection; fixed: boolean; onFix: () => void }) {
  const status: ConnectionStatus = fixed ? 'ok' : c.status
  const users = c.usedBy.map((n) => ROSTER.find((e) => e.nickname === n)).filter((e) => !!e)
  return (
    <li className={`conn-row status-${status}`}>
      <Logo name={c.name} />
      <span className="conn-name">
        <strong>{c.name}</strong>
        <span className="muted">{fixed ? 'Connected just now' : c.detail}</span>
      </span>
      <span className="conn-users" title={c.usedBy.length ? `Used by ${c.usedBy.join(', ')}` : 'Not used yet'}>
        {c.usedBy[0] === 'Everyone' ? <span className="muted">Everyone</span> : users.map((e) => <Avatar key={e.nickname} persona={e} size={24} />)}
      </span>
      <span className={`conn-status status-${status}`}>
        <span className="conn-dot" />
        {STATUS[status].label}
      </span>
      <button className={status === 'ok' ? 'btn-ghost' : 'btn-primary'} onClick={status === 'ok' ? undefined : onFix}>
        {STATUS[status].action}
      </button>
    </li>
  )
}

export function ConnectionsScreen() {
  const { connections } = useWorkspace()
  const [fixed, setFixed] = useState<Set<string>>(new Set())
  const problems = connections.filter((c) => c.status !== 'ok' && !fixed.has(c.id))
  const fix = (id: string) => setFixed((s) => new Set(s).add(id))

  return (
    <div className="screen">
      <ScreenHeader title="Connections" sub="Logins, tools and keys your team uses." />
      <div className="screen-scroll">
        {problems.length > 0 && (
          <div className="attention-banner">
            <span className="attention-icon">⚡</span>
            <span>
              <strong>{problems.length === 1 ? '1 needs you' : `${problems.length} need you`}</strong>
              <span className="muted"> · {problems.map((p) => p.name).join(', ')}</span>
            </span>
          </div>
        )}
        {GROUPS.map((g) => (
          <section key={g.kind} className="conn-group">
            <h2 className="section-label">{g.label}</h2>
            <ul className="conn-list">
              {connections
                .filter((c) => c.kind === g.kind)
                .map((c) => (
                  <Row key={c.id} c={c} fixed={fixed.has(c.id)} onFix={() => fix(c.id)} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
