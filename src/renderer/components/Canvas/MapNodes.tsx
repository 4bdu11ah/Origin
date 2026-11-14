import { createContext, memo, useContext, type CSSProperties } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Handle, Position, type EdgeProps, type NodeProps } from '@xyflow/react'
import { Avatar } from './Avatar'
import { statusOf, type Agent } from './agentStore'
import { personaFor, displayName } from './personas'
import { featureIcon, GHOST, PART, PIECE, PIECE_KIND, summaryOf, systemIcon, TILE, titleOf, type Lang, type LinkData, type MapIndex } from './mapScene'
import { STATUS_LABEL } from './agentStatus'

// The shapes on the map. Areas and parts are tiles you can step into; pieces
// have a shape per kind (a way in, a step, a record, a guard...); ghosts are
// the neighbours just outside the current view.

export interface MapLive {
  ix: MapIndex
  lang: Lang
  /** Agents working in each area, by system id. */
  agentsIn: Map<string, Agent[]>
  /** Ids (systems, features, pieces) whose code changed in the last few minutes. */
  changing: Set<string>
  selected: string | null
  onOpenAgent: (id: string) => void
}

export const MapLiveContext = createContext<MapLive | null>(null)
const useLive = () => useContext(MapLiveContext)!

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

function Handles() {
  return (
    <>
      {SIDES.map((p) => (
        <Handle key={`s-${p}`} id={`s-${p}`} type="source" position={p} className="map-handle" isConnectable={false} />
      ))}
      {SIDES.map((p) => (
        <Handle key={`t-${p}`} id={`t-${p}`} type="target" position={p} className="map-handle" isConnectable={false} />
      ))}
    </>
  )
}

function Faces({ agents, onOpen }: { agents: Agent[]; onOpen: (id: string) => void }) {
  if (!agents.length) return null
  return (
    <span className="tile-faces">
      {agents.slice(0, 3).map((a) => {
        const persona = personaFor(a.id)
        const status = statusOf(a)
        return (
          <button
            key={a.id}
            className="tile-face"
            title={`${displayName(persona, a.name)} · ${STATUS_LABEL[status]}`}
            onClick={(e) => {
              e.stopPropagation()
              onOpen(a.id)
            }}
          >
            <Avatar persona={persona} size={28} ring={status} />
          </button>
        )
      })}
      {agents.length > 3 && <span className="tile-more">+{agents.length - 3}</span>}
    </span>
  )
}

export const AreaNode = memo(function AreaNode({ data }: NodeProps) {
  const { systemId, step, parts, pieces } = data as { systemId: string; step: number | null; parts: number; pieces: number }
  const { ix, lang, agentsIn, changing, onOpenAgent } = useLive()
  const s = ix.system.get(systemId)!
  const busy = changing.has(s.id)
  return (
    <div className={`map-tile is-area${step ? ' is-step' : ''}${busy ? ' is-changing' : ''}`} style={{ width: TILE.w, height: TILE.h, ['--sys' as string]: s.color } as CSSProperties}>
      <Handles />
      <div className="tile-top">
        <span className="tile-icon">{systemIcon(s)}</span>
        {step && <span className="tile-step">{step}</span>}
        <Faces agents={agentsIn.get(s.id) ?? []} onOpen={onOpenAgent} />
      </div>
      <div className="tile-title">{titleOf(s, lang)}</div>
      <div className="tile-summary">{summaryOf(s, lang)}</div>
      <div className="tile-foot">
        {busy ? <span className="tile-busy">Changing now</span> : <span>{lang === 'plain' ? `${parts} parts` : `${parts} features · ${pieces} nodes`}</span>}
        <span className="tile-open">Look inside →</span>
      </div>
    </div>
  )
})

