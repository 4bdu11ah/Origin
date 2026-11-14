import type { CSSProperties } from 'react'
import { Avatar } from './Avatar'
import { statusOf, type Agent } from './agentStore'
import { personaFor, displayName } from './personas'
import { STATUS_LABEL } from './agentStatus'
import { edgeText, featureIcon, PIECE_KIND, summaryOf, systemIcon, titleOf, type Lang, type MapIndex, type MapPath } from './mapScene'
import type { NodeType } from '../../types/map'

// Everything around the map: where you are (and the way back up), the plain or
// technical switch, a key for piece shapes, and the card for one piece.

export function MapHeader({
  ix,
  path,
  lang,
  agents,
  onGo,
  onAsk,
  onOpenAgent
}: {
  ix: MapIndex
  path: MapPath
  lang: Lang
  agents: Agent[]
  onGo: (path: MapPath) => void
  onAsk: () => void
  onOpenAgent: (id: string) => void
}) {
  const system = path.systemId ? ix.system.get(path.systemId) : undefined
  const feature = path.featureId ? ix.feature.get(path.featureId) : undefined
  const here = feature ?? system
  const summary = here ? summaryOf(here, lang) : lang === 'plain' ? ix.map.project.summary || ix.map.project.description : ix.map.project.description
  return (
    <div className="map-head" style={system ? ({ ['--sys' as string]: system.color } as CSSProperties) : undefined}>
      <nav className="map-crumbs" aria-label="Where you are">
        <button className={`crumb${!system ? ' is-here' : ''}`} onClick={() => onGo({})}>
          <span className="crumb-icon">🗺️</span>
          {ix.map.project.name}
        </button>
        {system && (
          <>
            <span className="crumb-sep">›</span>
            <button className={`crumb${!feature ? ' is-here' : ''}`} onClick={() => onGo({ systemId: system.id })}>
              <span className="crumb-icon">{systemIcon(system)}</span>
              {titleOf(system, lang)}
            </button>
          </>
        )}
        {feature && (
          <>
            <span className="crumb-sep">›</span>
            <span className="crumb is-here">
              <span className="crumb-icon">{featureIcon(feature)}</span>
              {titleOf(feature, lang)}
            </span>
          </>
        )}
      </nav>
      <p className="map-summary">{summary}</p>
      <div className="map-head-actions">
        {agents.length > 0 && (
          <span className="map-here">
            {agents.map((a) => (
              <button key={a.id} className="tile-face" onClick={() => onOpenAgent(a.id)} title={`${displayName(personaFor(a.id), a.name)} · ${STATUS_LABEL[statusOf(a)]}`}>
                <Avatar persona={personaFor(a.id)} size={24} ring={statusOf(a)} />
              </button>
            ))}
            <span className="muted">working here</span>
          </span>
        )}
        <button className="map-ask" onClick={onAsk}>
          Ask about {here ? 'this' : 'the project'}
        </button>
      </div>
    </div>
  )
}

export function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="map-lang" role="group" aria-label="Words">
      <button className={lang === 'plain' ? 'is-on' : ''} onClick={() => onChange('plain')}>
        Plain words
      </button>
      <button className={lang === 'tech' ? 'is-on' : ''} onClick={() => onChange('tech')}>
        Technical
      </button>
    </div>
  )
}

export function ShapeKey({ types }: { types: NodeType[] }) {
  const kinds = [...new Map(types.map((t) => PIECE_KIND[t] ?? PIECE_KIND.function).map((k) => [k.label, k])).values()]
  if (!kinds.length) return null
  return (
    <div className="map-key" aria-label="What the shapes mean">
      {kinds.map((k) => (
        <span key={k.label} className={`key-item shape-${k.shape}`}>
          <span className="key-swatch" />
          {k.icon} {k.label}
        </span>
      ))}
    </div>
  )
}

export function PiecePanel({
  ix,
  pieceId,
  lang,
  onClose,
  onSelect,
  onAsk,
  onWork
}: {
  ix: MapIndex
  pieceId: string
  lang: Lang
  onClose: () => void
  /** Jump to another piece (its part opens if it lives elsewhere). */
  onSelect: (pieceId: string) => void
  onAsk: () => void
  onWork: () => void
}) {
  const n = ix.piece.get(pieceId)
  if (!n) return null
  const s = ix.systemOf.get(n.id)!
  const kind = PIECE_KIND[n.type] ?? PIECE_KIND.function
  const links = ix.map.edges
    .filter((e) => (e.from === n.id || e.to === n.id) && ix.piece.has(e.from) && ix.piece.has(e.to))
    .map((e) => {
      const out = e.from === n.id
      const other = ix.piece.get(out ? e.to : e.from)!
      return { key: `${e.from}-${e.to}-${e.type}`, out, other, text: edgeText(e), away: ix.featureOf.get(other.id) !== ix.featureOf.get(n.id) }
    })
  return (
    <aside className="piece-panel" style={{ ['--sys' as string]: s.color } as CSSProperties} aria-label="Piece">
      <div className="pp-top">
        <span className={`pp-kind shape-${kind.shape}`}>
          {kind.icon} {kind.label}
        </span>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <h2 className={`pp-title${lang === 'tech' ? ' is-code' : ''}`}>{titleOf(n, lang)}</h2>
      <p className="pp-summary">{summaryOf(n, lang)}</p>

      {links.length > 0 && (
        <section className="pp-section">
          <h3>Works with</h3>
          <ul className="pp-links">
            {links.map((l) => (
              <li key={l.key}>
                <button onClick={() => onSelect(l.other.id)}>
                  <span className="pp-arrow">{l.out ? '→' : '←'}</span>
                  <span className="pp-link-text">
                    <span className="pp-verb">{l.text}</span>
                    <strong>{titleOf(l.other, lang)}</strong>
                  </span>
                  {l.away && <span className="pp-away">{titleOf(ix.featureOf.get(l.other.id)!, lang)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pp-section pp-tech">
        <h3>For developers</h3>
        <code className="pp-name">{n.label}</code>
        <code className="pp-file">
          {n.file}:{n.line}
        </code>
        {lang === 'plain' && n.summary && <p className="muted">{n.description}</p>}
      </section>

      <div className="pp-actions">
        <button className="btn-primary" onClick={onWork}>
          Work on this
        </button>
        <button className="btn-ghost" onClick={onAsk}>
          Ask about it
        </button>
      </div>
    </aside>
  )
}
