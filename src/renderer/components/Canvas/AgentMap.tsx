import { memo, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { Background, BackgroundVariant, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { STATUS_LABEL } from './agentStatus'
import { statusOf, type Agent, type AgentStatus } from './agentStore'
import { Avatar } from './Avatar'
import { displayName, personaFor, roleOf } from './personas'
import { TICKET_STATUS_LABEL, type ActivityPeer, type ActivitySystem, type ActivityTicket, type AgentActivity } from './agentActivity'
import { StatusIcon } from '../shared/StatusIcon'

// A picture of what one agent is doing. Each kind of thing has its own shape,
// so it reads at a glance: agents are faces (employee mascots or the
// contractor picture), tickets are square cards
// with a status ring, systems are coloured pills, findings are dashed cards.
// Tickets above, the agent's peers left, findings right, systems below.

const CENTER = { w: 340, h: 140 }
const TICKET = { w: 280, h: 72 }
const PEER = { w: 260, h: 72 }
const SYSTEM = { w: 190, h: 44 }
const GAP = 22
const LABEL_H = 26

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
  const persona = personaFor(agent.id)
  return (
    <div className={`amap-center status-${status}`} style={{ width: CENTER.w, height: CENTER.h }}>
      <Handles />
      <div className="amap-center-head">
        <Avatar persona={persona} ring={status} size={48} />
        <div className="amap-center-id">
          <span className="amap-center-name">{displayName(persona, agent.name)}</span>
          <span className="amap-center-status">
            {roleOf(persona)} · <span className={`text-${status}`}>{STATUS_LABEL[status]}</span>
          </span>
        </div>
      </div>
      <p className="amap-now">{now}</p>
    </div>
  )
})

const TicketNode = memo(function TicketNode({ data }: NodeProps) {
  const { ticket, found } = data as { ticket: ActivityTicket; found?: boolean }
  return (
    <div className={`amap-ticket${found ? ' is-found' : ''}`} style={{ width: TICKET.w, height: TICKET.h }} title={`${ticket.key} · ${TICKET_STATUS_LABEL[ticket.status]}`}>
      <Handles />
      <div className="amap-ticket-head">
        <StatusIcon status={ticket.status} />
        <span className="amap-ticket-key">{ticket.key}</span>
        {found && <span className="amap-new">New · Inbox</span>}
      </div>
      <p className="amap-ticket-title">{ticket.title}</p>
    </div>
  )
})

const PeerNode = memo(function PeerNode({ data }: NodeProps) {
  // Clicks are handled by the map's onNodeClick (nodes here are not selectable, so
  // React Flow only lets pointer events through when that handler is set).
  const { peer, status } = data as { peer: ActivityPeer; status: AgentStatus | null }
  const conflict = peer.relation === 'overlaps'
  const link = !!peer.agentId
  return (
    <div
      className={`amap-peer${conflict ? ' is-conflict' : ''}${link ? ' is-link' : ''}`}
      style={{ width: PEER.w, height: PEER.h }}
      title={link ? `Open ${peer.name}` : undefined}
    >
      <Handles />
      <Avatar persona={peer.persona} ring={conflict ? 'conflict' : status} size={40} />
      <div className="amap-peer-text">
        <span className="amap-peer-name">{peer.name}</span>
        <span className="amap-peer-detail">{peer.detail}</span>
      </div>
    </div>
  )
})

const SystemNode = memo(function SystemNode({ data }: NodeProps) {
  const { system } = data as { system: ActivitySystem }
  return (
    <div className="amap-system" style={{ width: SYSTEM.w, height: SYSTEM.h, ['--sys' as string]: system.color } as CSSProperties}>
      <Handles />
      <span className="amap-system-swatch" />
      <span className="amap-system-label">{system.label}</span>
    </div>
  )
})

const LabelNode = memo(function LabelNode({ data }: NodeProps) {
  const { text, tone } = data as { text: string; tone?: 'warn' }
  return <span className={`amap-group-label${tone === 'warn' ? ' is-warn' : ''}`}>{text}</span>
})

const nodeTypes = { center: CenterNode, ticket: TicketNode, peer: PeerNode, system: SystemNode, label: LabelNode }

/** Positions for a column (or row) of items centred on a point. */
function spread(count: number, size: number, center: number): number[] {
  const total = count * size + Math.max(0, count - 1) * GAP
  return Array.from({ length: count }, (_, i) => center - total / 2 + i * (size + GAP))
}

function edge(id: string, source: string, sourceSide: Position, target: string, targetSide: Position, style: CSSProperties, extra: Partial<Edge> = {}): Edge {
  return { id, source, target, sourceHandle: `s-${sourceSide}`, targetHandle: `t-${targetSide}`, style: { strokeWidth: 1.5, ...style }, ...extra }
}

function label(id: string, x: number, y: number, text: string, tone?: 'warn'): Node {
  return { id, type: 'label', position: { x, y }, data: { text, tone }, selectable: false }
}

