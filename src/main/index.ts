import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
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
import { AgentRecordStore } from './agent-records'

// One window, one project, like VS Code. A window starts on the home screen
// (recent projects); opening a project fills it, and another project opens in
// a new window. Each window owns its project's watcher, terminals and agents.

let settingsManager: SettingsManager | null = null
let projectManager: ProjectManager | null = null
let agentHooks: AgentHooks | null = null
let agentRecords: AgentRecordStore | null = null
let quitting = false

interface ProjectWindow {
  win: BrowserWindow
  project: ProjectInfo | null
  watcher: MapWatcher | null
  /** Terminals (agents) this window owns. */
  ptys: Set<string>
  /** Source files changed while the project is open, for "files changed since an agent started". */
  fileActivity: Map<string, { at: number; deleted: boolean }>
  latestPty: string | null
}

/** Windows by webContents id, so IPC from a renderer finds its window. */
const windows = new Map<number, ProjectWindow>()
/** Which window owns each terminal. */
const ptyOwner = new Map<string, ProjectWindow>()

function send(pw: ProjectWindow | undefined, channel: string, ...args: unknown[]): void {
  if (pw && !pw.win.isDestroyed()) pw.win.webContents.send(channel, ...args)
}

function fromEvent(e: IpcMainEvent | IpcMainInvokeEvent): ProjectWindow | undefined {
  return windows.get(e.sender.id)
}

function focusedWindow(): ProjectWindow | undefined {
  const w = BrowserWindow.getFocusedWindow()
  return w ? windows.get(w.webContents.id) : undefined
}

function windowWithProject(dir: string): ProjectWindow | undefined {
  return [...windows.values()].find((pw) => pw.project?.path === dir)
}

// --- Terminals --------------------------------------------------------------
// All PTYs live in a forked host process: node-pty shells exit immediately
// when spawned from Electron's main process IPC handlers.
let ptyHost: ChildProcess | null = null

// Recent output per PTY, so a terminal view can detach and reattach without
// losing what happened meanwhile. `total` counts every byte ever emitted;
// each data event carries the offset it starts at, so a reattaching view can
// skip what the buffer already holds.
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
    const owner = ptyOwner.get(msg.id)
    if (msg.type === 'data') {
      if (!msg.data) return
      const offset = recordOutput(msg.id, msg.data)
      send(owner, 'terminal:data', msg.id, msg.data, offset)
    } else if (msg.type === 'exit') {
      owner?.ptys.delete(msg.id)
      ptyOwner.delete(msg.id)
      send(owner, 'terminal:exit', msg.id)
    }
  })

  ptyHost.on('exit', () => {
    ptyHost = null
    ptyOwner.clear()
    for (const pw of windows.values()) pw.ptys.clear()
  })
}

export type AgentLaunch = { kind: 'claude' | 'codex'; prompt?: string; resume?: string }

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** The command that starts an agent CLI. Claude gets Origin's status hooks via --settings. */
function launchCommand(launch: AgentLaunch): string {
  const prompt = launch.prompt ? ` ${shellQuote(launch.prompt)}` : ''
  if (launch.kind === 'claude') {
    const settings = agentHooks?.settingsPath && fs.existsSync(agentHooks.settingsPath) ? ` --settings ${shellQuote(agentHooks.settingsPath)}` : ''
    const resume = launch.resume ? ` --resume ${shellQuote(launch.resume)}` : ''
    return `claude${settings}${resume}${prompt}`
  }
  return `codex${prompt}`
}

function spawnPty(pw: ProjectWindow, id: string, launch?: AgentLaunch): void {
  if (!ptyHost || ptyOwner.has(id)) return

  const shellPath = process.env.SHELL || '/bin/zsh'
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

  pw.ptys.add(id)
  pw.latestPty = id
  ptyOwner.set(id, pw)

  ptyHost.send({ type: 'spawn', id, shell: shellPath, args: ['--login', '-i'], cols: 80, rows: 24, cwd: pw.project?.path ?? os.homedir(), env })
  // The login shell buffers typeahead, so the command runs once it's ready.
  if (launch) ptyHost.send({ type: 'write', id, data: launchCommand(launch) + '\r' })
}

