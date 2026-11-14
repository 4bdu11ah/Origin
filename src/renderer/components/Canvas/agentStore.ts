// Agents on the canvas: one PTY each, plus enough derived state to draw a card
// without mounting a real terminal. Each agent has an in-memory (headless)
// terminal fed the same output, so the card can show the agent's actual
// screen, including full-screen UIs like Claude Code that redraw in place.
// Module-level store read through useSyncExternalStore; reset per project.
//
// Spike note: status is inferred from output activity. Real status (needs you,
// error) comes from agent hooks in a later ticket.

import { useSyncExternalStore } from 'react'
import { Terminal as HeadlessTerminal } from '@xterm/headless'

export type AgentKind = 'claude' | 'codex' | 'shell'
export type AgentStatus = 'working' | 'unread' | 'idle' | 'exited'

export interface Agent {
  id: string
  kind: AgentKind
  name: string
  systemId: string | null
  createdAt: number
  lastOutputAt: number
  unseen: boolean
  exited: boolean
  /** Visible screen rows, as plain text. */
  screen: string[]
  /** Last meaningful line on screen, for compact places like the palette. */
  lastLine: string
}

const WORKING_WINDOW_MS = 1500
const STARTUP_GRACE_MS = 2500
const SCREEN_REFRESH_MS = 200
export const DEFAULT_COLS = 96
export const DEFAULT_ROWS = 26

let agents: Agent[] = []
let projectKey: string | null = null
let focusedId: string | null = null
let counter = 0
const screens = new Map<string, HeadlessTerminal>()
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>()
const listeners = new Set<() => void>()
let snapshot: { agents: Agent[]; focusedId: string | null; tick: number } = { agents, focusedId, tick: 0 }

function emit(): void {
  snapshot = { agents, focusedId, tick: snapshot.tick + 1 }
  listeners.forEach((l) => l())
}

function update(id: string, patch: Partial<Agent>): void {
  agents = agents.map((a) => (a.id === id ? { ...a, ...patch } : a))
}

export function statusOf(a: Agent, now = Date.now()): AgentStatus {
  if (a.exited) return 'exited'
  if (now - a.lastOutputAt < WORKING_WINDOW_MS && now - a.createdAt > 800) return 'working'
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
    const unseen = agent.unseen || (focusedId !== id && now - agent.createdAt > STARTUP_GRACE_MS)
    if (now - agent.lastOutputAt > 250 || unseen !== agent.unseen) {
      update(id, { lastOutputAt: now, unseen })
      emit()
    } else {
      update(id, { lastOutputAt: now })
    }
  })
  window.api.terminal.onExit((id) => {
    if (!agents.some((a) => a.id === id)) return
    update(id, { exited: true })
    emit()
  })
  // Re-evaluate time-based status (working -> idle/unread) once a second.
  setInterval(() => {
    if (agents.length) emit()
  }, 1000)
}

function disposeScreen(id: string): void {
  screens.get(id)?.dispose()
  screens.delete(id)
  const t = refreshTimers.get(id)
  if (t) clearTimeout(t)
  refreshTimers.delete(id)
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

const KIND_LABEL: Record<AgentKind, string> = { claude: 'Claude', codex: 'Codex', shell: 'Shell' }

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
    for (const id of [...screens.keys()]) disposeScreen(id)
    agents = []
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
      { id, kind, name, systemId: opts.systemId ?? null, createdAt: now, lastOutputAt: 0, unseen: false, exited: false, screen: [], lastLine: '' }
    ]
    emit()

    window.api.terminal.spawn(id)
    window.api.terminal.resize(id, DEFAULT_COLS, DEFAULT_ROWS)
    // The login shell buffers typeahead, so the command runs once it's ready.
    if (kind === 'claude') {
      window.api.terminal.write(id, opts.prompt ? `claude ${shellQuote(opts.prompt)}\r` : 'claude\r')
    } else if (kind === 'codex') {
      window.api.terminal.write(id, opts.prompt ? `codex ${shellQuote(opts.prompt)}\r` : 'codex\r')
    }
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

  remove(id: string): void {
    window.api.terminal.kill(id)
    disposeScreen(id)
    agents = agents.filter((a) => a.id !== id)
    if (focusedId === id) focusedId = null
    emit()
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
  }
}

export function useAgents() {
  return useSyncExternalStore(agentStore.subscribe, agentStore.getSnapshot)
}
