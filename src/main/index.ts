import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { execFile, fork, type ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { installSkill } from './skill-installer'
import { MapWatcher } from './file-watcher'
import { SettingsManager } from './settings-manager'
import { ProjectManager, type ProjectInfo } from './project-manager'
import { AgentHooks } from './agent-hooks'

let mainWindow: BrowserWindow | null = null
let mapWatcher: MapWatcher | null = null
let settingsManager: SettingsManager | null = null
let projectManager: ProjectManager | null = null
let agentHooks: AgentHooks | null = null

// PTY host — a separate Node.js process that manages all PTY instances.
// node-pty shells exit immediately when spawned from Electron's main process
// IPC handlers, so we delegate all PTY work to a clean child process.
let ptyHost: ChildProcess | null = null
const activePtys = new Set<string>()
let latestPtyId: string | null = null

// Recent output per PTY, so a terminal view can detach (e.g. zoomed out to a
// card on the canvas) and reattach without losing what happened meanwhile.
// `total` counts every byte ever emitted; each data event carries the offset
// it starts at, so a reattaching view can skip what the buffer already holds.
const OUTPUT_BUFFER_MAX = 512 * 1024
const ptyOutput = new Map<string, { data: string; total: number }>()

function recordOutput(id: string, chunk: string): number {
  const buf = ptyOutput.get(id) ?? { data: '', total: 0 }
  const offset = buf.total
  buf.data += chunk
  buf.total += chunk.length
  if (buf.data.length > OUTPUT_BUFFER_MAX) buf.data = buf.data.slice(-OUTPUT_BUFFER_MAX)
  ptyOutput.set(id, buf)
  return offset
}

function startPtyHost(): void {
  ptyHost = fork(path.join(__dirname, 'pty-host.js'), [], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })

  ptyHost.on('message', (msg: { type: string; id: string; data?: string; exitCode?: number }) => {
    if (msg.type === 'data') {
      if (!msg.data) return
      const offset = recordOutput(msg.id, msg.data)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', msg.id, msg.data, offset)
      }
    } else if (msg.type === 'exit') {
      activePtys.delete(msg.id)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', msg.id)
      }
    }
  })

  ptyHost.on('exit', () => {
    ptyHost = null
    activePtys.clear()
  })
}

export type AgentLaunch = { kind: 'claude' | 'codex'; prompt?: string }

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** The command that starts an agent CLI. Claude gets Origin's status hooks via --settings. */
function launchCommand(launch: AgentLaunch): string {
  const prompt = launch.prompt ? ` ${shellQuote(launch.prompt)}` : ''
  if (launch.kind === 'claude') {
    const settings = agentHooks?.settingsPath && fs.existsSync(agentHooks.settingsPath) ? ` --settings ${shellQuote(agentHooks.settingsPath)}` : ''
    return `claude${settings}${prompt}`
  }
  return `codex${prompt}`
}

function spawnPty(id: string, launch?: AgentLaunch): void {
  if (!ptyHost || !mainWindow) return
  if (activePtys.has(id)) return

  const shellPath = process.env.SHELL || '/bin/zsh'
  const cwd = projectManager?.getCurrent()?.path ?? os.homedir()

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
  Object.assign(env, agentHooks?.env(id) ?? {})

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
  // The login shell buffers typeahead, so the command runs once it's ready.
  if (launch) ptyHost.send({ type: 'write', id, data: launchCommand(launch) + '\r' })
}

function killAllPtys(): void {
  for (const id of activePtys) ptyHost?.send({ type: 'kill', id })
  activePtys.clear()
  ptyOutput.clear()
  latestPtyId = null
}

// --- Projects ---------------------------------------------------------------
// One project is open at a time. Terminals and the map watcher belong to it,
// so switching projects tears both down and starts fresh in the new folder.

function openProject(dir: string): ProjectInfo {
  if (!projectManager) throw new Error('Project manager not ready')
  const info = projectManager.open(dir)

  killAllPtys()
  mapWatcher?.stop()
  setupMapWatcher(info.path)

  app.addRecentDocument(info.path)
  buildMenu()
  mainWindow?.webContents.send('project:changed', info)
  return info
}

function closeProject(): void {
  killAllPtys()
  mapWatcher?.stop()
  mapWatcher = null
  projectManager?.close()
  buildMenu()
  mainWindow?.webContents.send('project:changed', null)
}

