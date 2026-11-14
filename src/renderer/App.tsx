import { useEffect, useMemo, useState } from 'react'
import { StaleIndicator } from './components/StaleIndicator/StaleIndicator'
import { Settings } from './components/Settings/Settings'
import { Welcome } from './components/Welcome/Welcome'
import { CanvasView } from './components/Canvas/CanvasView'
import { agentStore } from './components/Canvas/agentStore'
import { Rail } from './components/Rail/Rail'
import { WorkspaceProvider, type Screen } from './components/Workspace/WorkspaceContext'
import { BoardScreen } from './components/Screens/BoardScreen'
import { InboxScreen } from './components/Screens/InboxScreen'
import { ReleasesScreen } from './components/Screens/ReleasesScreen'
import { TeamScreen } from './components/Screens/TeamScreen'
import { ConnectionsScreen } from './components/Screens/ConnectionsScreen'
import { ChiefScreen } from './components/Screens/ChiefScreen'
import { MeetingsScreen } from './components/Screens/MeetingsScreen'
import { useMapData } from './hooks/useMapData'
import { useProject } from './hooks/useProject'
import { useSettings } from './contexts/SettingsContext'
import type { ProjectInfo } from './types/project'
import './App.css'

export default function App() {
  const { project, ready } = useProject()

  if (!ready) return <div className="app" />
  if (!project) return <Welcome />
  // Keyed by path: a new project remounts the workspace, so the map and agents reload.
  return <Workspace key={project.path} project={project} />
}

const SCREEN_KEY = 'origin.screen'

function readScreen(): Screen {
  try {
    const s = localStorage.getItem(SCREEN_KEY)
    return (['canvas', 'board', 'inbox', 'releases', 'meetings', 'team', 'connections', 'chief'] as const).find((x) => x === s) ?? 'canvas'
  } catch {
    return 'canvas'
  }
}

function Workspace({ project }: { project: ProjectInfo }) {
  const { map, isStale, loading } = useMapData()
  const { settings } = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [screen, setScreenState] = useState<Screen>(readScreen)
  const setScreen = (s: Screen) => {
    setScreenState(s)
    try {
      localStorage.setItem(SCREEN_KEY, s)
    } catch {
      // per-viewer convenience only
    }
  }

  // This window's agents: loaded with the project, forgotten when it goes
  // back to home (main stops their terminals and keeps them saved).
  useEffect(() => {
    agentStore.resetFor(project.path)
    return () => agentStore.detach()
  }, [project.path])

  const systems = useMemo(
    () => (map?.systems ?? []).map((s, i) => ({ id: s.id, label: s.label, color: settings.graphPalette[i % settings.graphPalette.length] || s.color })),
    [map, settings.graphPalette]
  )

  return (
    <WorkspaceProvider projectPath={project.path} systems={systems} screen={screen} setScreen={setScreen}>
      <div className="app">
        <header className="app-header titlebar-drag-region">
          <div className="app-header-left">
            <span className="app-logo">Origin</span>
            <button
              className="app-project-name titlebar-no-drag"
              onClick={() => window.api.project.close()}
              title={`${project.path}\nBack to home (agents are saved and come back)`}
            >
              {project.name}
            </button>
          </div>
          <div className="app-header-center" />
          <div className="app-header-right titlebar-no-drag">
            {isStale && <StaleIndicator />}
            <button className="view-toggle new-window" onClick={() => window.api.project.newWindow()} title="Open another project in a new window (⌘⇧N)">
              + New window
            </button>
            <button className="terminal-toggle" onClick={() => setSettingsOpen(true)} title="Settings">
              <GearIcon />
            </button>
          </div>
        </header>

        <div className="app-body">
          <Rail />
          <main className="app-content">
            {/* The canvas stays mounted (hidden) so agents and the viewport survive screen changes. */}
            <div className={`screen-layer${screen === 'canvas' ? '' : ' is-hidden'}`} inert={screen !== 'canvas'}>
              {loading ? (
                <div className="empty-state">
                  <p className="empty-state-text">Loading map...</p>
                </div>
              ) : (
                <CanvasView map={map} projectPath={project.path} active={screen === 'canvas'} />
              )}
            </div>
            {screen === 'board' && <BoardScreen />}
            {screen === 'inbox' && <InboxScreen />}
            {screen === 'releases' && <ReleasesScreen />}
            {screen === 'meetings' && <MeetingsScreen />}
            {screen === 'team' && <TeamScreen />}
            {screen === 'connections' && <ConnectionsScreen />}
            {screen === 'chief' && <ChiefScreen />}
          </main>
        </div>

        {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      </div>
    </WorkspaceProvider>
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
