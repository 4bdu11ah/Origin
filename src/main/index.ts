import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { fork, type ChildProcess } from 'child_process'
import path from 'path'
import os from 'os'
import { installSkill } from './skill-installer'
import { MapWatcher } from './file-watcher'
import { SettingsManager } from './settings-manager'

let mainWindow: BrowserWindow | null = null
let mapWatcher: MapWatcher | null = null
let settingsManager: SettingsManager | null = null

// PTY host — a separate Node.js process that manages all PTY instances.
// node-pty shells exit immediately when spawned from Electron's main process
// IPC handlers, so we delegate all PTY work to a clean child process.
let ptyHost: ChildProcess | null = null
const activePtys = new Set<string>()
let latestPtyId: string | null = null

function startPtyHost(): void {
  ptyHost = fork(path.join(__dirname, 'pty-host.js'), [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })

  ptyHost.on('message', (msg: { type: string; id: string; data?: string; exitCode?: number }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (msg.type === 'data') {
      mainWindow.webContents.send('terminal:data', msg.id, msg.data)
    } else if (msg.type === 'exit') {
      activePtys.delete(msg.id)
      mainWindow.webContents.send('terminal:exit', msg.id)
    }
  })

  ptyHost.on('exit', () => {
    ptyHost = null
    activePtys.clear()
  })
}

function spawnPty(id: string): void {
  if (!ptyHost || !mainWindow) return
  if (activePtys.has(id)) return

  const shellPath = process.env.SHELL || '/bin/zsh'
  const cwd = process.cwd()

  const env: Record<string, string> = {
    HOME: os.homedir(),
    SHELL: shellPath,
    USER: os.userInfo().username,
    PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    TERM: 'xterm-256color',
    LANG: process.env.LANG || 'en_US.UTF-8',
    COLORTERM: 'truecolor'
  }
  for (const k of ['LOGNAME', 'TMPDIR', 'SSH_AUTH_SOCK']) {
    if (process.env[k]) env[k] = process.env[k]!
  }

  activePtys.add(id)
  latestPtyId = id

  ptyHost.send({
    type: 'spawn',
    id,
    shell: shellPath,
    args: ['--login', '-i'],
    cols: 80,
    rows: 24,
    cwd,
    env
  })
}

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
  ipcMain.handle('map:load', async () => {
    if (!mapWatcher) return null
    return mapWatcher.getCurrentMap()
  })

  ipcMain.handle('map:stale-status', async () => {
    if (!mapWatcher) return false
    return mapWatcher.isStale()
  })

  ipcMain.handle('settings:get', () => {
    return settingsManager?.get() ?? null
  })

  ipcMain.handle('settings:update', (_event, partial) => {
    return settingsManager?.update(partial) ?? null
  })

  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  ipcMain.handle('terminal:spawn', (_event, id: string) => {
    spawnPty(id)
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    ptyHost?.send({ type: 'write', id, data })
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    ptyHost?.send({ type: 'resize', id, cols, rows })
  })

  ipcMain.on('terminal:kill', (_event, id: string) => {
    activePtys.delete(id)
    ptyHost?.send({ type: 'kill', id })
  })

  ipcMain.on('terminal:write-active', (_event, data: string) => {
    if (latestPtyId && activePtys.has(latestPtyId)) {
      ptyHost?.send({ type: 'write', id: latestPtyId, data })
    }
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

  startPtyHost()
  setupIPC()
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
  ptyHost?.kill()
  ptyHost = null
  activePtys.clear()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
