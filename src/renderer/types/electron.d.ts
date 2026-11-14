import type { OriginMap } from './map'
import type { OriginSettings } from './settings'
import type { ProjectInfo, RecentProject } from './project'

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
  project: {
    current: () => Promise<ProjectInfo | null>
    recent: () => Promise<RecentProject[]>
    pick: () => Promise<ProjectInfo | null>
    open: (dir: string) => Promise<ProjectInfo>
    close: () => Promise<void>
    removeRecent: (dir: string) => Promise<RecentProject[]>
    onChange: (callback: (project: ProjectInfo | null) => void) => () => void
  }
  terminal: {
    spawn: (id: string) => void
    write: (id: string, data: string) => void
    onData: (callback: (id: string, data: string) => void) => () => void
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
