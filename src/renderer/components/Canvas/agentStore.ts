// Agents on the canvas: one PTY each, plus enough derived state to draw a card
// without mounting a real terminal. Each agent has an in-memory (headless)
// terminal fed the same output, so the card can show the agent's actual
// screen, including full-screen UIs like Claude Code that redraw in place.
// Module-level store read through useSyncExternalStore; reset per project.
//
// Status: Claude agents report through hooks (working, needs you, done,
// error), which is exact. Shells, and any agent before its first hook, fall
// back to inferring status from terminal output.

import { useSyncExternalStore } from 'react'
import { Terminal as HeadlessTerminal } from '@xterm/headless'
import type { SavedAgent } from '../../types/electron'

export type AgentKind = 'claude' | 'codex' | 'shell'
export type AgentStatus = 'working' | 'needs-you' | 'error' | 'unread' | 'idle' | 'exited'

/** Last state reported by hooks; null while unhooked (plain shell, or agent CLI not started yet). */
export type HookState = 'ready' | 'working' | 'needs-you' | 'done' | 'error' | null

export interface Agent {
  id: string
  kind: AgentKind
  name: string
  systemId: string | null
  createdAt: number
  /** When this terminal was (re)started. */
  startedAt: number
  /** Startup is over: the terminal went quiet once. Output before that is never "new". */
  settled: boolean
  lastOutputAt: number
  unseen: boolean
  exited: boolean
  /** Visible screen rows, as plain text. */
  screen: string[]
  /** Last meaningful line on screen, for compact places like the palette. */
  lastLine: string
  hook: HookState
  /** Agent CLI session id, for resuming later. */
  sessionId: string | null
}

const WORKING_WINDOW_MS = 1500
const STARTUP_GRACE_MS = 2500
const SCREEN_REFRESH_MS = 200
export const DEFAULT_COLS = 96
export const DEFAULT_ROWS = 26

let agents: Agent[] = []
/** Recently stopped agents that can be reopened, newest first. */
let closed: SavedAgent[] = []
let projectKey: string | null = null
/** The project whose saved agents have been loaded; saving waits for this. */
let loadedFor: string | null = null
const MAX_CLOSED = 20
let focusedId: string | null = null
let counter = 0
const screens = new Map<string, HeadlessTerminal>()
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>()
const listeners = new Set<() => void>()
let snapshot: { agents: Agent[]; closed: SavedAgent[]; focusedId: string | null; tick: number } = { agents, closed, focusedId, tick: 0 }

function emit(): void {
  snapshot = { agents, closed, focusedId, tick: snapshot.tick + 1 }
  listeners.forEach((l) => l())
}

function update(id: string, patch: Partial<Agent>): void {
  agents = agents.map((a) => (a.id === id ? { ...a, ...patch } : a))
}

function toRecord(a: Agent): SavedAgent {
  return { id: a.id, kind: a.kind, name: a.name, systemId: a.systemId, createdAt: a.createdAt, sessionId: a.sessionId, exited: a.exited || undefined }
}

// Save after every structural change (coalesced), so a crash loses nothing.
let saveQueued = false
function persist(): void {
  if (!projectKey || loadedFor !== projectKey || saveQueued) return
  saveQueued = true
  setTimeout(() => {
    saveQueued = false
    if (!projectKey || loadedFor !== projectKey) return
    window.api.agents.save(projectKey, { open: agents.map(toRecord), closed })
  }, 0)
}

export function statusOf(a: Agent, now = Date.now()): AgentStatus {
  if (a.exited) return 'exited'
  if (a.hook) {
    if (a.hook === 'working' || a.hook === 'needs-you' || a.hook === 'error') return a.hook
    return a.unseen ? 'unread' : 'idle'
  }
  if (now - a.lastOutputAt < WORKING_WINDOW_MS && now - a.startedAt > 800) return 'working'
  if (a.unseen) return 'unread'
  return 'idle'
}

function readScreen(term: HeadlessTerminal): string[] {
  const buf = term.buffer.active
  const rows: string[] = []
  for (let y = 0; y < term.rows; y++) rows.push(buf.getLine(buf.viewportY + y)?.translateToString(true) ?? '')
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop()
  return rows
}