export const PartNode = memo(function PartNode({ data }: NodeProps) {
  const { featureId, pieces } = data as { featureId: string; pieces: number }
  const { ix, lang, changing } = useLive()
  const f = ix.feature.get(featureId)!
  const s = ix.systemOf.get(featureId)!
  const busy = changing.has(f.id)
  return (
    <div className={`map-tile is-part${busy ? ' is-changing' : ''}`} style={{ width: PART.w, height: PART.h, ['--sys' as string]: s.color } as CSSProperties}>
      <Handles />
      <div className="tile-top">
        <span className="tile-icon">{featureIcon(f)}</span>
      </div>
      <div className="tile-title">{titleOf(f, lang)}</div>
      <div className="tile-summary">{summaryOf(f, lang)}</div>
      <div className="tile-foot">
        {busy ? <span className="tile-busy">Changing now</span> : <span>{lang === 'plain' ? `${pieces} pieces` : `${pieces} nodes`}</span>}
        <span className="tile-open">Look inside →</span>
      </div>
    </div>
  )
})

export const PieceNode = memo(function PieceNode({ data }: NodeProps) {
  const { pieceId } = data as { pieceId: string }
  const { ix, lang, changing, selected } = useLive()
  const n = ix.piece.get(pieceId)!
  const s = ix.systemOf.get(pieceId)!
  const kind = PIECE_KIND[n.type] ?? PIECE_KIND.function
  return (
    <div
      className={`map-piece shape-${kind.shape}${selected === n.id ? ' is-selected' : ''}${changing.has(n.id) ? ' is-changing' : ''}`}
      style={{ width: PIECE.w, height: PIECE.h, ['--sys' as string]: s.color } as CSSProperties}
    >
      <Handles />
      <div className="piece-kind">
        <span className="piece-icon">{kind.icon}</span>
        {kind.label}
      </div>
      <div className={`piece-title${lang === 'tech' ? ' is-code' : ''}`}>{titleOf(n, lang)}</div>
      {lang === 'tech' ? (
        <div className="piece-file">
          {n.file}:{n.line}
        </div>
      ) : (
        <div className="piece-summary">{summaryOf(n, lang)}</div>
      )}
    </div>
  )
})

export const GhostNode = memo(function GhostNode({ data }: NodeProps) {
  const { dir, systemId, featureId } = data as { dir: 'in' | 'out'; systemId: string; featureId?: string }
  const { ix, lang } = useLive()
  const s = ix.system.get(systemId)!
  const f = featureId ? ix.feature.get(featureId) : undefined
  return (
    <div className={`map-ghost dir-${dir}`} style={{ width: GHOST.w, height: GHOST.h, ['--sys' as string]: s.color } as CSSProperties} title={`Go to ${titleOf(f ?? s, lang)}`}>
      <Handles />
      <span className="ghost-icon">{f ? featureIcon(f) : systemIcon(s)}</span>
      <span className="ghost-name">{titleOf(f ?? s, lang)}</span>
      <span className="ghost-go">{dir === 'in' ? '←' : '→'}</span>
    </div>
  )
})

export const ZoneNode = memo(function ZoneNode({ data }: NodeProps) {
  const { plain, tech } = data as { plain: string; tech: string }
  const { lang } = useLive()
  return (
    <div className="map-zone">
      <span className="map-zone-label">{lang === 'plain' ? plain : tech}</span>
    </div>
  )
})

export const mapNodeTypes = { area: AreaNode, part: PartNode, piece: PieceNode, ghost: GhostNode, zone: ZoneNode }

export interface EdgeView extends LinkData {
  showText: boolean
  lit: boolean
}

/** A line between two boxes; the journey gets a soft track under it. Words sit in a pill on the line. */
export const MapEdge = memo(function MapEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd } = props
  const d = props.data as unknown as EdgeView
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.35 })
  return (
    <>
      {d.kind === 'journey' && <path d={path} className="map-track" />}
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      {d.showText && (
        <EdgeLabelRenderer>
          <div className={`map-words is-${d.kind}${d.lit ? ' is-lit' : ''}`} style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>
            {d.text}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

export const mapEdgeTypes = { map: MapEdge }