interface AgentMapProps {
  agent: Agent
  agents: Agent[]
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

function AgentMapInner({ agent, agents, activity, onOpenAgent }: AgentMapProps) {
  // Status is time-based, so read it on every render rather than inside the memo.
  const status = statusOf(agent)
  const peerKey = activity.peers
    .map((p) => {
      const a = agents.find((x) => x.id === p.agentId)
      return a ? `${a.id}:${statusOf(a)}` : p.name
    })
    .join(',')

  const { nodes, edges } = useMemo(() => {
    const cx = CENTER.w / 2
    const cy = CENTER.h / 2
    const nodes: Node[] = [{ id: 'agent', type: 'center', position: { x: 0, y: 0 }, data: { agent, status, now: activity.now } }]
    const edges: Edge[] = []

    // Tickets it works on: above.
    const ticketY = -TICKET.h - 96
    const ticketXs = spread(activity.tickets.length, TICKET.w, cx)
    if (ticketXs.length) nodes.push(label('l-tickets', ticketXs[0], ticketY - LABEL_H, 'Working on'))
    ticketXs.forEach((x, i) => {
      const t = activity.tickets[i]
      nodes.push({ id: `ticket-${t.key}`, type: 'ticket', position: { x, y: ticketY }, data: { ticket: t } })
      edges.push(edge(`e-ticket-${t.key}`, 'agent', Position.Top, `ticket-${t.key}`, Position.Bottom, { stroke: 'var(--accent)', strokeWidth: 2 }))
    })

    // Systems it touches: below.
    const systemY = CENTER.h + 96
    const systemXs = spread(activity.systems.length, SYSTEM.w, cx)
    if (systemXs.length) nodes.push(label('l-systems', systemXs[0], systemY - LABEL_H, 'Touching'))
    systemXs.forEach((x, i) => {
      const s = activity.systems[i]
      nodes.push({ id: `system-${s.id}`, type: 'system', position: { x, y: systemY }, data: { system: s } })
      edges.push(edge(`e-system-${s.id}`, 'agent', Position.Bottom, `system-${s.id}`, Position.Top, { stroke: s.color, opacity: 0.8 }))
    })

    // Agents it works with, and agents it conflicts with: left, in two groups.
    const peerX = -PEER.w - 150
    const groups = [
      { items: activity.peers.filter((p) => p.relation === 'works-with'), title: 'Works with', warn: false },
      { items: activity.peers.filter((p) => p.relation === 'overlaps'), title: 'Conflicts with', warn: true }
    ].filter((g) => g.items.length)
    const groupH = groups.map((g) => LABEL_H + g.items.length * PEER.h + (g.items.length - 1) * GAP)
    let y = cy - (groupH.reduce((a, b) => a + b, 0) + Math.max(0, groups.length - 1) * 30) / 2
    groups.forEach((g, gi) => {
      nodes.push(label(`l-peers-${gi}`, peerX, y, g.title, g.warn ? 'warn' : undefined))
      y += LABEL_H
      for (const p of g.items) {
        const id = `peer-${activity.peers.indexOf(p)}`
        const real = agents.find((a) => a.id === p.agentId)
        nodes.push({ id, type: 'peer', position: { x: peerX, y }, data: { peer: p, status: real ? statusOf(real) : null } })
        edges.push(
          g.warn
            ? edge(`e-${id}`, 'agent', Position.Left, id, Position.Right, { stroke: 'var(--status-needs-you)', strokeDasharray: '6 5', strokeWidth: 2 }, {
                animated: true,
                label: '⚠ conflict',
                labelStyle: { fill: 'var(--status-needs-you)', fontSize: 12, fontWeight: 600 },
                labelBgStyle: { fill: 'var(--bg-primary)' },
                labelBgPadding: [6, 3],
                labelBgBorderRadius: 4
              })
            : edge(`e-${id}`, 'agent', Position.Left, id, Position.Right, { stroke: 'var(--text-tertiary)' })
        )
        y += PEER.h + GAP
      }
      y += 30 - GAP
    })

    // What it found along the way: right, headed for the inbox.
    const foundX = CENTER.w + 150
    const foundYs = spread(activity.found.length, TICKET.h, cy)
    if (foundYs.length) nodes.push(label('l-found', foundX, foundYs[0] - LABEL_H, 'Found along the way'))
    foundYs.forEach((fy, i) => {
      const t = activity.found[i]
      nodes.push({ id: `found-${t.key}`, type: 'ticket', position: { x: foundX, y: fy }, data: { ticket: t, found: true } })
      edges.push(edge(`e-found-${t.key}`, 'agent', Position.Right, `found-${t.key}`, Position.Left, { stroke: 'var(--status-unread)', strokeDasharray: '3 4' }))
    })

    return { nodes, edges }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, status, activity, peerKey, onOpenAgent])

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
        onNodeClick={(_e, node) => {
          const peer = node.type === 'peer' ? (node.data as { peer: ActivityPeer }).peer : null
          if (peer?.agentId) onOpenAgent(peer.agentId)
        }}
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
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border-subtle)" />
      </ReactFlow>
      {activity.sample && (
        <span className="amap-sample" title="Real tickets, systems and peers arrive with agent hooks and the board">
          Preview · sample data
        </span>
      )}
    </div>
  )
}
