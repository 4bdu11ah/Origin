import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../Canvas/Avatar'
import { ROSTER } from '../Canvas/personas'
import { CHIEF } from '../../sample/workspace'
import { StatusIcon } from '../shared/StatusIcon'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { ChiefCard, ChiefMessage } from '../../types/work'

// One chat that reports on everything. The chief of staff watches the team and
// answers in short messages with cards you can click, instead of walls of text.

const SUGGESTIONS = ['What’s blocked?', 'Summarize today', 'Plan the next release', 'Who’s free?']

function Card({ card }: { card: ChiefCard }) {
  const { tickets, releases, openTicket, setScreen } = useWorkspace()
  if (card.type === 'ticket') {
    const t = tickets.find((x) => x.key === card.key)
    return (
      <button className="ticket-chip" onClick={() => openTicket(card.key)}>
        {t && <StatusIcon status={t.status} />}
        <span className="ticket-key">{card.key}</span>
        {t?.title}
      </button>
    )
  }
  if (card.type === 'person') {
    const e = ROSTER.find((x) => x.nickname === card.name)
    return (
      <button className="ticket-chip" onClick={() => setScreen('team')}>
        {e && <Avatar persona={e} size={20} />}
        {card.name}
      </button>
    )
  }
  const r = releases.find((x) => x.id === card.id)
  return (
    <button className="ticket-chip" onClick={() => setScreen('releases')}>
      🚀 {r?.name ?? 'Release'}
    </button>
  )
}

function Glance() {
  const { team, inbox, releases, tickets } = useWorkspace()
  const stats = [
    { n: team.filter((m) => m.status === 'needs-you').length, label: 'need you', tone: 'warn' },
    { n: team.filter((m) => m.status === 'working').length, label: 'working', tone: 'ok' },
    { n: tickets.filter((t) => t.status === 'in-review').length, label: 'in review', tone: 'info' },
    { n: inbox.length, label: 'in inbox', tone: 'info' }
  ]
  const live = releases.find((r) => r.status === 'live')
  return (
    <aside className="glance">
      <h3 className="section-label">Right now</h3>
      <div className="glance-grid">
        {stats.map((s) => (
          <div key={s.label} className={`glance-stat tone-${s.tone}`}>
            <span className="glance-n">{s.n}</span>
            <span className="glance-label">{s.label}</span>
          </div>
        ))}
      </div>
      {live && (
        <div className="glance-live">
          <span className="live-dot" /> Live: {live.name}
        </div>
      )}
    </aside>
  )
}

export function ChiefScreen() {
  const { chief } = useWorkspace()
  const [messages, setMessages] = useState<ChiefMessage[]>(chief)
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [messages])

  const send = (text: string) => {
    const t = text.trim()
    if (!t) return
    const now = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    setMessages((m) => [
      ...m,
      { from: 'you', text: t, when: now },
      { from: 'chief', text: 'Got it. I’ll answer for real once I’m connected to the team.', when: now }
    ])
    setDraft('')
  }

  return (
    <div className="screen">
      <ScreenHeader title="Chief of staff" sub={`${CHIEF.nickname} keeps an eye on everyone and reports here.`} />
      <div className="screen-split">
        <div className="chat">
          <div className="chat-scroll">
            {messages.map((m, i) => (
              <div key={i} className={`msg from-${m.from}`}>
                {m.from === 'chief' && <Avatar persona={CHIEF} size={32} />}
                <div className="msg-body">
                  <p>{m.text}</p>
                  {m.cards && (
                    <div className="chip-row">
                      {m.cards.map((c, j) => (
                        <Card key={j} card={c} />
                      ))}
                    </div>
                  )}
                  <span className="msg-when">{m.when}</span>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="chat-compose">
            <div className="chip-row">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
            <form
              className="chat-input"
              onSubmit={(e) => {
                e.preventDefault()
                send(draft)
              }}
            >
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Ask ${CHIEF.nickname} anything about the project…`} />
              <button className="btn-primary" type="submit" disabled={!draft.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
        <Glance />
      </div>
    </div>
  )
}
