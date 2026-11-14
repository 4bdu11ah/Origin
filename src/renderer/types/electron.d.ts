import type { OriginMap } from './map'
import type { OriginSettings } from './settings'
import type { ProjectInfo, RecentProject } from './project'

export interface AgentHookEvent {
  agentId: string
  event: string
  sessionId?: string
  notificationType?: string
  message?: string
  toolName?: string
}

export interface SavedAgent {
  id: string
  kind: 'claude' | 'codex' | 'shell'
  name: string
  systemId: string | null
  createdAt: number
  sessionId: string | null
  exited?: boolean
  closedAt?: number
}

export interface SavedAgents {
  open: SavedAgent[]
  closed: SavedAgent[]
}

export interface ElectronAPI {
  loadMap: () => Promise<OriginMap | null>
  onMapUpdate: (callback: (map: OriginMap) => void) => () => void
  onStaleStatusChange: (callback: (isStale: boolean) => void) => () => void
  getStaleStatus: () => Promise<boolean>
  settings: {
    get: () => Promise<OriginSettings>
    update: (partial: Partial<OriginSettings>) => Promise<OriginSettings>
  }
  appVersion: () => Promise<string>
  files: {
    changedSince: (since: number) => Promise<Array<{ path: string; at: number; deleted: boolean }>>
    read: (rel: string) => Promise<{ content: string | null; reason: string | null }>
    diff: (rel: string) => Promise<{ diff: string | null; untracked: boolean }>
  }
  project: {
    current: () => Promise<ProjectInfo | null>
    recent: () => Promise<RecentProject[]>
    pick: () => Promise<ProjectInfo | null>
    open: (dir: string) => Promise<ProjectInfo>
    close: () => Promise<void>
    removeRecent: (dir: string) => Promise<RecentProject[]>
    onChange: (callback: (project: ProjectInfo | null) => void) => () => void
  }
  agents: {
    load: () => Promise<({ project: string } & SavedAgents) | null>
    save: (project: string, data: SavedAgents) => void
    /** Lifecycle events from agent hooks (Claude Code), tagged with the agent id. */
    onHook: (callback: (event: AgentHookEvent) => void) => () => void
  }
  terminal: {
    spawn: (id: string, launch?: { kind: 'claude' | 'codex'; prompt?: string; resume?: string }) => void
    write: (id: string, data: string) => void
    buffer: (id: string) => Promise<{ data: string; end: number; alive: boolean }>
    focus: (id: string) => void
    onData: (callback: (id: string, data: string, offset: number) => void) => () => void
    onExit: (callback: (id: string) => void) => () => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => void
    writeToActive: (data: string) => void
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