async function pickProject(): Promise<ProjectInfo | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Open project folder',
    buttonLabel: 'Open',
    properties: ['openDirectory', 'createDirectory']
  }
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return openProject(result.filePaths[0])
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const recent = projectManager?.getRecent().filter((p) => !p.missing) ?? []
  const current = projectManager?.getCurrent() ?? null

  const recentItems: MenuItemConstructorOptions[] = recent.length
    ? [
        ...recent.map((p) => ({ label: `${p.name}  ${p.displayPath}`, click: () => openProject(p.path) })),
        { type: 'separator' },
        {
          label: 'Clear Recent',
          click: () => {
            projectManager?.clearRecent()
            app.clearRecentDocuments()
            buildMenu()
          }
        }
      ]
    : [{ label: 'No recent projects', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => void pickProject() },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        { label: 'Close Project', enabled: !!current, click: () => closeProject() },
        ...(isMac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'quit' } as MenuItemConstructorOptions])
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
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

  ipcMain.handle('project:current', () => projectManager?.getCurrent() ?? null)
  ipcMain.handle('project:recent', () => projectManager?.getRecent() ?? [])
  ipcMain.handle('project:pick', () => pickProject())
  ipcMain.handle('project:open', (_event, dir: string) => openProject(dir))
  ipcMain.handle('project:close', () => closeProject())
  ipcMain.handle('project:remove-recent', (_event, dir: string) => {
    projectManager?.removeRecent(dir)
    buildMenu()
    return projectManager?.getRecent() ?? []
  })

  ipcMain.handle('terminal:spawn', (_event, id: string, launch?: AgentLaunch) => {
    spawnPty(id, launch && (launch.kind === 'claude' || launch.kind === 'codex') ? { kind: launch.kind, prompt: typeof launch.prompt === 'string' ? launch.prompt : undefined } : undefined)
  })

  ipcMain.on('terminal:write', (_event, id: string, data: string) => {
    ptyHost?.send({ type: 'write', id, data })
  })

  ipcMain.on('terminal:resize', (_event, id: string, cols: number, rows: number) => {
    ptyHost?.send({ type: 'resize', id, cols, rows })
  })

  ipcMain.on('terminal:kill', (_event, id: string) => {
    activePtys.delete(id)
    ptyOutput.delete(id)
    ptyHost?.send({ type: 'kill', id })
  })

  ipcMain.handle('files:changed-since', (_event, since: number) =>
    [...fileActivity.entries()]
      .filter(([, v]) => v.at >= since)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([rel, v]) => ({ path: rel, at: v.at, deleted: v.deleted }))
  )

  ipcMain.handle('files:read', async (_event, rel: string) => {
    const abs = resolveInProject(rel)
    const stat = await fs.promises.stat(abs).catch(() => null)
    if (!stat?.isFile()) return { content: null, reason: 'File not found' }
    if (stat.size > 1024 * 1024) return { content: null, reason: 'File is larger than 1 MB' }
    const buf = await fs.promises.readFile(abs)
    if (buf.includes(0)) return { content: null, reason: 'Binary file' }
    return { content: buf.toString('utf-8'), reason: null }
  })

  ipcMain.handle('files:diff', async (_event, rel: string) => {
    resolveInProject(rel)
    const root = projectManager!.getCurrent()!.path
    const tracked = await runGit(['ls-files', '--error-unmatch', '--', rel], root)
    if (!tracked) return { diff: null, untracked: true }
    return { diff: await runGit(['diff', 'HEAD', '--no-color', '--', rel], root), untracked: false }
  })

  ipcMain.handle('terminal:buffer', (_event, id: string) => {
    const buf = ptyOutput.get(id)
    return { data: buf?.data ?? '', end: buf?.total ?? 0, alive: activePtys.has(id) }
  })

  ipcMain.on('terminal:focus', (_event, id: string) => {
    if (activePtys.has(id)) latestPtyId = id
  })

  ipcMain.on('terminal:write-active', (_event, data: string) => {
    if (latestPtyId && activePtys.has(latestPtyId)) {
      ptyHost?.send({ type: 'write', id: latestPtyId, data })
    }
  })
}

// Source files changed while the project is open, so an agent's space can list
// what changed since it started. Agents share one checkout for now, so this is
// project-wide; per-agent attribution comes from agent hooks later.
const fileActivity = new Map<string, { at: number; deleted: boolean }>()

function resolveInProject(rel: string): string {
  const root = projectManager?.getCurrent()?.path
  if (!root) throw new Error('No project open')
  const abs = path.resolve(root, rel)
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('Path is outside the project')
  return abs
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, maxBuffer: 4 * 1024 * 1024, timeout: 5000 }, (err, stdout) => resolve(err ? '' : stdout))
  })
}

function setupMapWatcher(projectDir: string): void {
  fileActivity.clear()
  mapWatcher = new MapWatcher(projectDir)
  mapWatcher.onSourceChange((event, rel) => {
    if (event === 'addDir' || event === 'unlinkDir' || !rel) return
    fileActivity.set(rel, { at: Date.now(), deleted: event === 'unlink' })
  })

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
  projectManager = new ProjectManager()

  agentHooks = new AgentHooks()
  try {
    await agentHooks.start((e) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('agent:hook', e)
    })
  } catch (err) {
    console.error('Agent status hooks unavailable:', err)
  }

  startPtyHost()
  setupIPC()
  buildMenu()
  createWindow()

  // Reopen the project that was open at last quit. The renderer asks for the
  // current project on mount, so it picks this up without an event.
  const last = projectManager.getLastOpen()
  if (last) {
    try {
      openProject(last)
    } catch (err) {
      console.error('Failed to reopen last project:', err)
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// On macOS the app stays alive with no window; reopening from the dock creates
// a new window on the same project, so keep the PTY host and watcher running.
app.on('window-all-closed', () => {
  killAllPtys()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  mapWatcher?.stop()
  agentHooks?.stop()
  ptyHost?.kill()
  ptyHost = null
  activePtys.clear()
})
