// What an agent is doing, as data the agent map can draw: the tickets it works
// on, the systems it touches, the agents it works with or overlaps, what it
// found along the way, and its recent steps.
//
// Preview: everything here is sample data shaped like the real thing. Real
// activity comes from agent hooks and the board in later work; the types stay.

import { createContext } from 'react'
import type { Agent } from './agentStore'

export type TicketStatus = 'todo' | 'in-progress' | 'in-review' | 'done'

export interface ActivityTicket {
  key: string
  title: string
  status: TicketStatus
}

export interface ActivitySystem {
  id: string
  label: string
  color: string
}

export interface ActivityPeer {
  /** Set when the peer is a real agent on the canvas, so it can be opened. */
  agentId: string | null
  name: string
  relation: 'works-with' | 'overlaps'
  /** Why they are linked: what they share or hand over. */
  detail: string
}

export interface ActivityStep {
  kind: 'read' | 'edit' | 'run' | 'found' | 'ask' | 'pass' | 'fail'
  text: string
  when: string
}

export interface AgentActivity {
  sample: boolean
  now: string
  tickets: ActivityTicket[]
  systems: ActivitySystem[]
  peers: ActivityPeer[]
  found: ActivityTicket[]
  steps: ActivityStep[]
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  todo: 'Todo',
  'in-progress': 'In progress',
  'in-review': 'In review',
  done: 'Done'
}

interface Scenario {
  ticket: string
  found: string
  now: string
  systems: string[]
  together: string
  overlap: string
  steps: ActivityStep[]
}

const SCENARIOS: Scenario[] = [
  {
    ticket: 'Fix wrong total at checkout',
    found: 'Payment test fails at random',
    now: 'Running the checkout tests',
    systems: ['Payments', 'Checkout'],
    together: 'Reviews its changes',
    overlap: 'Both editing cart.ts',
    steps: [
      { kind: 'read', text: 'Read the checkout flow (6 files)', when: '9m' },
      { kind: 'found', text: 'Found the bug: tax added twice', when: '7m' },
      { kind: 'edit', text: 'Edited cart.ts and totals.ts', when: '5m' },
      { kind: 'fail', text: 'Tests: 2 failing', when: '3m' },
      { kind: 'edit', text: 'Fixed rounding in totals.ts', when: '2m' },
      { kind: 'run', text: 'Running the checkout tests', when: 'now' }
    ]
  },
  {
    ticket: 'Add password reset by email',
    found: 'Login has no rate limit',
    now: 'Waiting for you to pick an email provider',
    systems: ['Auth', 'Email'],
    together: 'Builds the reset page',
    overlap: 'Both changing the users table',
    steps: [
      { kind: 'read', text: 'Read the auth module (9 files)', when: '14m' },
      { kind: 'edit', text: 'Added a reset token to users', when: '10m' },
      { kind: 'edit', text: 'Added the /reset endpoint', when: '6m' },
      { kind: 'found', text: 'Noticed login has no rate limit', when: '4m' },
      { kind: 'pass', text: 'Tests: 18 passing', when: '2m' },
      { kind: 'ask', text: 'Asked which email provider to use', when: 'now' }
    ]
  },
  {
    ticket: 'Refresh the landing page hero',
    found: 'Pricing page shows old prices',
    now: 'Checking the page on mobile',
    systems: ['Website', 'Design system'],
    together: 'Writes the new headline',
    overlap: 'Both editing Button styles',
    steps: [
      { kind: 'read', text: 'Read the landing page and brand notes', when: '12m' },
      { kind: 'edit', text: 'Rebuilt the hero section', when: '8m' },
      { kind: 'edit', text: 'Swapped in the new screenshot', when: '6m' },
      { kind: 'found', text: 'Saw outdated prices on /pricing', when: '4m' },
      { kind: 'run', text: 'Checking the page on mobile', when: 'now' }
    ]
  }
]

const FALLBACK_COLORS = ['#7aa2f7', '#bb9af7', '#73daca', '#e0af68']

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** A short ticket prefix from the project folder name, like DEM for demo-project. */
export function ticketPrefix(projectPath: string): string {
  const name = projectPath.split(/[\\/]/).filter(Boolean).pop() ?? 'task'
  const letters = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()
  return letters.length >= 2 ? letters : 'TSK'
}

/**
 * Sample activity for an agent. Uses the project's real systems and the real
 * agents on the canvas where it can, so the preview reads like this project.
 */
export function sampleActivity(
  agent: Agent,
  ctx: { projectPath: string; systems: ActivitySystem[]; agents: Agent[] }
): AgentActivity {
  const index = Math.max(0, ctx.agents.findIndex((a) => a.id === agent.id))
  const scenario = SCENARIOS[index % SCENARIOS.length]
  const seed = hash(agent.id)
  const prefix = ticketPrefix(ctx.projectPath)
  const number = 12 + index * 7

  // Systems: the agent's own system first, then others from the map.
  let systems: ActivitySystem[]
  if (ctx.systems.length) {
    const own = ctx.systems.find((s) => s.id === agent.systemId)
    const rest = ctx.systems.filter((s) => s !== own)
    const extra = rest.length ? [rest[(seed + index) % rest.length]] : []
    systems = [...(own ? [own] : []), ...extra]
    if (systems.length < 2 && rest.length > 1) systems.push(rest[(seed + index + 1) % rest.length])
    systems = systems.slice(0, 2)
  } else {
    systems = scenario.systems.map((label, i) => ({ id: `sample-${label}`, label, color: FALLBACK_COLORS[(index + i) % FALLBACK_COLORS.length] }))
  }

  // Peers: real agents when there are any, otherwise sample ones.
  const others = ctx.agents.filter((a) => a.id !== agent.id)
  const peers: ActivityPeer[] = [
    others[0]
      ? { agentId: others[0].id, name: others[0].name, relation: 'works-with', detail: scenario.together }
      : { agentId: null, name: 'Reviewer · Claude', relation: 'works-with', detail: scenario.together },
    others[1]
      ? { agentId: others[1].id, name: others[1].name, relation: 'overlaps', detail: scenario.overlap }
      : { agentId: null, name: 'Billing · Codex', relation: 'overlaps', detail: scenario.overlap }
  ]

  return {
    sample: true,
    now: scenario.now,
    tickets: [{ key: `${prefix}-${number}`, title: scenario.ticket, status: 'in-progress' }],
    systems,
    peers,
    found: [{ key: `${prefix}-${number + 3}`, title: scenario.found, status: 'todo' }],
    steps: scenario.steps
  }
}

/** Activity for every agent on the canvas, keyed by agent id. */
export const ActivityContext = createContext<Map<string, AgentActivity>>(new Map())
