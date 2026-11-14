import { useMemo, useRef, useState } from 'react'
import { Avatar } from '../Canvas/Avatar'
import { ROSTER } from '../Canvas/personas'
import { useWorkspace } from '../Workspace/WorkspaceContext'
import { ScreenHeader } from './ScreenHeader'
import type { Release, ShippedTicket } from '../../types/work'

// The project's journey as one line. The next release (being built) sits on
// top, then what's live now, then every release back down to the origin: the
// first commit. Tickets merge in from the left like branches; what users got
// comes out on the right. Scroll down to go back in time.

const W = 1040
const SPINE = 430
const ROW = 34
const CARD_H = 128
const GAP = 26
const TICKET_DOT = SPINE - 72

type Block =
  | { kind: 'next'; id: string; tickets: ShippedTicket[]; progress: { ok: number; total: number } }
  | { kind: 'release'; id: string; release: Release; tickets: ShippedTicket[] }
  | { kind: 'origin'; id: string; tickets: [] }

interface Placed {
  block: Block
  top: number
  station: number
  rows: number[]
}

function face(name: string, size = 22) {
  const e = ROSTER.find((x) => x.nickname === name)
  return e ? <Avatar persona={e} size={size} title={name} /> : null
}

function layout(blocks: Block[]): { placed: Placed[]; height: number } {
  let y = 28
  const placed = blocks.map((block) => {
    const n = block.tickets.length
    const station = y + (n ? n * ROW + 18 : 22)
    const rows = block.tickets.map((_, i) => station - (n - i) * ROW - 4)
    const bottom = Math.max(station + 26, station - 30 + CARD_H)
    const p = { block, top: y, station, rows }
    y = bottom + GAP
    return p
  })
  return { placed, height: y }
}

function branch(rowY: number, station: number, x = TICKET_DOT): string {
  const join = Math.min(rowY + 30, station - 12)
  return `M ${x} ${rowY} C ${SPINE - 18} ${rowY}, ${SPINE} ${rowY + 6}, ${SPINE} ${join}`
}

function ChecksMeter({ passed, total }: { passed: number; total: number }) {
  const all = passed === total
  return (
    <span className={`checks-meter${all ? ' is-ok' : ''}`} title={`${passed} of ${total} checks passed`}>
      <span className="checks-meter-track">
        <span style={{ width: `${Math.round((passed / Math.max(1, total)) * 100)}%` }} />
      </span>
      {passed}/{total}
    </span>
  )
}

