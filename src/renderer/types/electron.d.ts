import type { OriginMap } from './map'
import type { OriginSettings } from './settings'

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
  terminal: {
    spawn: (id: string) => void
    write: (id: string, data: string) => void
    onData: (callback: (id: string, data: string) => void) => () => void
    onExit: (callback: (id: string) => void) => () => void
    resize: (id: string, cols: number, rows: number) => void
    kill: (id: string) => void
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
