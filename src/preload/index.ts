import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  loadMap: () => ipcRenderer.invoke('map:load'),

  onMapUpdate: (callback: (map: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, map: unknown) => callback(map)
    ipcRenderer.on('map:updated', handler)
    return () => ipcRenderer.removeListener('map:updated', handler)
  },

  onStaleStatusChange: (callback: (isStale: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, isStale: boolean) => callback(isStale)
    ipcRenderer.on('map:stale-changed', handler)
    return () => ipcRenderer.removeListener('map:stale-changed', handler)
  },

  getStaleStatus: () => ipcRenderer.invoke('map:stale-status'),

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (partial: Record<string, unknown>) => ipcRenderer.invoke('settings:update', partial)
  },

  appVersion: () => ipcRenderer.invoke('app:version'),

  terminal: {
    spawn: (id: string) => ipcRenderer.send('terminal:spawn', id),

    write: (id: string, data: string) => ipcRenderer.send('terminal:write', id, data),

    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) =>
        callback(id, data)
      ipcRenderer.on('terminal:data', handler)
      return () => ipcRenderer.removeListener('terminal:data', handler)
    },

    onExit: (callback: (id: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string) => callback(id)
      ipcRenderer.on('terminal:exit', handler)
      return () => ipcRenderer.removeListener('terminal:exit', handler)
    },

    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.send('terminal:resize', id, cols, rows),

    kill: (id: string) => ipcRenderer.send('terminal:kill', id)
  }
})
