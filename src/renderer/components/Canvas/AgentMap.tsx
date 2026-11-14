import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { STATUS_LABEL } from './AgentNode'
import { statusOf, type Agent, type AgentStatus } from './agentStore'
import { TICKET_STATUS_LABEL, type ActivityPeer, type ActivitySystem, type ActivityTicket, type AgentActivity } from './agentActivity'

// A picture of what one agent is doing: tickets above, the systems it touches
// below, the agents it works with or overlaps on the left, what it found on
// the right. Read at a glance instead of scrolling the chat.

const CENTER = { w: 320, h: 120 }
const TICKET = { w: 270, h: 92 }
const PEER = { w: 250, h: 96 }
const SYSTEM = { w: 200, h: 64 }
const GAP = 28

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left]

/** Invisible handles on every side, so edges can attach wherever the layout needs. */
function Handles() {
  return (
    <>
      {SIDES.map((p) => (
        <Handle key={`s-${p}`} id={`s-${p}`} type="source" position={p} className="amap-handle" isConnectable={false} />
      ))}
      {SIDES.map((p) => (
        <Handle key={`t-${p}`} id={`t-${p}`} type="target" position={p} className="amap-handle" isConnectable={false} />
      ))}
    </>
  )
}

const CenterNode = memo(function CenterNode({ data }: NodeProps) {
  const { agent, status, now } = data as { agent: Agent; status: AgentStatus; now: string }
  return (
    <div className={`amap-node amap-center status-${status}`} style={{ width: CENTER.w, height: CENTER.h }}>
      <Handles />
      <div className="amap-center-head">
        <span className={`agent-dot dot-${status}`} />
        <span className="amap-center-name">{agent.name}</span>
        <span className="agent-node-kind">{agent.kind}</span>
      </div>
      <p className="amap-now">
        <span className="amap-now-label">Now</span> {now}
      </p>
      <span className={`amap-center-status text-${status}`}>{STATUS_LABEL[status]}</span>
    </div>
  )
})

const TicketNode = memo(function TicketNode({ data }: NodeProps) {
  const { ticket, found } = data as { ticket: ActivityTicket; found?: boolean }
  return (
    <div className={`amap-node amap-ticket${found ? ' is-found' : ''}`} style={{ width: TICKET.w, height: TICKET.h }}>
      <Handles />
      <div className="amap-ticket-head">
        <span className="amap-ticket-key">{ticket.key}</span>
        <span className={`amap-pill pill-${ticket.status}`}>{found ? 'Inbox' : TICKET_STATUS_LABEL[ticket.status]}</span>
      </div>
      <p className="amap-ticket-title">{ticket.title}</p>
    </div>
  )
})

const PeerNode = memo(function PeerNode({ data }: NodeProps) {
  const { peer, onOpen } = data as { peer: ActivityPeer; onOpen: (id: string) => void }
  const overlaps = peer.relation === 'overlaps'
  const open = peer.agentId ? () => onOpen(peer.agentId!) : undefined
  return (
    <div
      className={`amap-node amap-peer${overlaps ? ' is-overlap' : ''}${open ? ' is-link' : ''}`}
      style={{ width: PEER.w, height: PEER.h }}
      onClick={open}
      title={open ? `Open ${peer.name}` : undefined}
    >
      <Handles />
      <span className={`amap-relation${overlaps ? ' is-overlap' : ''}`}>{overlaps ? '⚠ Overlaps' : 'Works with'}</span>
      <span className="amap-peer-name">{peer.name}</span>
      <span className="amap-peer-detail">{peer.detail}</span>
    </div>
  )
})

const SystemNode = memo(function SystemNode({ data }: NodeProps) {
  const { system } = data as { system: ActivitySystem }
  return (
    <div className="amap-node amap-system" style={{ width: SYSTEM.w, height: SYSTEM.h, borderTopColor: system.color }}>
      <Handles />
      <span className="amap-system-kind">System</span>
      <span className="amap-system-label">{system.label}</span>
    </div>
  )
})

const nodeTypes = { center: CenterNode, ticket: TicketNode, peer: PeerNode, system: SystemNode }

/** Positions for a column (or row) of items centred on a point. */
function spread(count: number, size: number, center: number): number[] {
  const total = count * size + Math.max(0, count - 1) * GAP
  return Array.from({ length: count }, (_, i) => center - total / 2 + i * (size + GAP))
}