function lastLineOf(rows: string[]): string {
  for (let i = rows.length - 1; i >= 0; i--) {
    const l = rows[i].replace(/\s+/g, ' ').trim()
    // Skip idle shell prompts ("user@host dir %") and chrome; keep lines with real words.
    if (/[A-Za-z]{3,}/.test(l) && !/[%$#>❯]$/.test(l)) return l.length > 140 ? l.slice(0, 140) + '…' : l
  }
  return ''
}

function scheduleScreenRefresh(id: string): void {
  if (refreshTimers.has(id)) return
  refreshTimers.set(
    id,
    setTimeout(() => {
      refreshTimers.delete(id)
      const term = screens.get(id)
      if (!term || !agents.some((a) => a.id === id)) return
      const screen = readScreen(term)
      update(id, { screen, lastLine: lastLineOf(screen) })
      emit()
    }, SCREEN_REFRESH_MS)
  )
}

// One global subscription for all agent output.
let wired = false
function wire(): void {
  if (wired) return
  wired = true
  window.api.terminal.onData((id, data) => {
    const agent = agents.find((a) => a.id === id)
    if (!agent) return
    screens.get(id)?.write(data, () => scheduleScreenRefresh(id))
    const now = Date.now()
    // Hooked agents redraw their screen constantly; only hooks change their status.
    if (agent.hook) {
      update(id, { lastOutputAt: now })
      return
    }
    const unseen = agent.unseen || (focusedId !== id && agent.settled)
    if (now - agent.lastOutputAt > 250 || unseen !== agent.unseen) {
      update(id, { lastOutputAt: now, unseen })
      emit()
    } else {
      update(id, { lastOutputAt: now })
    }
  })
  window.api.agents.onHook((e) => {
    const agent = agents.find((a) => a.id === e.agentId)
    if (!agent) return
    const away = focusedId !== agent.id
    switch (e.event) {
      case 'SessionStart':
        update(agent.id, { hook: 'ready', unseen: false, sessionId: e.sessionId ?? agent.sessionId })
        if (e.sessionId && e.sessionId !== agent.sessionId) persist()
        break
      case 'UserPromptSubmit':
      case 'PreToolUse':
      case 'PostToolUse':
        update(agent.id, { hook: 'working' })
        break
      case 'PermissionRequest':
        update(agent.id, { hook: 'needs-you', unseen: agent.unseen || away })
        break
      case 'Notification':
        // "Waiting for your input" repeats after a turn ends; Stop already covered it.
        if (e.notificationType === 'idle_prompt' || /waiting for your input/i.test(e.message ?? '')) return
        update(agent.id, { hook: 'needs-you', unseen: agent.unseen || away })
        break
      case 'Stop':
        update(agent.id, { hook: 'done', unseen: agent.unseen || away })
        break
      case 'StopFailure':
        update(agent.id, { hook: 'error', unseen: agent.unseen || away })
        break
      case 'SessionEnd':
        // The CLI quit; the shell is still there, so go back to inferred status.
        update(agent.id, { hook: null, unseen: false })
        break
      default:
        return
    }
    emit()
  })
  window.api.terminal.onExit((id) => {
    if (!agents.some((a) => a.id === id)) return
    update(id, { exited: true })
    emit()
    persist()
  })
  // Re-evaluate time-based status (working -> idle/unread) once a second.
  setInterval(() => {
    if (!agents.length) return
    const now = Date.now()
    for (const a of agents) {
      if (!a.settled && a.lastOutputAt >= a.startedAt && now - a.startedAt > STARTUP_GRACE_MS && now - a.lastOutputAt > WORKING_WINDOW_MS) update(a.id, { settled: true })
    }
    emit()
  }, 1000)
}

function disposeScreen(id: string): void {
  screens.get(id)?.dispose()
  screens.delete(id)
  const t = refreshTimers.get(id)
  if (t) clearTimeout(t)
  refreshTimers.delete(id)
}

const KIND_LABEL: Record<AgentKind, string> = { claude: 'Claude', codex: 'Codex', shell: 'Shell' }

/** Brings a saved agent back: a fresh shell in the project, with Claude resuming its conversation. */
function restore(rec: SavedAgent): void {
  screens.set(rec.id, new HeadlessTerminal({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS, scrollback: 200, allowProposedApi: true }))
  agents = [
    ...agents,
    { id: rec.id, kind: rec.kind, name: rec.name, systemId: rec.systemId, createdAt: rec.createdAt, startedAt: Date.now(), settled: false, lastOutputAt: 0, unseen: false, exited: false, screen: [], lastLine: '', hook: null, sessionId: rec.sessionId }
  ]
  if (rec.kind === 'claude') window.api.terminal.spawn(rec.id, { kind: 'claude', resume: rec.sessionId ?? undefined })
  else if (rec.kind === 'codex') window.api.terminal.spawn(rec.id, { kind: 'codex' })
  else window.api.terminal.spawn(rec.id)
  window.api.terminal.resize(rec.id, DEFAULT_COLS, DEFAULT_ROWS)
}

export const agentStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l)
    return () => listeners.delete(l)
  },
  getSnapshot() {
    return snapshot
  },

  /** Clears agents when a different project opens (main already killed its PTYs). */
  resetFor(project: string): void {
    wire()
    if (projectKey === project) return
    projectKey = project
    loadedFor = null
    for (const id of [...screens.keys()]) disposeScreen(id)
    agents = []
    closed = []
    focusedId = null
    emit()
    // Bring back what was open last time (after a quit or a crash).
    window.api.agents.load().then((saved) => {
      if (projectKey !== project) return
      loadedFor = project
      if (saved) {
        closed = saved.closed
        for (const rec of saved.open) {
          if (agents.some((a) => a.id === rec.id)) continue
          if (!rec.exited) restore(rec)
          else if (rec.kind !== 'shell' && rec.sessionId) closed = [{ ...rec, exited: undefined, closedAt: Date.now() }, ...closed.filter((c) => c.id !== rec.id)].slice(0, MAX_CLOSED)
        }
      }
      emit()
      persist()
    })
  },

  /** Forgets the loaded project (window went back to home). Saved agents stay on disk. */
  detach(): void {
    projectKey = null
    loadedFor = null
    for (const id of [...screens.keys()]) disposeScreen(id)
    agents = []
    closed = []
    focusedId = null
    emit()
  },

  create(kind: AgentKind, opts: { systemId?: string | null; systemLabel?: string; prompt?: string } = {}): string {
    wire()
    const id = `agent-${Date.now().toString(36)}-${++counter}`
    const sameKind = agents.filter((a) => a.kind === kind).length + 1
    const name = opts.systemLabel ? `${opts.systemLabel} · ${KIND_LABEL[kind]}` : `${KIND_LABEL[kind]} ${sameKind}`
    const now = Date.now()
    screens.set(id, new HeadlessTerminal({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS, scrollback: 200, allowProposedApi: true }))
    agents = [
      ...agents,
      { id, kind, name, systemId: opts.systemId ?? null, createdAt: now, startedAt: now, settled: false, lastOutputAt: 0, unseen: false, exited: false, screen: [], lastLine: '', hook: null, sessionId: null }
    ]
    emit()

    // Main starts the agent CLI in the new shell (with Origin's status hooks for Claude).
    window.api.terminal.spawn(id, kind === 'shell' ? undefined : { kind, prompt: opts.prompt })
    window.api.terminal.resize(id, DEFAULT_COLS, DEFAULT_ROWS)
    persist()
    return id
  },

  /** Keeps the in-memory screen the same size as the real terminal. */
  setSize(id: string, cols: number, rows: number): void {
    const term = screens.get(id)
    if (term && (term.cols !== cols || term.rows !== rows)) {
      term.resize(cols, rows)
      scheduleScreenRefresh(id)
    }
  },

  /** Stops an agent. Agents with a conversation go to the reopen list. */
  remove(id: string): void {
    const agent = agents.find((a) => a.id === id)
    window.api.terminal.kill(id)
    disposeScreen(id)
    agents = agents.filter((a) => a.id !== id)
    if (agent && agent.kind !== 'shell' && agent.sessionId) {
      closed = [{ ...toRecord(agent), exited: undefined, closedAt: Date.now() }, ...closed.filter((c) => c.id !== id)].slice(0, MAX_CLOSED)
    }
    if (focusedId === id) focusedId = null
    emit()
    persist()
  },

  /** Reopens a stopped agent, resuming its conversation. Returns its id. */
  reopen(id: string): string | null {
    const rec = closed.find((c) => c.id === id)
    if (!rec) return null
    closed = closed.filter((c) => c.id !== id)
    if (!agents.some((a) => a.id === id)) restore({ ...rec, closedAt: undefined })
    emit()
    persist()
    return id
  },

  focus(id: string | null): void {
    focusedId = id
    if (id) {
      update(id, { unseen: false })
      window.api.terminal.focus(id)
    }
    emit()
  },

  rename(id: string, name: string): void {
    update(id, { name })
    emit()
    persist()
  }
}

export function useAgents() {
  return useSyncExternalStore(agentStore.subscribe, agentStore.getSnapshot)
}