export function ReleasesScreen() {
  const { releases, origin, tickets, openTicket } = useWorkspace()
  const [open, setOpen] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const blocks = useMemo<Block[]>(() => {
    const building = tickets.filter((t) => t.status === 'in-progress' || t.status === 'in-review')
    const checks = building.flatMap((t) => t.doneWhen)
    return [
      {
        kind: 'next',
        id: 'next',
        tickets: building.map((t) => ({ key: t.key, title: t.title, who: t.assignee?.name ?? '' })),
        progress: { ok: checks.filter((c) => c.ok).length, total: checks.length }
      },
      ...releases.map((r) => ({ kind: 'release' as const, id: r.id, release: r, tickets: r.tickets })),
      { kind: 'origin', id: 'origin', tickets: [] }
    ]
  }, [releases, tickets])

  const { placed, height } = useMemo(() => layout(blocks), [blocks])
  const live = placed.find((p) => p.block.kind === 'release' && p.block.release.status === 'live')
  const next = placed[0]
  const last = placed[placed.length - 1]
  const shipped = releases.filter((r) => r.status !== 'rolled-back').reduce((n, r) => n + r.tickets.length, 0)

  const jump = (p: Placed) => scrollRef.current?.scrollTo({ top: Math.max(0, p.top - 20), behavior: 'smooth' })
  const ticketKnown = (key: string) => tickets.some((t) => t.key === key)

  return (
    <div className="screen">
      <ScreenHeader title="Releases" sub={`${releases.length} releases · ${shipped} tickets shipped · started ${origin.age}`} />
      <div className="screen-split">
        <div className="screen-scroll journey-scroll" ref={scrollRef}>
          <div className="journey" style={{ width: W, height }}>
            <svg className="journey-lines" width={W} height={height} aria-hidden>
              {/* The spine: dashed while the next release is being built, solid through history. */}
              {live && <line x1={SPINE} y1={next.station} x2={SPINE} y2={live.station} className="spine-next" />}
              <line x1={SPINE} y1={live?.station ?? next.station} x2={SPINE} y2={last.station} className="spine-past" />

              {placed.map((p) =>
                p.rows.map((rowY, i) => (
                  <g key={`${p.block.id}-${i}`} className={`branch kind-${p.block.kind}${p.block.kind === 'release' && p.block.release.status === 'rolled-back' ? ' is-rolled-back' : ''}`}>
                    <path d={branch(rowY, p.station)} />
                    <circle cx={TICKET_DOT} cy={rowY} r={4.5} />
                  </g>
                ))
              )}

              {live && <line x1={24} y1={live.station} x2={W - 24} y2={live.station} className="now-line" />}

              {placed.map((p) => {
                const b = p.block
                if (b.kind === 'origin') {
                  return (
                    <g key={b.id} className="station is-origin">
                      <circle cx={SPINE} cy={p.station} r={17} />
                      <circle cx={SPINE} cy={p.station} r={6} className="core" />
                    </g>
                  )
                }
                if (b.kind === 'next') {
                  return <circle key={b.id} cx={SPINE} cy={p.station} r={11} className="station is-next" />
                }
                const s = b.release.status
                return (
                  <g key={b.id} className={`station is-${s}`}>
                    {s === 'live' && <circle cx={SPINE} cy={p.station} r={20} className="halo" />}
                    <circle cx={SPINE} cy={p.station} r={s === 'live' ? 12 : 9} />
                    {s === 'rolled-back' && (
                      <text x={SPINE} y={p.station + 4} textAnchor="middle" className="rb-glyph">
                        ↺
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {live && (
              <span className="now-tag" style={{ top: live.station - 11 }}>
                ● Live now
              </span>
            )}

            {placed.map((p) => {
              const b = p.block
              return (
                <div key={b.id}>
                  {b.tickets.map((t, i) => (
                    <button
                      key={`${t.key}-${t.title}`}
                      className={`merge-chip kind-${b.kind}`}
                      style={{ top: p.rows[i] - 13, right: W - TICKET_DOT + 14 }}
                      onClick={() => ticketKnown(t.key) && openTicket(t.key)}
                      disabled={!ticketKnown(t.key)}
                      title={ticketKnown(t.key) ? 'Open ticket' : t.title}
                    >
                      {t.key !== '—' && <span className="ticket-key">{t.key}</span>}
                      <span className="merge-title">{t.title}</span>
                      {face(t.who, 20)}
                    </button>
                  ))}

                  {b.kind === 'next' && (
                    <div className="journey-card is-next" style={{ top: p.station - 30 }}>
                      <div className="jc-top">
                        <span className="jc-version">Next</span>
                        <span className="jc-pill is-building">Building</span>
                      </div>
                      <div className="jc-headline">{b.tickets.length} tickets on the way</div>
                      <div className="jc-foot">
                        <span className="face-stack">{[...new Set(b.tickets.map((t) => t.who))].map((w) => <span key={w}>{face(w)}</span>)}</span>
                        <ChecksMeter passed={b.progress.ok} total={b.progress.total} />
                      </div>
                    </div>
                  )}

                  {b.kind === 'release' && (
                    <button
                      className={`journey-card is-${b.release.status}${open === b.id ? ' is-open' : ''}`}
                      style={{ top: p.station - 30 }}
                      onClick={() => setOpen(open === b.id ? null : b.id)}
                    >
                      <span className="jc-top">
                        <span className="jc-version">{b.release.version}</span>
                        <span className="jc-date">{b.release.name}</span>
                        {b.release.status === 'live' && <span className="jc-pill is-live">Live</span>}
                        {b.release.status === 'rolled-back' && <span className="jc-pill is-rb">Rolled back</span>}
                        <code className="commit">{b.release.commit}</code>
                      </span>
                      <span className="jc-headline">{b.release.headline}</span>
                      {open === b.id && (
                        <ul className="highlights is-compact">
                          {b.release.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      )}
                      <span className="jc-foot">
                        <span className="face-stack">{[...new Set(b.release.tickets.map((t) => t.who))].map((w) => <span key={w}>{face(w)}</span>)}</span>
                        <ChecksMeter {...b.release.checks} />
                      </span>
                    </button>
                  )}

                  {b.kind === 'origin' && (
                    <div className="journey-card is-origin" style={{ top: p.station - 30 }}>
                      <span className="jc-top">
                        <span className="jc-version">Origin</span>
                        <span className="jc-date">{origin.date}</span>
                        <code className="commit">{origin.commit}</code>
                      </span>
                      <span className="jc-headline">{origin.note}</span>
                      <span className="muted">Where it all started, {origin.age}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <nav className="version-rail" aria-label="Jump to a release">
          {placed.map((p) => {
            const b = p.block
            const label = b.kind === 'next' ? 'Next' : b.kind === 'origin' ? 'Origin' : b.release.version
            const tone = b.kind === 'release' ? b.release.status : b.kind
            return (
              <button key={b.id} className={`vr-item is-${tone}`} onClick={() => jump(p)}>
                <span className="vr-dot" />
                {label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
