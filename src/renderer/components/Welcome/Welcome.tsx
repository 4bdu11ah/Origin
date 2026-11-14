import { useEffect, useState } from 'react'
import type { RecentProject } from '../../types/project'
import './Welcome.css'

const MOD_KEY = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl+'

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export function Welcome() {
  const [recent, setRecent] = useState<RecentProject[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.project.recent().then(setRecent)
  }, [])

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
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const removeRecent = async (p: RecentProject) => {
    setRecent(await window.api.project.removeRecent(p.path))
  }

  return (
    <div className="welcome">
      <div className="welcome-titlebar titlebar-drag-region" />
      <div className="welcome-body">
        <h1 className="welcome-title">Origin</h1>
        <p className="welcome-subtitle">Open a project folder to see its map and run agents in it.</p>

        <button className="welcome-open" onClick={openFolder}>
          Open folder…
          <kbd className="welcome-kbd">{MOD_KEY}O</kbd>
        </button>

        {error && <p className="welcome-error">{error}</p>}

        {recent.length > 0 && (
          <section className="welcome-recent">
            <h2 className="welcome-section-title">Recent</h2>
            <ul className="welcome-recent-list">
              {recent.map((p) => (
                <li key={p.path} className={`welcome-recent-row${p.missing ? ' is-missing' : ''}`}>
                  <button
                    className="welcome-recent-item"
                    onClick={() => openRecent(p)}
                    disabled={p.missing}
                    title={p.path}
                  >
                    <span className="welcome-recent-name">{p.name}</span>
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
        )}
      </div>
    </div>
  )
}
