import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../Canvas/Avatar'
import { ROSTER } from '../Canvas/personas'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { CatalogItem, Connection, ConnectionStatus } from '../../types/work'

// Everything the team needs to work. The main runner comes first: the agent
// CLI (Claude Code or Codex) that does the work on your own subscription.
// Then where the code lives, tools, and keys. Problems float up with a fix.

const GROUPS: { kind: Connection['kind']; label: string }[] = [
  { kind: 'code', label: 'Code & deploy' },
  { kind: 'mcp', label: 'Tools' },
  { kind: 'key', label: 'Keys' }
]

const STATUS: Record<ConnectionStatus, { label: string; action: string }> = {
  ok: { label: 'Connected', action: 'Manage' },
  expiring: { label: 'Expiring', action: 'Renew' },
  expired: { label: 'Logged out', action: 'Log in again' },
  missing: { label: 'Not set up', action: 'Set up' }
}

const KIND_LABEL: Record<Connection['kind'], string> = { runner: 'Runner', code: 'Code', mcp: 'Tool', key: 'Key' }
const HUES = ['#e8853d', '#8fb0f5', '#7cc99a', '#b490ee', '#eccb5a', '#73daca', '#f29bb0']

function Logo({ name, size = 36 }: { name: string; size?: number }) {
  const hue = name === 'Claude Code' ? '#d97757' : name === 'Codex' ? '#9aa0a6' : HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  return (
    <span className="conn-logo" style={{ ['--hue' as string]: hue, width: size, height: size, fontSize: Math.round(size * 0.44) }}>
      {name[0]}
    </span>
  )
}

function Users({ names }: { names: string[] }) {
  if (names[0] === 'Everyone') return <span className="muted">Everyone</span>
  const users = names.map((n) => ROSTER.find((e) => e.nickname === n)).filter((e) => !!e)
  return (
    <span className="conn-users" title={names.length ? `Used by ${names.join(', ')}` : 'Not used yet'}>
      {users.map((e) => (
        <Avatar key={e.nickname} persona={e} size={24} />
      ))}
    </span>
  )
}

function RunnerCard({
  c,
  connected,
  isMain,
  onMakeMain,
  onConnected
}: {
  c: Connection
  connected: boolean
  isMain: boolean
  onMakeMain: () => void
  onConnected: () => void
}) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(0)
  const steps = c.steps ?? []

  const runStep = (i: number) => {
    const next = i + 1
    setDone(next)
    if (next === steps.length) {
      setOpen(false)
      onConnected()
    }
  }

  return (
    <div className={`runner-card${isMain ? ' is-main' : ''}${connected ? ' is-connected' : ''}`}>
      <div className="runner-top">
        <Logo name={c.name} size={48} />
        <div className="runner-id">
          <strong>{c.name}</strong>
          <span className="muted">{c.plan}</span>
        </div>
        {isMain && <span className="main-badge">★ Main runner</span>}
      </div>

      <div className="runner-state">
        <span className={`conn-status status-${connected ? 'ok' : 'missing'}`}>
          <span className="conn-dot" />
          {connected ? 'Connected' : 'Not connected'}
        </span>
        {connected && !isMain && (
          <button className="btn-ghost" onClick={onMakeMain}>
            Make main runner
          </button>
        )}
        {!connected && !open && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            Connect
          </button>
        )}
      </div>

      {open && (
        <ol className="steps-connect">
          {steps.map((s, i) => {
            const state = i < done ? 'done' : i === done ? 'current' : 'later'
            return (
              <li key={s.text} className={`step-connect is-${state}`}>
                <span className="step-num">{state === 'done' ? '✓' : i + 1}</span>
                <span className="step-connect-body">
                  <span>{s.text}</span>
                  {s.command && <code className="step-cmd">{s.command}</code>}
                </span>
                {state === 'current' && (
                  <button className="btn-primary" onClick={() => runStep(i)}>
                    {s.command ? 'Run' : 'Check'}
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Row({ c, fixed, onFix }: { c: Connection; fixed: boolean; onFix: () => void }) {
  const status: ConnectionStatus = fixed ? 'ok' : c.status
  return (
    <li className={`conn-row status-${status}`}>
      <Logo name={c.name} />
      <span className="conn-name">
        <strong>{c.name}</strong>
        <span className="muted">{fixed ? 'Connected just now' : c.detail}</span>
      </span>
      <Users names={c.usedBy} />
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

function Catalog({ items, onAdd, onClose }: { items: CatalogItem[]; onAdd: (i: CatalogItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const shown = items.filter((i) => `${i.name} ${i.blurb}`.toLowerCase().includes(q.trim().toLowerCase()))
  return createPortal(
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-label="Add a connection" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Add a connection</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <input className="modal-search" autoFocus placeholder="Search tools, services, keys…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="catalog-grid">
          {shown.map((i) => (
            <button key={i.name} className="catalog-item" onClick={() => onAdd(i)}>
              <Logo name={i.name} size={34} />
              <span className="catalog-text">
                <strong>{i.name}</strong>
                <span className="muted">{i.blurb}</span>
              </span>
              <span className="catalog-kind">{KIND_LABEL[i.kind]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function ConnectionsScreen() {
  const { connections: initial, catalog } = useWorkspace()
  const [connections, setConnections] = useState(initial)
  const [fixed, setFixed] = useState<Set<string>>(new Set())
  const [main, setMain] = useState('claude')
  const [adding, setAdding] = useState(false)

  const runners = connections.filter((c) => c.kind === 'runner')
  const connectedRunner = (c: Connection) => c.status === 'ok' || fixed.has(c.id)
  const problems = connections.filter((c) => c.kind !== 'runner' && c.status !== 'ok' && !fixed.has(c.id))
  const fix = (id: string) => setFixed((s) => new Set(s).add(id))

  const add = (item: CatalogItem) => {
    const id = `added-${item.name}`
    if (!connections.some((c) => c.id === id)) {
      setConnections((list) => [...list, { id, name: item.name, kind: item.kind, status: 'missing', detail: item.blurb, usedBy: [] }])
    }
    setAdding(false)
  }

  return (
    <div className="screen">
      <ScreenHeader title="Connections" sub="What your team uses to do the work.">
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Add connection
        </button>
      </ScreenHeader>
      <div className="screen-scroll">
        <section className="conn-group">
          <h2 className="section-label">Main runner</h2>
          <p className="runner-hint">The AI that does the work, on your own subscription. Origin is the interface on top.</p>
          <div className="runner-grid">
            {runners.map((c) => (
              <RunnerCard
                key={c.id}
                c={c}
                connected={connectedRunner(c)}
                isMain={main === c.id && connectedRunner(c)}
                onMakeMain={() => setMain(c.id)}
                onConnected={() => fix(c.id)}
              />
            ))}
          </div>
        </section>

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
              <li>
                <button className="conn-add" onClick={() => setAdding(true)}>
                  <span className="conn-add-plus">+</span> Add {g.label.toLowerCase()}
                </button>
              </li>
            </ul>
          </section>
        ))}
      </div>
      {adding && <Catalog items={catalog} onAdd={add} onClose={() => setAdding(false)} />}
    </div>
  )
}
