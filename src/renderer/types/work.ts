// The record Origin keeps for a project: tickets, things agents found, releases,
// the team, connections and the chief of staff's conversation. Screens are
// built on these shapes; sample data fills them until each is wired up.

import type { Employee, Persona } from '../components/Canvas/personas'

export type TicketStatus = 'todo' | 'in-progress' | 'in-review' | 'done'

export interface Person {
  name: string
  persona: Persona
  /** Set when this person is an agent on the canvas right now. */
  agentId?: string | null
}

export interface DoneCheck {
  text: string
  ok: boolean
}

export interface TicketEvent {
  who: Person
  /** Six words at most, business terms. */
  text: string
  when: string
}

export interface Ticket {
  key: string
  title: string
  status: TicketStatus
  assignee: Person | null
  system: { label: string; color: string } | null
  /** About three short lines: what and why. */
  summary: string
  /** What "done" means; done only counts when every check passes. */
  doneWhen: DoneCheck[]
  history: TicketEvent[]
  /** Release the ticket shipped in, if any. */
  release?: string
  updated: string
}

export type InboxKind = 'bug' | 'idea' | 'risk' | 'question'

export interface InboxItem {
  id: string
  kind: InboxKind
  /** Six words at most. */
  title: string
  summary: string
  foundBy: Person
  /** The ticket it was found while working on. */
  foundWhile: string
  system: { label: string; color: string } | null
  when: string
}

export interface Release {
  id: string
  name: string
  commit: string
  when: string
  /** Business-level lines on what changed for users. */
  highlights: string[]
  tickets: string[]
  checks: { passed: number; total: number }
  status: 'live' | 'rolled-back' | 'superseded'
}

export interface TeamMember {
  employee: Employee
  status: 'working' | 'needs-you' | 'idle'
  /** Ticket key they're on, if any. */
  ticket: string | null
  contractors: { task: string; status: 'working' | 'done' }[]
  /** Small, dated notes the employee keeps between sessions. */
  memory: { date: string; note: string }[]
  connections: string[]
}

export interface LibraryEmployee {
  icon: string
  color: string
  name: string
  role: string
  /** One line on what they're good at. */
  pitch: string
  author: string
  installs: string
}

export type ConnectionStatus = 'ok' | 'expiring' | 'expired' | 'missing'

export interface Connection {
  id: string
  name: string
  kind: 'login' | 'mcp' | 'key'
  status: ConnectionStatus
  /** Short state, e.g. "Logged in as …" or "Expired 2 days ago". */
  detail: string
  usedBy: string[]
}

export type ChiefCard = { type: 'ticket'; key: string } | { type: 'person'; name: string } | { type: 'release'; id: string }

export interface ChiefMessage {
  from: 'chief' | 'you'
  text: string
  cards?: ChiefCard[]
  when: string
}
