import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RecentProject } from '../../types/project'
import './Welcome.css'

// Home screen of a window: pick the project this window is for. One window
// holds one project; another project opens in a new window.

const MOD_KEY = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl+'
const SHIFT = navigator.userAgent.includes('Mac') ? '⇧' : 'Shift+'

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

const DAY = 24 * 60 * 60 * 1000

function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Which time frame a project was last opened in. */
function frameOf(at: number, now: number): string {
  const today = startOfDay(now)
  if (at >= today) return 'Today'
  if (at >= today - DAY) return 'Yesterday'
  if (at >= today - 6 * DAY) return 'This week'
  if (at >= today - 29 * DAY) return 'This month'
  return 'Earlier'
}

function when(at: number, now: number): string {
  const m = Math.round((now - at) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (at >= startOfDay(now)) return `${Math.round(m / 60)}h ago`
  const d = new Date(at)
  if (at >= startOfDay(now) - 6 * DAY) return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: at < now - 300 * DAY ? 'numeric' : undefined })
}

export function Welcome() {
  const [recent, setRecent] = useState<RecentProject[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    window.api.project.recent().then(setRecent)
  }, [])

  // Other windows open and close projects; refresh when this one comes back.
  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])

  const groups = useMemo(() => {
    const now = Date.now()
    const out: { frame: string; items: RecentProject[] }[] = []
    for (const p of [...recent].sort((a, b) => b.openedAt - a.openedAt)) {
      const frame = frameOf(p.openedAt, now)
      if (out[out.length - 1]?.frame !== frame) out.push({ frame, items: [] })
      out[out.length - 1].items.push(p)
    }
    return out
  }, [recent])

  const openFolder = async () => {
    setError(null)
    try {
      await window.api.project.pick()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const openRecent = async (p: RecentProject) => {
    if (p.missing) return
    setError(null)
    try {
      await window.api.project.open(p.path)
      refresh()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const removeRecent = async (p: RecentProject) => {
    setRecent(await window.api.project.removeRecent(p.path))
  }

  const now = Date.now()

  return (
    <div className="welcome">
      <div className="welcome-titlebar titlebar-drag-region" />
      <div className="welcome-body">
        <h1 className="welcome-title">Origin</h1>
        <p className="welcome-subtitle">Pick the project for this window. Each project gets its own window.</p>

        <div className="welcome-actions">
          <button className="welcome-open" onClick={openFolder}>
            Open folder…
            <kbd className="welcome-kbd">{MOD_KEY}O</kbd>
          </button>
          <button className="welcome-secondary" onClick={() => window.api.project.newWindow()}>
            New window
            <kbd className="welcome-kbd">
              {MOD_KEY}
              {SHIFT}N
            </kbd>
          </button>
        </div>

        {error && <p className="welcome-error">{error}</p>}

        {groups.map((g) => (
          <section className="welcome-recent" key={g.frame}>
            <h2 className="welcome-section-title">{g.frame}</h2>
            <ul className="welcome-recent-list">
              {g.items.map((p) => (
                <li key={p.path} className={`welcome-recent-row${p.missing ? ' is-missing' : ''}`}>
                  <button className="welcome-recent-item" onClick={() => openRecent(p)} disabled={p.missing} title={p.path}>
                    <span className="welcome-recent-top">
                      <span className="welcome-recent-name">{p.name}</span>
                      {p.openInWindow && <span className="welcome-badge is-open">Open</span>}
                      {!p.openInWindow && p.agents > 0 && (
                        <span className="welcome-badge">{p.agents === 1 ? '1 agent' : `${p.agents} agents`}</span>
                      )}
                      <span className="welcome-recent-when">{when(p.openedAt, now)}</span>
                    </span>
                    <span className="welcome-recent-path">{p.missing ? 'Folder not found' : p.displayPath}</span>
                  </button>
                  <button
                    className="welcome-recent-remove"
                    onClick={() => removeRecent(p)}
                    aria-label={`Remove ${p.name} from recent projects`}
                    title="Remove from recent"
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