function edge(id: string, source: string, sourceSide: Position, target: string, targetSide: Position, label: string, style: CSSProperties, extra: Partial<Edge> = {}): Edge {
  return {
    id,
    source,
    target,
    sourceHandle: `s-${sourceSide}`,
    targetHandle: `t-${targetSide}`,
    label,
    style: { strokeWidth: 1.5, ...style },
    labelStyle: { fill: 'var(--text-secondary)', fontSize: 12 },
    labelBgStyle: { fill: 'var(--bg-primary)' },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    ...extra
  }
}

interface AgentMapProps {
  agent: Agent
  activity: AgentActivity
  onOpenAgent: (id: string) => void
}

export function AgentMap(props: AgentMapProps) {
  return (
    <ReactFlowProvider>
      <AgentMapInner {...props} />
    </ReactFlowProvider>
  )
}

function AgentMapInner({ agent, activity, onOpenAgent }: AgentMapProps) {
  // Status is time-based, so read it on every render rather than inside the memo.
  const status = statusOf(agent)
  const { nodes, edges } = useMemo(() => {
    const cx = CENTER.w / 2
    const cy = CENTER.h / 2
    const nodes: Node[] = [{ id: 'agent', type: 'center', position: { x: 0, y: 0 }, data: { agent, status, now: activity.now } }]
    const edges: Edge[] = []

    // Tickets it works on: above.
    spread(activity.tickets.length, TICKET.w, cx).forEach((x, i) => {
      const t = activity.tickets[i]
      nodes.push({ id: `ticket-${t.key}`, type: 'ticket', position: { x, y: -TICKET.h - 110 }, data: { ticket: t } })
      edges.push(edge(`e-ticket-${t.key}`, 'agent', Position.Top, `ticket-${t.key}`, Position.Bottom, 'working on', { stroke: 'var(--accent)' }))
    })

    // Systems it touches: below.
    spread(activity.systems.length, SYSTEM.w, cx).forEach((x, i) => {
      const s = activity.systems[i]
      nodes.push({ id: `system-${s.id}`, type: 'system', position: { x, y: CENTER.h + 110 }, data: { system: s } })
      edges.push(edge(`e-system-${s.id}`, 'agent', Position.Bottom, `system-${s.id}`, Position.Top, 'touching', { stroke: s.color }))
    })

    // Agents it works with or overlaps: left.
    spread(activity.peers.length, PEER.h, cy).forEach((y, i) => {
      const p = activity.peers[i]
      const id = `peer-${i}`
      const overlaps = p.relation === 'overlaps'
      nodes.push({ id, type: 'peer', position: { x: -PEER.w - 150, y }, data: { peer: p, onOpen: onOpenAgent } })
      edges.push(
        edge(
          `e-${id}`,
          'agent',
          Position.Left,
          id,
          Position.Right,
          overlaps ? 'same files' : 'works with',
          overlaps ? { stroke: 'var(--status-needs-you)', strokeDasharray: '6 5' } : { stroke: 'var(--text-tertiary)' },
          { animated: overlaps }
        )
      )
    })

    // What it found along the way: right, headed for the inbox.
    spread(activity.found.length, TICKET.h, cy).forEach((y, i) => {
      const t = activity.found[i]
      nodes.push({ id: `found-${t.key}`, type: 'ticket', position: { x: CENTER.w + 150, y }, data: { ticket: t, found: true } })
      edges.push(edge(`e-found-${t.key}`, 'agent', Position.Right, `found-${t.key}`, Position.Left, 'found', { stroke: 'var(--status-unread)', strokeDasharray: '4 4' }))
    })

    return { nodes, edges }
  }, [agent, status, activity, onOpenAgent])

  // Keep the whole picture in view when the side panel or window changes size.
  const rf = useReactFlow()
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => rf.fitView({ padding: 0.12, maxZoom: 1.1 }))
    })
    ro.observe(box)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [rf])

  return (
    <div className="amap" ref={boxRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.5}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
      />
      {activity.sample && (
        <span className="amap-sample" title="Real tickets, systems and peers arrive with agent hooks and the board">
          Preview · sample data
        </span>
      )}
    </div>
  )
}