/** True if the terminal belongs to this window (a renderer may only touch its own). */
function owns(pw: ProjectWindow | undefined, id: string): pw is ProjectWindow {
  return !!pw && ptyOwner.get(id) === pw
}

function killPty(id: string): void {
  const owner = ptyOwner.get(id)
  owner?.ptys.delete(id)
  ptyOwner.delete(id)
  ptyOutput.delete(id)
  ptyHost?.send({ type: 'kill', id })
}

// --- Projects ---------------------------------------------------------------

/** Stops a window's terminals and watcher. Its agents stay saved and come back when the project reopens. */
function teardown(pw: ProjectWindow): void {
  if (pw.project) agentRecords?.freeze(pw.project.path)
  for (const id of [...pw.ptys]) killPty(id)
  pw.watcher?.stop()
  pw.watcher = null
  pw.fileActivity.clear()
  pw.latestPty = null
}

/** Remembers which projects are open, so they come back after a quit or a crash. */
function rememberOpenWindows(): void {
  if (quitting) return
  projectManager?.setOpen([...windows.values()].flatMap((pw) => (pw.project ? [pw.project.path] : [])))
}

function startWatcher(pw: ProjectWindow, dir: string): void {
  const watcher = new MapWatcher(dir)
  watcher.onSourceChange((event, rel) => {
    if (event === 'addDir' || event === 'unlinkDir' || !rel) return
    pw.fileActivity.set(rel, { at: Date.now(), deleted: event === 'unlink' })
  })
  watcher.onMapChange((map) => send(pw, 'map:updated', map))
  watcher.onStaleChange((isStale) => send(pw, 'map:stale-changed', isStale))
  watcher.start()
  pw.watcher = watcher
}

/** Puts a project into this window. Throws if the folder can't be opened. */
function loadProjectInto(pw: ProjectWindow, dir: string): ProjectInfo {
  if (!projectManager) throw new Error('Project manager not ready')
  const info = projectManager.touch(dir)
  teardown(pw)
  pw.project = info
  startWatcher(pw, info.path)
  pw.win.setTitle(`${info.name} · Origin`)
  pw.win.setRepresentedFilename?.(info.path)
  app.addRecentDocument(info.path)
  send(pw, 'project:changed', info)
  rememberOpenWindows()
  buildMenu()
  return info
}

/**
 * Opens a project the VS Code way: focus the window that already has it;
 * otherwise use the asking window if it's on the home screen, else a new window.
 */
function openProject(dir: string, from?: ProjectWindow): ProjectInfo {
  const resolved = fs.realpathSync(path.resolve(dir))
  const existing = windowWithProject(resolved)
  if (existing) {
    if (existing.win.isMinimized()) existing.win.restore()
    existing.win.focus()
    return projectManager!.touch(resolved)
  }
  if (from && !from.project) return loadProjectInto(from, resolved)
  return loadProjectInto(createWindow(), resolved)
}

/** Back to the home screen in this window. */
function closeProject(pw: ProjectWindow): void {
  teardown(pw)
  pw.project = null
  pw.win.setTitle('Origin')
  send(pw, 'project:changed', null)
  rememberOpenWindows()
  buildMenu()
}

async function pickProject(from?: ProjectWindow): Promise<ProjectInfo | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Open project folder',
    buttonLabel: 'Open',
    properties: ['openDirectory', 'createDirectory']
  }
  const result = from ? await dialog.showOpenDialog(from.win, options) : await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length === 0) return null
  return openProject(result.filePaths[0], from)
}

