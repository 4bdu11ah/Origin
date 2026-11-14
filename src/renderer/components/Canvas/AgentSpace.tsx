import { useContext, useEffect, useMemo, useState } from 'react'
import { LiveTerminal } from './LiveTerminal'
import { changesFor, FileChangesContext, STATUS_LABEL } from './agentStatus'
import { AgentMap } from './AgentMap'
import { agentStore, statusOf, useAgents, type Agent } from './agentStore'
import type { ActivityStep, AgentActivity } from './agentActivity'
import { Avatar } from './Avatar'
import { displayName, personaFor, roleOf } from './personas'

export type SpaceTab = 'steps' | 'terminal' | 'files'

// The side tab each agent was last on. New agents open on the terminal (you
// just started them); everything else opens on the map and its steps.
const tabByAgent = new Map<string, SpaceTab>()
export function setAgentTab(id: string, tab: SpaceTab): void {
  tabByAgent.set(id, tab)
}

interface AgentSpaceProps {
  agent: Agent
  activity: AgentActivity
  onBack: () => void
  onOpenAgent: (id: string) => void
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

const STEP_ICON: Record<ActivityStep['kind'], string> = {
  read: '◎',
  edit: '✎',
  run: '▶',
  found: '✦',
  ask: '?',
  pass: '✓',
  fail: '✕'
}

/** Inside an agent: a map of what it is doing, its steps, and its terminal and files one click away. */
export function AgentSpace({ agent, activity, onBack, onOpenAgent }: AgentSpaceProps) {
  const changes = changesFor(agent, useContext(FileChangesContext))
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTabState] = useState<SpaceTab>(() => tabByAgent.get(agent.id) ?? 'steps')
  const setTab = (t: SpaceTab) => {
    tabByAgent.set(agent.id, t)
    setTabState(t)
  }
  const { agents } = useAgents()
  const status = statusOf(agent)

