import { useContext, useEffect, useMemo, useState } from 'react'
import { LiveTerminal } from './LiveTerminal'
import { changesFor, FileChangesContext, STATUS_LABEL } from './AgentNode'
import { agentStore, statusOf, type Agent } from './agentStore'

interface AgentSpaceProps {
  agent: Agent
  onBack: () => void
}

function ago(at: number): string {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  return `${Math.round(s / 3600)}h ago`
}

/** Inside an agent: its live terminal, the files changed since it started, and a viewer. */
export function AgentSpace({ agent, onBack }: AgentSpaceProps) {
  const changes = changesFor(agent, useContext(FileChangesContext))
  const [selected, setSelected] = useState<string | null>(null)
  const status = statusOf(agent)

  return (
    <div className="agent-space">
      <div className="agent-space-bar">
        <button className="strip-btn" onClick={onBack} title="Back to the overview">
          ← Overview
        </button>
        <span className={`agent-dot dot-${status}`} />
        <span className="agent-space-name">{agent.name}</span>
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
        <div className="agent-space-terminal">
          <LiveTerminal id={agent.id} focused />
        </div>

        <aside className="agent-space-side">
          <div className="files-panel">
            <h3 className="files-title">
              Files changed <span className="files-count">{changes.length}</span>
            </h3>
            <p className="files-note">Since this agent started, anywhere in the project.</p>
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
        </aside>
      </div>
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
