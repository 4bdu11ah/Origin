// What an agent is doing, as data the agent map can draw: the tickets it works
// on, the systems it touches, the agents it works with or overlaps, what it
// found along the way, and its recent steps.
//
// Preview: everything here is sample data shaped like the real thing. Real
// activity comes from agent hooks and the board in later work; the types stay.

import { createContext } from 'react'
import type { Agent } from './agentStore'
import { CONTRACTOR, displayName, personaFor, SAMPLE_REVIEWER, type Persona } from './personas'

import type { TicketStatus } from '../../types/work'
export type { TicketStatus }

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
  persona: Persona
  relation: 'works-with' | 'overlaps'
  /** Why they are linked: what they share or hand over. */
  detail: string
}

export interface ActivityStep {
  kind: 'read' | 'edit' | 'run' | 'found' | 'ask' | 'pass' | 'fail'
  /** Six words at most, in business terms. Never file names or code. */
  text: string
  /** About three short lines on what happened and why it matters. */
  detail: string
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
    now: 'Re-checking the checkout tests',
    systems: ['Payments', 'Checkout'],
    together: 'Reviews its changes',
    overlap: 'Both changing how totals add up',
    steps: [
      {
        kind: 'read',
        text: 'Learned how checkout totals work',
        detail: 'Followed an order from cart to payment. Totals are built in two places: once for the cart and once again at payment.',
        when: '9m'
      },
      {
        kind: 'found',
        text: 'Found tax charged twice',
        detail: 'Tax is added to the cart total and again at payment, so customers pay it twice. Only orders with tax are affected.',
        when: '7m'
      },
      {
        kind: 'edit',
        text: 'Tax now added only once',
        detail: 'Tax is now worked out once, at payment. The cart shows the same number the customer is charged.',
        when: '5m'
      },
      {
        kind: 'fail',
        text: 'Two checkout tests failing',
        detail: 'Both failures are orders with a discount code. Totals are off by one cent, so it looks like rounding.',
        when: '3m'
      },
      {
        kind: 'edit',
        text: 'Fixed rounding on discounted orders',
        detail: 'Discounts are now rounded after tax, matching how the payment provider rounds. Totals match to the cent.',
        when: '2m'
      },
      {
        kind: 'run',
        text: 'Re-checking the checkout tests',
        detail: 'Running every checkout test again to confirm both fixes hold. If they pass, the ticket moves to review.',
        when: 'now'
      }
    ]
  },
  {
    ticket: 'Add password reset by email',
    found: 'Login has no rate limit',
    now: 'Needs you: pick email provider',
    systems: ['Auth', 'Email'],
    together: 'Builds the reset page',
    overlap: 'Both changing user accounts',
    steps: [
      {
        kind: 'read',
        text: 'Learned how sign-in works',
        detail: 'Users sign in with email and password. There is no way to recover an account today, so locked-out users email support.',
        when: '14m'
      },
      {
        kind: 'edit',
        text: 'Accounts can hold reset links',
        detail: 'Each account can now store a one-time reset link. Links expire after an hour and work only once.',
        when: '10m'
      },
      {
        kind: 'edit',
        text: 'Built the password reset flow',
        detail: 'Users ask for a reset, get a link, and pick a new password. Old sessions are signed out afterwards.',
        when: '6m'
      },
      {
        kind: 'found',
        text: 'Login has no attempt limit',
        detail: 'Anyone can guess passwords without limit. Not part of this ticket, so it went to the inbox as a new one.',
        when: '4m'
      },
      {
        kind: 'pass',
        text: 'All sign-in tests pass',
        detail: 'Existing sign-in still works, and the new reset flow passes its own tests. Nothing is sent by email yet.',
        when: '2m'
      },
      {
        kind: 'ask',
        text: 'Needs you: pick email provider',
        detail: 'Reset links need to be emailed and the project has no email service yet. It suggests Resend or Postmark.',
        when: 'now'
      }
    ]
  },
  {
    ticket: 'Refresh the landing page hero',
    found: 'Pricing page shows old prices',
    now: 'Checking the page on mobile',
    systems: ['Website', 'Design system'],
    together: 'Writes the new headline',
    overlap: 'Both restyling the main buttons',
    steps: [
      {
        kind: 'read',
        text: 'Reviewed landing page and brand',
        detail: 'Compared the current page with the brand notes. The hero still uses last year’s message and colours.',
        when: '12m'
      },
      {
        kind: 'edit',
        text: 'Rebuilt the top of page',
        detail: 'New layout with the headline on the left and the product on the right. The sign-up button is above the fold.',
        when: '8m'
      },
      {
        kind: 'edit',
        text: 'Added the new product screenshot',
        detail: 'Swapped the old illustration for a real screenshot of the app, so visitors see what they get.',
        when: '6m'
      },
      {
        kind: 'found',
        text: 'Pricing page shows old prices',
        detail: 'The pricing page still lists last year’s plans. Out of scope here, so it went to the inbox.',
        when: '4m'
      },
      {
        kind: 'run',
        text: 'Checking the page on mobile',
        detail: 'Viewing the new hero at phone and tablet sizes to make sure nothing overlaps or gets cut off.',
        when: 'now'
      }
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
      ? { agentId: others[0].id, name: displayName(personaFor(others[0].id), others[0].name), persona: personaFor(others[0].id), relation: 'works-with', detail: scenario.together }
      : { agentId: null, name: SAMPLE_REVIEWER.nickname, persona: SAMPLE_REVIEWER, relation: 'works-with', detail: scenario.together },
    others[1]
      ? { agentId: others[1].id, name: displayName(personaFor(others[1].id), others[1].name), persona: personaFor(others[1].id), relation: 'overlaps', detail: scenario.overlap }
      : { agentId: null, name: 'Contractor', persona: CONTRACTOR, relation: 'overlaps', detail: scenario.overlap }
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
