import type { AgentStatus } from './agentStore'
import type { Persona } from './personas'

export type AvatarRing = AgentStatus | 'conflict' | null

/** An agent's face: an employee's mascot, or the shared contractor picture. Ring shows status. */
export function Avatar({ persona, size, ring = null, title }: { persona: Persona; size: number; ring?: AvatarRing; title?: string }) {
  const cls = `avatar${ring ? ` ring-${ring}` : ''}`
  if (persona.type === 'employee') {
    return (
      <span
        className={`${cls} avatar-employee`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.56), ['--avatar' as string]: persona.color }}
        title={title}
        role="img"
        aria-label={persona.nickname}
      >
        {persona.icon}
      </span>
    )
  }
  return (
    <span className={`${cls} avatar-contractor`} style={{ width: size, height: size }} title={title} role="img" aria-label="Contractor">
      <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden>
        {/* default profile silhouette */}
        <circle cx="16" cy="15.5" r="5.6" fill="#9a9aa6" />
        <path d="M5.5 31c1.2-6.4 5.4-9.6 10.5-9.6S25.3 24.6 26.5 31z" fill="#9a9aa6" />
        {/* hard hat */}
        <path d="M9.6 13.2c0-4.3 2.9-7.3 6.4-7.3s6.4 3 6.4 7.3z" fill="#f2c14e" />
        <rect x="8" y="12.4" width="16" height="2.2" rx="1.1" fill="#d9a531" />
        <rect x="15.2" y="5.9" width="1.6" height="4.2" rx="0.8" fill="#d9a531" />
      </svg>
    </span>
  )
}