function recentProjects() {
  return (projectManager?.getRecent() ?? []).map((p) => ({
    ...p,
    openInWindow: !!windowWithProject(p.path),
    agents: agentRecords?.openCount(p.path) ?? 0
  }))
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const recent = projectManager?.getRecent().filter((p) => !p.missing) ?? []

  const recentItems: MenuItemConstructorOptions[] = recent.length
    ? [
        ...recent.map((p) => ({ label: `${p.name}  ${p.displayPath}`, click: () => openProject(p.path, focusedWindow()) })),
        { type: 'separator' },
        {
          label: 'Clear Recent',
          click: () => {
            projectManager?.clearRecent([...windows.values()].flatMap((pw) => (pw.project ? [pw.project.path] : [])))
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
        { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow() },
        { type: 'separator' },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+O', click: () => void pickProject(focusedWindow()) },
        { label: 'Open Recent', submenu: recentItems },
        { type: 'separator' },
        {
          label: 'Close Project',
          click: () => {
            const pw = focusedWindow()
            if (pw?.project) closeProject(pw)
          }
        },
        { role: 'close', label: 'Close Window' },
        ...(isMac ? [] : [{ type: 'separator' } as MenuItemConstructorOptions, { role: 'quit' } as MenuItemConstructorOptions])
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// --- Windows ----------------------------------------------------------------

// Automated tests run the app without a visible window, so it never takes
// focus or switches the user's desktop space.
const HIDDEN_WINDOW = process.env.ORIGIN_HIDDEN_WINDOW === '1'

function createWindow(): ProjectWindow {
  // New windows step down and right from the focused one, like most apps.
  const anchor = BrowserWindow.getFocusedWindow()?.getBounds()
  const win = new BrowserWindow({
    show: !HIDDEN_WINDOW,
    paintWhenInitiallyHidden: true,
    width: 1400,
    height: 900,
    ...(anchor ? { x: anchor.x + 28, y: anchor.y + 28 } : {}),
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

  const pw: ProjectWindow = { win, project: null, watcher: null, ptys: new Set(), fileActivity: new Map(), latestPty: null }
  const contentsId = win.webContents.id
  windows.set(contentsId, pw)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(path.join(__dirname, '../renderer/index.html'))

  win.on('closed', () => {
    teardown(pw)
    windows.delete(contentsId)
    rememberOpenWindows()
    buildMenu()
  })

  return pw
}

// --- IPC --------------------------------------------------------------------

function setupIPC(): void {
  ipcMain.handle('map:load', (e) => fromEvent(e)?.watcher?.getCurrentMap() ?? null)
  ipcMain.handle('map:stale-status', (e) => fromEvent(e)?.watcher?.isStale() ?? false)

  ipcMain.handle('settings:get', () => settingsManager?.get() ?? null)
  ipcMain.handle('settings:update', (_e, partial) => settingsManager?.update(partial) ?? null)
  ipcMain.handle('app:version', () => app.getVersion())

  ipcMain.handle('project:current', (e) => fromEvent(e)?.project ?? null)
  ipcMain.handle('project:recent', () => recentProjects())
  ipcMain.handle('project:pick', (e) => pickProject(fromEvent(e)))
  ipcMain.handle('project:open', (e, dir: string) => openProject(dir, fromEvent(e)))
  ipcMain.handle('project:close', (e) => {
    const pw = fromEvent(e)
    if (pw) closeProject(pw)
  })
  ipcMain.handle('project:remove-recent', (_e, dir: string) => {
    projectManager?.removeRecent(dir)
    buildMenu()
    return recentProjects()
  })
  ipcMain.handle('window:new', () => {
    createWindow()
  })

  ipcMain.handle('terminal:spawn', (e, id: string, launch?: AgentLaunch) => {
    const pw = fromEvent(e)
    if (!pw?.project || typeof id !== 'string') return
    const valid = launch && (launch.kind === 'claude' || launch.kind === 'codex')
    spawnPty(
      pw,
      id,
      valid
        ? {
            kind: launch.kind,
            prompt: typeof launch.prompt === 'string' ? launch.prompt : undefined,
            resume: typeof launch.resume === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(launch.resume) ? launch.resume : undefined
          }
        : undefined
    )
  })
  ipcMain.on('terminal:write', (e, id: string, data: string) => {
    if (owns(fromEvent(e), id)) ptyHost?.send({ type: 'write', id, data })
  })
  ipcMain.on('terminal:resize', (e, id: string, cols: number, rows: number) => {
    if (owns(fromEvent(e), id)) ptyHost?.send({ type: 'resize', id, cols, rows })
  })
  ipcMain.on('terminal:kill', (e, id: string) => {
    if (owns(fromEvent(e), id)) killPty(id)
  })
  ipcMain.handle('terminal:buffer', (e, id: string) => {
    const pw = fromEvent(e)
    const buf = owns(pw, id) ? ptyOutput.get(id) : undefined
    return { data: buf?.data ?? '', end: buf?.total ?? 0, alive: owns(pw, id) }
  })
  ipcMain.on('terminal:focus', (e, id: string) => {
    const pw = fromEvent(e)
    if (owns(pw, id)) pw.latestPty = id
  })
  ipcMain.on('terminal:write-active', (e, data: string) => {
    const pw = fromEvent(e)
    if (pw?.latestPty && owns(pw, pw.latestPty)) ptyHost?.send({ type: 'write', id: pw.latestPty, data })
  })

  // Saved agents for this window's project. Saves name the project they belong
  // to, so a late save from a project that was just closed can't land in another.
  ipcMain.handle('agents:load', (e) => {
    const project = fromEvent(e)?.project
    return project && agentRecords ? { project: project.path, ...agentRecords.load(project.path) } : null
  })
  ipcMain.on('agents:save', (e, project: string, data: unknown) => {
    const current = fromEvent(e)?.project
    if (!current || current.path !== project || !agentRecords) return
    try {
      agentRecords.save(current.path, data)
    } catch (err) {
      console.error('Failed to save agents:', err)
    }
  })

  ipcMain.handle('files:changed-since', (e, since: number) =>
    [...(fromEvent(e)?.fileActivity.entries() ?? [])]
      .filter(([, v]) => v.at >= since)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([rel, v]) => ({ path: rel, at: v.at, deleted: v.deleted }))
  )
  ipcMain.handle('files:read', async (e, rel: string) => {
    const abs = resolveInProject(fromEvent(e), rel)
    const stat = await fs.promises.stat(abs).catch(() => null)
    if (!stat?.isFile()) return { content: null, reason: 'File not found' }
    if (stat.size > 1024 * 1024) return { content: null, reason: 'File is larger than 1 MB' }
    const buf = await fs.promises.readFile(abs)
    if (buf.includes(0)) return { content: null, reason: 'Binary file' }
    return { content: buf.toString('utf-8'), reason: null }
  })
  ipcMain.handle('files:diff', async (e, rel: string) => {
    const pw = fromEvent(e)
    resolveInProject(pw, rel)
    const root = pw!.project!.path
    const tracked = await runGit(['ls-files', '--error-unmatch', '--', rel], root)
    if (!tracked) return { diff: null, untracked: true }
    return { diff: await runGit(['diff', 'HEAD', '--no-color', '--', rel], root), untracked: false }
  })
}

function resolveInProject(pw: ProjectWindow | undefined, rel: string): string {
  const root = pw?.project?.path
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

// --- App lifecycle ----------------------------------------------------------

if (HIDDEN_WINDOW && process.platform === 'darwin') {
  // No dock icon and never the active app.
  app.on('will-finish-launching', () => app.setActivationPolicy('accessory'))
}

app.whenReady().then(async () => {
  if (HIDDEN_WINDOW && process.platform === 'darwin') app.setActivationPolicy('accessory')
  await installSkill()
  settingsManager = new SettingsManager()
  projectManager = new ProjectManager()
  agentRecords = new AgentRecordStore()
  agentHooks = new AgentHooks()
  try {
    await agentHooks.start((e) => send(ptyOwner.get(e.agentId), 'agent:hook', e))
  } catch (err) {
    console.error('Agent status hooks unavailable:', err)
  }

  startPtyHost()
  setupIPC()
  buildMenu()

  // Bring back the windows that were open at the last quit (or crash).
  // The renderer asks for its project on mount, so it picks this up.
  const reopen = projectManager.getOpenAtLastRun()
  let opened = 0
  for (const dir of reopen) {
    try {
      loadProjectInto(createWindow(), dir)
      opened++
    } catch (err) {
      console.error('Failed to reopen project:', err)
    }
  }
  if (!opened) createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Quitting closes every window; keep the list of open projects as it was.
app.on('before-quit', () => {
  rememberOpenWindows()
  quitting = true
  agentRecords?.freezeAll()
})

app.on('will-quit', () => {
  for (const pw of windows.values()) pw.watcher?.stop()
  agentHooks?.stop()
  ptyHost?.kill()
  ptyHost = null
})
