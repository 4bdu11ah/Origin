// Who an agent is. Employees are permanent team members with a mascot icon,
// a nickname and a role. Contractors are disposable and share one default
// picture. Preview: personas are handed out from a sample roster until the
// employee library exists; each agent keeps its persona for the session.

export type Persona =
  | { type: 'employee'; nickname: string; role: string; icon: string; color: string }
  | { type: 'contractor' }

const ROSTER: Extract<Persona, { type: 'employee' }>[] = [
  { type: 'employee', nickname: 'Penny', role: 'Payments engineer', icon: '🦊', color: '#f0a05a' },
  { type: 'employee', nickname: 'Otto', role: 'Design lead', icon: '🦉', color: '#8fb0f5' },
  { type: 'employee', nickname: 'Ivy', role: 'Backend engineer', icon: '🐙', color: '#b490ee' },
  { type: 'employee', nickname: 'Bruno', role: 'QA lead', icon: '🐻', color: '#7cc99a' },
  { type: 'employee', nickname: 'Bea', role: 'Growth marketer', icon: '🐝', color: '#eccb5a' }
]

export const CONTRACTOR: Persona = { type: 'contractor' }

/** Sample people for peers that are not on the canvas yet. */
export const SAMPLE_REVIEWER = ROSTER[3]

const assigned = new Map<string, Persona>()
let employees = 0
let total = 0

/** Every other new agent is an employee, the rest are contractors. Stable per agent. */
export function personaFor(agentId: string): Persona {
  let p = assigned.get(agentId)
  if (!p) {
    p = total++ % 2 === 0 ? ROSTER[employees++ % ROSTER.length] : CONTRACTOR
    assigned.set(agentId, p)
  }
  return p
}

export function displayName(persona: Persona, fallback: string): string {
  return persona.type === 'employee' ? persona.nickname : fallback
}

export function roleOf(persona: Persona): string {
  return persona.type === 'employee' ? persona.role : 'Contractor'
}
