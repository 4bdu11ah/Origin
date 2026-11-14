import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../Canvas/Avatar'
import { ROSTER, type Persona } from '../Canvas/personas'
import { CHIEF } from '../../sample/workspace'
import { Face } from '../shared/Face'
import { StatusIcon } from '../shared/StatusIcon'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { Meeting, MeetingLine, MeetingTemplate } from '../../types/work'

// Meetings: talk with your team to plan tickets, sprints and releases. You
// speak (or type); the chief of staff and employees answer; the outcome
// builds itself on the side (sprint picks, draft tickets, decisions) and
// lands on the board when the meeting ends.
//
// Preview: the room plays back a sample sprint-planning conversation.

const ICON: Record<Meeting['kind'], string> = { tickets: '🎯', sprint: '🗓️', release: '🚀', standup: '☕' }

function personaOf(name: string): Persona | null {
  if (name === CHIEF.nickname) return CHIEF
  return ROSTER.find((e) => e.nickname === name) ?? null
}

function Faces({ names, size = 26 }: { names: string[]; size?: number }) {
  return (
    <span className="face-stack">
      {[CHIEF.nickname, ...names].map((n) => {
        const p = personaOf(n)
        return p ? <Avatar key={n} persona={p} size={size} title={n} /> : null
      })}
    </span>
  )
}

function Setup({ template, onStart, onCancel }: { template: MeetingTemplate; onStart: (attendees: string[]) => void; onCancel: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(['Penny', 'Ivy', 'Bea']))
  const toggle = (n: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  return (
    <div className="meet-setup">
      <div className="meet-setup-head">
        <span className="meet-icon is-big">{template.icon}</span>
        <div>
          <h2>{template.title}</h2>
          <span className="muted">{template.blurb}</span>
        </div>
      </div>
      <h3 className="section-label">Who joins</h3>
      <div className="attendee-pick">
        <span className="attendee is-on is-fixed" title="The chief of staff always joins">
          <Avatar persona={CHIEF} size={44} />
          {CHIEF.nickname}
        </span>
        {ROSTER.map((e) => (
          <button key={e.nickname} className={`attendee${picked.has(e.nickname) ? ' is-on' : ''}`} onClick={() => toggle(e.nickname)}>
            <Avatar persona={e} size={44} />
            {e.nickname}
          </button>
        ))}
      </div>
      <div className="meet-setup-actions">
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onStart([...picked])}>
          Start meeting
        </button>
      </div>
    </div>
  )
}

interface Draft {
  title: string
  system?: string
  owner?: string
  state: 'pending' | 'accepted' | 'dropped'
}

