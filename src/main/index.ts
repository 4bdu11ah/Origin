import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { installSkill } from './skill-installer'
import { MapWatcher } from './file-watcher'
import { TerminalManager } from './terminal-manager'
import { SettingsManager } from './settings-manager'

let mainWindow: BrowserWindow | null = null
let mapWatcher: MapWatcher | null = null
let terminalManager: TerminalManager | null = null
let settingsManager: SettingsManager | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Origin',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0A0A0B',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function setupIPC(): void {
  // Map loading
  ipcMain.handle('map:load', async () => {
    if (!mapWatcher) return null
    return mapWatcher.getCurrentMap()
  })

  ipcMain.handle('map:stale-status', async () => {
    if (!mapWatcher) return false
    return mapWatcher.isStale()
  })

  // Settings
  ipcMain.handle('settings:get', () => {
    return settingsManager?.get() ?? null
  })

  ipcMain.handle('settings:update', (_event, partial) => {
    return settingsManager?.update(partial) ?? null
  })

  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  // Terminal — all messages include a terminal ID
  ipcMain.on('terminal:spawn', (_event, id: string) => {
    if (!terminalManager || !mainWindow) return
    terminalManager.spawn(id, mainWindow)
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    terminalManager?.write(id, data)
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    terminalManager?.resize(id, cols, rows)
  })

  ipcMain.on('terminal:kill', (_event, id: string) => {
    terminalManager?.kill(id)
  })
}

function setupMapWatcher(): void {
  const cwd = process.cwd()
  mapWatcher = new MapWatcher(cwd)

  mapWatcher.onMapChange((map) => {
    mainWindow?.webContents.send('map:updated', map)
  })

  mapWatcher.onStaleChange((isStale) => {
    mainWindow?.webContents.send('map:stale-changed', isStale)
  })

  mapWatcher.start()
}

app.whenReady().then(async () => {
  await installSkill()
  settingsManager = new SettingsManager()
  setupIPC()

  terminalManager = new TerminalManager()

  createWindow()
  setupMapWatcher()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  mapWatcher?.stop()
  terminalManager?.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