  return (
    <div className="agent-space">
      <div className="agent-space-bar">
        <button className="strip-btn" onClick={onBack} title="Back to the overview">
          ← Overview
        </button>
        <Avatar persona={personaFor(agent.id)} ring={status} size={28} />
        <span className="agent-space-name">{displayName(personaFor(agent.id), agent.name)}</span>
        <span className="agent-space-role">{roleOf(personaFor(agent.id))}</span>
        <span className="agent-node-kind">{agent.kind}</span>
        <span className={`agent-space-status text-${status}`}>{STATUS_LABEL[status]}</span>
        <button
          className="strip-btn agent-space-stop"
          onClick={() => {
            if (window.confirm(`Stop "${agent.name}"? Its terminal will be closed.`)) {
              onBack()
              agentStore.remove(agent.id)
            }
          }}
        >
          Stop agent
        </button>
      </div>

      <div className="agent-space-body">
        <div className="agent-space-map">
          <AgentMap agent={agent} agents={agents} activity={activity} onOpenAgent={onOpenAgent} />
        </div>

        <aside className={`agent-space-side side-${tab}`}>
          <div className="side-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'steps'} className={tab === 'steps' ? 'is-active' : ''} onClick={() => setTab('steps')}>
              Steps
            </button>
            <button role="tab" aria-selected={tab === 'terminal'} className={tab === 'terminal' ? 'is-active' : ''} onClick={() => setTab('terminal')}>
              Terminal
            </button>
            <button role="tab" aria-selected={tab === 'files'} className={tab === 'files' ? 'is-active' : ''} onClick={() => setTab('files')}>
              Files <span className="files-count">{changes.length}</span>
            </button>
          </div>

          {tab === 'steps' && <Steps activity={activity} onReply={() => setTab('terminal')} />}

          {tab === 'terminal' && (
            <div className="agent-space-terminal">
              <LiveTerminal id={agent.id} focused />
            </div>
          )}

          {tab === 'files' && (
            <>
              <div className="files-panel">
                <p className="files-note">Changed since this agent started, anywhere in the project.</p>
                {changes.length === 0 ? (
                  <p className="files-empty">No files changed yet.</p>
                ) : (
                  <ul className="files-list">
                    {changes.map((c) => (
                      <li key={c.path}>
                        <button
                          className={`files-item${selected === c.path ? ' is-active' : ''}${c.deleted ? ' is-deleted' : ''}`}
                          onClick={() => setSelected(c.path)}
                          title={c.path}
                        >
                          <span className="files-name">{c.path.split('/').pop()}</span>
                          <span className="files-dir">{c.path.includes('/') ? c.path.slice(0, c.path.lastIndexOf('/')) : ''}</span>
                          <span className="files-when">{c.deleted ? 'deleted' : ago(c.at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {selected && <FileViewer path={selected} onClose={() => setSelected(null)} />}
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function Steps({ activity, onReply }: { activity: AgentActivity; onReply: () => void }) {
  const [open, setOpen] = useState<number | null>(null)
  const last = activity.steps.length - 1
  return (
    <div className="steps">
      <ol className="steps-list">
        {activity.steps.map((s, i) => (
          <li key={i} className={`step step-${s.kind}${i === last ? ' is-now' : ''}${open === i ? ' is-open' : ''}`}>
            <span className="step-icon" aria-hidden>{STEP_ICON[s.kind]}</span>
            <button className="step-main" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="step-head">
                <span className="step-text">{s.text}</span>
                <span className="step-when">{s.when === 'now' ? 'now' : `${s.when} ago`}</span>
              </span>
              {open === i && <span className="step-detail">{s.detail}</span>}
            </button>
          </li>
        ))}
      </ol>
      {activity.steps[last]?.kind === 'ask' && (
        <button className="strip-btn steps-reply" onClick={onReply}>
          Reply in terminal
        </button>
      )}
    </div>
  )
}

type ViewerState =
  | { kind: 'loading' }
  | { kind: 'diff'; lines: string[] }
  | { kind: 'file'; lines: string[] }
  | { kind: 'message'; text: string }

function FileViewer({ path, onClose }: { path: string; onClose: () => void }) {
  const [mode, setMode] = useState<'diff' | 'file'>('diff')
  const [state, setState] = useState<ViewerState>({ kind: 'loading' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    const load = async () => {
      if (mode === 'diff') {
        const { diff, untracked } = await window.api.files.diff(path)
        if (untracked) {
          // New file: the whole file is the change.
          const { content, reason } = await window.api.files.read(path)
          if (cancelled) return
          setState(content === null ? { kind: 'message', text: reason ?? 'Unreadable' } : { kind: 'diff', lines: content.split('\n').map((l) => '+' + l) })
          return
        }
        if (cancelled) return
        setState(diff ? { kind: 'diff', lines: diff.split('\n').filter((l) => !/^(diff --git|index |--- |\+\+\+ )/.test(l)) } : { kind: 'message', text: 'No changes against the last commit.' })
      } else {
        const { content, reason } = await window.api.files.read(path)
        if (cancelled) return
        setState(content === null ? { kind: 'message', text: reason ?? 'Unreadable' } : { kind: 'file', lines: content.split('\n') })
      }
    }
    load().catch((err) => !cancelled && setState({ kind: 'message', text: String(err?.message ?? err) }))
    return () => {
      cancelled = true
    }
  }, [path, mode, reload])

  const body = useMemo(() => {
    if (state.kind === 'loading') return <p className="viewer-message">Loading…</p>
    if (state.kind === 'message') return <p className="viewer-message">{state.text}</p>
    if (state.kind === 'diff') {
      return (
        <pre className="viewer-code">
          {state.lines.map((l, i) => (
            <div key={i} className={l.startsWith('+') ? 'ln-add' : l.startsWith('-') ? 'ln-del' : l.startsWith('@@') ? 'ln-hunk' : 'ln'}>
              {l || ' '}
            </div>
          ))}
        </pre>
      )
    }
    return (
      <pre className="viewer-code">
        {state.lines.map((l, i) => (
          <div key={i} className="ln">
            <span className="ln-no">{i + 1}</span>
            {l || ' '}
          </div>
        ))}
      </pre>
    )
  }, [state])

  return (
    <div className="viewer">
      <div className="viewer-bar">
        <span className="viewer-path" title={path}>{path}</span>
        <div className="viewer-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'diff'} className={mode === 'diff' ? 'is-active' : ''} onClick={() => setMode('diff')}>
            Changes
          </button>
          <button role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'is-active' : ''} onClick={() => setMode('file')}>
            File
          </button>
        </div>
        <button className="viewer-icon" onClick={() => setReload((r) => r + 1)} title="Reload">↻</button>
        <button className="viewer-icon" onClick={onClose} title="Close">×</button>
      </div>
      {body}
    </div>
  )
}