function Room({ title, kind, attendees, onEnd }: { title: string; kind: Meeting['kind']; attendees: string[]; onEnd: (m: Meeting, accepted: Draft[]) => void }) {
  const { meetingScript, tickets, openTicket } = useWorkspace()
  const [lines, setLines] = useState<MeetingLine[]>([])
  const [listening, setListening] = useState(true)
  const [draft, setDraft] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [seconds, setSeconds] = useState(0)
  const endRef = useRef<HTMLDivElement>(null)

  // Preview: play the sample conversation, one line at a time.
  useEffect(() => {
    let i = 0
    const t = setInterval(() => {
      if (i >= meetingScript.length) return clearInterval(t)
      const line = meetingScript[i++]
      setLines((l) => [...l, line])
      if (line.draft) setDrafts((d) => [...d, { ...line.draft!, state: 'pending' }])
    }, 1700)
    return () => clearInterval(t)
  }, [meetingScript])

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [lines])

  const speaking = lines[lines.length - 1]?.who
  const sprint = useMemo(() => [...new Set(lines.flatMap((l) => (l.sprint ? [l.sprint] : [])))], [lines])
  const decisions = lines.flatMap((l) => (l.decision ? [l.decision] : []))
  const people = ['You', CHIEF.nickname, ...attendees]

  const say = () => {
    const t = draft.trim()
    if (!t) return
    setLines((l) => [...l, { who: 'You', text: t }])
    setDraft('')
  }

  const end = () =>
    onEnd(
      {
        id: `m-${Date.now()}`,
        kind,
        title,
        when: 'Just now',
        attendees,
        status: 'done',
        length: `${Math.max(1, Math.round(seconds / 60))} min`,
        outcomes: { tickets: drafts.filter((d) => d.state === 'accepted').length, decisions }
      },
      drafts.filter((d) => d.state === 'accepted')
    )

  return (
    <div className="room">
      <div className="room-main">
        <div className="room-bar">
          <span className="rec-dot" />
          <strong>{title}</strong>
          <span className="muted">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </span>
          <button className="btn-end" onClick={end}>
            End meeting
          </button>
        </div>

        <div className="room-people">
          {people.map((n) => {
            const p = personaOf(n)
            return (
              <span key={n} className={`room-person${speaking === n ? ' is-speaking' : ''}`}>
                {p ? <Avatar persona={p} size={56} /> : <Face person={{ name: 'You', persona: { type: 'contractor' } }} size={56} />}
                <span>{n}</span>
              </span>
            )
          })}
        </div>

        <div className="transcript">
          {lines.map((l, i) => {
            const p = personaOf(l.who)
            return (
              <div key={i} className={`line${l.who === 'You' ? ' from-you' : ''}`}>
                {p ? <Avatar persona={p} size={28} /> : <Face person={{ name: 'You', persona: { type: 'contractor' } }} size={28} />}
                <p>
                  <strong>{l.who}</strong> {l.text}
                </p>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        <div className="room-controls">
          <button className={`mic${listening ? ' is-on' : ''}`} onClick={() => setListening((v) => !v)} aria-pressed={listening} title={listening ? 'Mute' : 'Unmute'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <rect x="9" y="3.5" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
              {!listening && <path d="M4 4l16 16" />}
            </svg>
          </button>
          <span className="mic-label">{listening ? 'Listening…' : 'Muted'}</span>
          <form
            className="chat-input room-type"
            onSubmit={(e) => {
              e.preventDefault()
              say()
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Or type…" />
          </form>
        </div>
      </div>

      <aside className="outcomes">
        <h3 className="section-label">This sprint</h3>
        {sprint.length ? (
          <div className="outcome-list">
            {sprint.map((k) => {
              const t = tickets.find((x) => x.key === k)
              return (
                <button key={k} className="ticket-chip outcome-pop" onClick={() => openTicket(k)}>
                  {t && <StatusIcon status={t.status} />}
                  <span className="ticket-key">{k}</span>
                  {t?.title}
                </button>
              )
            })}
          </div>
        ) : (
          <span className="muted">Nothing picked yet</span>
        )}

        <h3 className="section-label">New tickets</h3>
        {drafts.length ? (
          <div className="outcome-list">
            {drafts.map((d, i) => (
              <div key={d.title} className={`draft outcome-pop is-${d.state}`}>
                <span className="draft-title">{d.title}</span>
                {d.owner && personaOf(d.owner) && <Avatar persona={personaOf(d.owner)!} size={22} />}
                {d.state === 'pending' ? (
                  <span className="draft-actions">
                    <button className="draft-yes" title="Keep" onClick={() => setDrafts((list) => list.map((x, j) => (j === i ? { ...x, state: 'accepted' } : x)))}>
                      ✓
                    </button>
                    <button className="draft-no" title="Drop" onClick={() => setDrafts((list) => list.map((x, j) => (j === i ? { ...x, state: 'dropped' } : x)))}>
                      ×
                    </button>
                  </span>
                ) : (
                  <span className="draft-state">{d.state === 'accepted' ? 'Keep' : 'Dropped'}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="muted">None yet</span>
        )}

        <h3 className="section-label">Decisions</h3>
        {decisions.length ? (
          <ul className="decisions">
            {decisions.map((d) => (
              <li key={d} className="outcome-pop">
                {d}
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted">None yet</span>
        )}
      </aside>
    </div>
  )
}

export function MeetingsScreen() {
  const { templates, meetings, saveMeeting, addTicket, systems } = useWorkspace()
  const [setup, setSetup] = useState<MeetingTemplate | null>(null)
  const [live, setLive] = useState<{ title: string; kind: Meeting['kind']; attendees: string[]; id?: string } | null>(null)
  const [justEnded, setJustEnded] = useState<string | null>(null)

  if (live) {
    return (
      <div className="screen">
        <Room
          title={live.title}
          kind={live.kind}
          attendees={live.attendees}
          onEnd={(m, accepted) => {
            for (const d of accepted) {
              const sys = systems.find((s) => s.label === d.system)
              const owner = d.owner ? ROSTER.find((e) => e.nickname === d.owner) : undefined
              addTicket({
                title: d.title,
                summary: `Agreed in ${m.title.toLowerCase()}.`,
                system: sys ? { label: sys.label, color: sys.color } : null,
                assignee: owner ? { name: owner.nickname, persona: owner } : null,
                history: [{ who: { name: 'You', persona: { type: 'contractor' } }, text: `Agreed in ${m.title.toLowerCase()}`, when: 'now' }]
              })
            }
            if (live.id) saveMeeting({ ...m, id: live.id })
            else saveMeeting(m)
            setJustEnded(live.id ?? m.id)
            setLive(null)
          }}
        />
      </div>
    )
  }

  const upcoming = meetings.filter((m) => m.status === 'upcoming')
  const past = meetings.filter((m) => m.status === 'done')

  return (
    <div className="screen">
      <ScreenHeader title="Meetings" sub="Talk it through. Tickets and plans come out the other side." />
      <div className="screen-split">
        <div className="screen-scroll">
          <h2 className="section-label">Start one now</h2>
          <div className="template-grid">
            {templates.map((t) => (
              <button key={t.kind} className={`template-card${setup?.kind === t.kind ? ' is-active' : ''}`} onClick={() => setSetup(t)}>
                <span className="meet-icon is-big">{t.icon}</span>
                <strong>{t.title}</strong>
                <span className="muted">{t.blurb}</span>
              </button>
            ))}
          </div>

          <h2 className="section-label meet-section">Coming up</h2>
          <ul className="meet-list">
            {upcoming.map((m) => (
              <li key={m.id} className="meet-row">
                <span className="meet-icon">{ICON[m.kind]}</span>
                <span className="meet-row-main">
                  <strong>{m.title}</strong>
                  <span className="muted">{m.when}</span>
                </span>
                <Faces names={m.attendees} />
                <button className="btn-primary" onClick={() => setLive({ title: m.title, kind: m.kind, attendees: m.attendees, id: m.id })}>
                  Join
                </button>
              </li>
            ))}
          </ul>

          <h2 className="section-label meet-section">Past</h2>
          <ul className="meet-list">
            {past.map((m) => (
              <li key={m.id} className={`meet-row is-past${justEnded === m.id ? ' is-new' : ''}`}>
                <span className="meet-icon">{ICON[m.kind]}</span>
                <span className="meet-row-main">
                  <strong>{m.title}</strong>
                  <span className="muted">
                    {m.when} · {m.length}
                  </span>
                  {m.outcomes && m.outcomes.decisions.length > 0 && (
                    <span className="meet-decisions">
                      {m.outcomes.decisions.map((d) => (
                        <span key={d}>✓ {d}</span>
                      ))}
                    </span>
                  )}
                </span>
                <Faces names={m.attendees} size={22} />
                {m.outcomes && <span className="plain-chip">{m.outcomes.tickets === 1 ? '1 ticket' : `${m.outcomes.tickets} tickets`}</span>}
              </li>
            ))}
          </ul>
        </div>
        {setup && (
          <aside className="side-detail">
            <Setup
              template={setup}
              onCancel={() => setSetup(null)}
              onStart={(attendees) => {
                setLive({ title: setup.title, kind: setup.kind, attendees })
                setSetup(null)
              }}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
