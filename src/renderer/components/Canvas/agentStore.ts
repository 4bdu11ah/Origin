// Agents on the canvas: one PTY each, plus enough derived state (status, last
// line) to draw a card without mounting a terminal. Module-level store read
// through useSyncExternalStore; reset whenever the open project changes.
//
// Spike note: status is inferred from output activity. Real status (needs you,
// error) comes from agent hooks in a later ticket.

import { useSyncExternalStore } from 'react'

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
  lastLine: string
}

const WORKING_WINDOW_MS = 1500
const STARTUP_GRACE_MS = 2500
const TAIL_MAX = 4000

// CSI, OSC, charset and keypad escapes, plus carriage returns.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?<>=!]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][0-9A-Za-z]|\x1b[=>78DEHM]|\r/g

let agents: Agent[] = []
let projectKey: string | null = null
let focusedId: string | null = null
let counter = 0
const tails = new Map<string, string>()
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

function lastLineOf(text: string): string {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].replace(/\s+/g, ' ').trim()
    if (l && /[A-Za-z0-9]/.test(l)) return l.length > 140 ? l.slice(0, 140) + '…' : l
  }
  return ''
}

// One global subscription for all agent output.
let wired = false
function wire(): void {
  if (wired) return
  wired = true
  window.api.terminal.onData((id, data) => {
    const agent = agents.find((a) => a.id === id)
    if (!agent) return
    const tail = ((tails.get(id) ?? '') + data.replace(ANSI, '')).slice(-TAIL_MAX)
    tails.set(id, tail)
    const now = Date.now()
    update(id, {
      lastOutputAt: now,
      lastLine: lastLineOf(tail),
      unseen: agent.unseen || (focusedId !== id && now - agent.createdAt > STARTUP_GRACE_MS)
    })
    emit()
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
    agents = []
    focusedId = null
    tails.clear()
    emit()
  },

  create(kind: AgentKind, opts: { systemId?: string | null; systemLabel?: string; prompt?: string } = {}): string {
    wire()
    const id = `agent-${Date.now().toString(36)}-${++counter}`
    const sameKind = agents.filter((a) => a.kind === kind).length + 1
    const name = opts.systemLabel ? `${opts.systemLabel} · ${KIND_LABEL[kind]}` : `${KIND_LABEL[kind]} ${sameKind}`
    const now = Date.now()
    agents = [
      ...agents,
      { id, kind, name, systemId: opts.systemId ?? null, createdAt: now, lastOutputAt: 0, unseen: false, exited: false, lastLine: '' }
    ]
    emit()

    window.api.terminal.spawn(id)
    // The login shell buffers typeahead, so the command runs once it's ready.
    if (kind === 'claude') {
      window.api.terminal.write(id, opts.prompt ? `claude ${shellQuote(opts.prompt)}\r` : 'claude\r')
    } else if (kind === 'codex') {
      window.api.terminal.write(id, opts.prompt ? `codex ${shellQuote(opts.prompt)}\r` : 'codex\r')
    }
    return id
  },

  remove(id: string): void {
    window.api.terminal.kill(id)
    agents = agents.filter((a) => a.id !== id)
    tails.delete(id)
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
