import { useState } from 'react'
import { Avatar } from '../Canvas/Avatar'
import { CONTRACTOR } from '../Canvas/personas'
import { CHIEF } from '../../sample/workspace'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { TeamMember } from '../../types/work'

// The team as an org chart: you, the chief of staff, permanent employees and
// the contractors they hire for a single job. The library is where new
// employees come from: install an open-source one, or build your own.

const STATUS: Record<TeamMember['status'], string> = { working: 'Working', 'needs-you': 'Needs you', idle: 'Free' }
const RING = { working: 'working', 'needs-you': 'needs-you', idle: null } as const

function Member({ m, selected, onSelect }: { m: TeamMember; selected: boolean; onSelect: () => void }) {
  const { openTicket } = useWorkspace()
  return (
    <div className="org-branch">
      <button className={`org-card status-${m.status}${selected ? ' is-selected' : ''}`} onClick={onSelect}>
        <Avatar persona={m.employee} size={52} ring={RING[m.status]} />
        <span className="org-name">{m.employee.nickname}</span>
        <span className="org-role">{m.employee.role}</span>
        <span className={`org-status status-${m.status}`}>{STATUS[m.status]}</span>
        {m.ticket && (
          <span
            className="chip-link"
            role="link"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              openTicket(m.ticket)
            }}
          >
            {m.ticket}
          </span>
        )}
      </button>
      {m.contractors.length > 0 && (
        <ul className="org-contractors">
          {m.contractors.map((c) => (
            <li key={c.task} className={`contractor status-${c.status}`} title={`Contractor · ${c.task}`}>
              <Avatar persona={CONTRACTOR} size={26} ring={c.status === 'working' ? 'working' : null} />
              <span>{c.task}</span>
              {c.status === 'done' && <span className="done-tick">✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MemberDetail({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  return (
    <aside className="side-detail">
      <div className="side-detail-bar">
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="member-hero">
        <Avatar persona={m.employee} size={72} ring={RING[m.status]} />
        <h2>{m.employee.nickname}</h2>
        <span className="muted">{m.employee.role}</span>
      </div>
      <section>
        <h3 className="section-label">Remembers</h3>
        <ul className="memory">
          {m.memory.map((n) => (
            <li key={n.note}>
              <span className="memory-date">{n.date}</span>
              {n.note}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="section-label">Uses</h3>
        <div className="chip-row">
          {m.connections.map((c) => (
            <span key={c} className="plain-chip">
              {c}
            </span>
          ))}
        </div>
      </section>
      <section>
        <h3 className="section-label">Contractors</h3>
        {m.contractors.length ? (
          <ul className="org-contractors is-list">
            {m.contractors.map((c) => (
              <li key={c.task} className={`contractor status-${c.status}`}>
                <Avatar persona={CONTRACTOR} size={26} ring={c.status === 'working' ? 'working' : null} />
                <span>{c.task}</span>
                {c.status === 'done' && <span className="done-tick">✓</span>}
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted">None right now</span>
        )}
      </section>
    </aside>
  )
}

function Library() {
  const { library } = useWorkspace()
  const [hired, setHired] = useState<Set<string>>(new Set())
  return (
    <div className="library-grid">
      <div className="library-card is-build">
        <span className="build-plus">+</span>
        <strong>Build your own</strong>
        <span className="muted">Describe a role and how they work</span>
        <input className="build-input" placeholder="e.g. Writes our weekly changelog" />
      </div>
      {library.map((e) => {
        const isHired = hired.has(e.name)
        return (
          <div key={e.name} className="library-card">
            <Avatar persona={{ type: 'employee', nickname: e.name, role: e.role, icon: e.icon, color: e.color }} size={56} />
            <strong>{e.name}</strong>
            <span className="library-role">{e.role}</span>
            <span className="library-pitch">{e.pitch}</span>
            <span className="library-meta">
              <span className={`author author-${e.author}`}>{e.author === 'origin' ? 'Origin' : 'Community'}</span>
              <span className="muted">{e.installs} teams</span>
            </span>
            <button className={isHired ? 'btn-ghost' : 'btn-primary'} onClick={() => setHired((s) => new Set(s).add(e.name))} disabled={isHired}>
              {isHired ? 'Hired ✓' : 'Hire'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function TeamScreen() {
  const { team } = useWorkspace()
  const [tab, setTab] = useState<'team' | 'library'>('team')
  const [selected, setSelected] = useState<string | null>(null)
  const member = team.find((m) => m.employee.nickname === selected) ?? null
  const contractors = team.reduce((n, m) => n + m.contractors.filter((c) => c.status === 'working').length, 0)

  return (
    <div className="screen">
      <ScreenHeader title="Team" sub={`${team.length} employees · ${contractors} contractors working`}>
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'is-active' : ''} onClick={() => setTab('team')}>
            Your team
          </button>
          <button role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'is-active' : ''} onClick={() => setTab('library')}>
            Library
          </button>
        </div>
      </ScreenHeader>
      <div className="screen-split">
        <div className="screen-scroll">
          {tab === 'team' ? (
            <div className="org">
              <div className="org-top">
                <div className="org-lead">
                  <span className="face-you" style={{ width: 44, height: 44, fontSize: 15 }}>
                    You
                  </span>
                  <span className="org-name">You</span>
                  <span className="org-role">Founder</span>
                </div>
                <span className="org-line-v" />
                <div className="org-lead">
                  <Avatar persona={CHIEF} size={52} />
                  <span className="org-name">{CHIEF.nickname}</span>
                  <span className="org-role">{CHIEF.role}</span>
                </div>
                <span className="org-line-v" />
              </div>
              <div className="org-row">
                {team.map((m) => (
                  <Member key={m.employee.nickname} m={m} selected={selected === m.employee.nickname} onSelect={() => setSelected(selected === m.employee.nickname ? null : m.employee.nickname)} />
                ))}
              </div>
            </div>
          ) : (
            <Library />
          )}
        </div>
        {tab === 'team' && member && <MemberDetail m={member} onClose={() => setSelected(null)} />}
      </div>
    </div>
  )
}
