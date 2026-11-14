import { useState, useCallback } from 'react'
import { SpatialMap } from './components/SpatialMap/SpatialMap'
import { Terminal } from './components/Terminal/Terminal'
import { StaleIndicator } from './components/StaleIndicator/StaleIndicator'
import { Breadcrumb } from './components/Breadcrumb/Breadcrumb'
import { Settings } from './components/Settings/Settings'
import { Welcome } from './components/Welcome/Welcome'
import { CanvasView } from './components/Canvas/CanvasView'
import { useMapData } from './hooks/useMapData'
import { useProject } from './hooks/useProject'
import type { ProjectInfo } from './types/project'
import './App.css'

export default function App() {
  const { project, ready } = useProject()

  if (!ready) return <div className="app" />
  if (!project) return <Welcome />
  // Keyed by path: switching projects remounts the workspace, so the map
  // reloads and terminals restart in the new folder.
  return <Workspace key={project.path} project={project} />
}

type ViewMode = 'canvas' | 'classic'
const VIEW_MODE_KEY = 'origin.viewMode'

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'classic' ? 'classic' : 'canvas'
  } catch {
    return 'canvas'
  }
}

function Workspace({ project }: { project: ProjectInfo }) {
  const { map, isStale, loading, navigation, navigateTo, navigateBack } = useMapData()
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode)
  const toggleViewMode = () => {
    const next: ViewMode = viewMode === 'canvas' ? 'classic' : 'canvas'
    setViewMode(next)
    try {
      localStorage.setItem(VIEW_MODE_KEY, next)
    } catch {
      // per-viewer convenience only
    }
  }
  const [terminalOpen, setTerminalOpen] = useState(true)
  const [terminalHeight, setTerminalHeight] = useState(250)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleChatWith = useCallback((context: string) => {
    // Open terminal if closed
    if (!terminalOpen) setTerminalOpen(true)
    // Write to the active PTY via IPC (main process tracks the latest terminal)
    setTimeout(() => {
      window.api.terminal.writeToActive(context)
    }, terminalOpen ? 0 : 150)
  }, [terminalOpen])

  return (
    <div className="app">
      {/* Titlebar / drag region */}
      <header className="app-header titlebar-drag-region">
        <div className="app-header-left">
          <span className="app-logo">Origin</span>
          <button
            className="app-project-name titlebar-no-drag"
            onClick={() => window.api.project.close()}
            title={`${project.path}\nClick to switch project`}
          >
            {project.name}
          </button>
        </div>
        <div className="app-header-center titlebar-no-drag">
          {viewMode === 'classic' && (
            <Breadcrumb
              navigation={navigation}
              map={map}
              onNavigate={navigateTo}
            />
          )}
        </div>
        <div className="app-header-right titlebar-no-drag">
          {isStale && <StaleIndicator />}
          <button
            className="view-toggle"
            onClick={toggleViewMode}
            title="Switch between the flat canvas and the classic map + terminal layout"
          >
            {viewMode === 'canvas' ? 'Canvas' : 'Classic'}
          </button>
          {viewMode === 'classic' && (
            <button
              className="terminal-toggle"
              onClick={() => setTerminalOpen(!terminalOpen)}
              title={terminalOpen ? 'Hide terminal' : 'Show terminal'}
            >
              <TerminalIcon />
            </button>
          )}
          <button
            className="terminal-toggle"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {/* Main content area */}
      {viewMode === 'canvas' ? (
        <div className="app-content">
          {loading ? <EmptyState type="loading" /> : <CanvasView map={map} projectPath={project.path} />}
        </div>
      ) : (
      <div className="app-content">
        <div className="map-container" style={{
          height: terminalOpen ? `calc(100% - ${terminalHeight}px)` : '100%'
        }}>
          {loading ? (
            <EmptyState type="loading" />
          ) : !map ? (
            <EmptyState type="no-map" />
          ) : (
            <SpatialMap
              map={map}
              navigation={navigation}
              onNavigate={navigateTo}
              onNavigateBack={navigateBack}
              onChatWith={handleChatWith}
            />
          )}
        </div>

        {terminalOpen && (
          <>
            <ResizeHandle
              onResize={(delta) => setTerminalHeight((h) => {
                const maxH = window.innerHeight - 120 // leave room for header + some map
                return Math.max(48, Math.min(maxH, h - delta))
              })}
            />
            <div className="terminal-container" style={{ height: terminalHeight }}>
              <Terminal />
            </div>
          </>
        )}
      </div>
      )}

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function EmptyState({ type }: { type: 'loading' | 'no-map' }) {
  if (type === 'loading') {
    return (
      <div className="empty-state">
        <p className="empty-state-text">Loading map...</p>
      </div>
    )
  }

  return (
    <div className="empty-state">
      <div className="empty-state-icon">.</div>
      <h2 className="empty-state-title">No map yet</h2>
      <p className="empty-state-text">
        Run <code>/origin</code> in the terminal below to generate<br />
        a visual map of your codebase.
      </p>
    </div>
  )
}

function TerminalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    let lastY = e.clientY

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - lastY
      lastY = e.clientY
      onResize(delta)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return <div className="resize-handle" onMouseDown={handleMouseDown} />
}
