import { memo } from 'react'
import { Handle, Position, useStore, type NodeProps } from '@xyflow/react'
import { LiveTerminal } from './LiveTerminal'
import { statusOf, useAgents, type AgentStatus } from './agentStore'

export const AGENT_W = 760
export const AGENT_H = 470
// Below this zoom an agent is always a card; text would be unreadable anyway.
const LIVE_ZOOM = 0.7

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Working',
  unread: 'New output',
  idle: 'Idle',
  exited: 'Exited'
}

type AgentNodeData = {
  agentId: string
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

export const AgentNode = memo(function AgentNode({ data, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { agentId, onOpen, onRemove } = data as unknown as AgentNodeData
  const { agents, focusedId } = useAgents()
  const agent = agents.find((a) => a.id === agentId)

  // Semantic zoom: go live only when zoomed in and mostly on screen.
  const onScreenLive = useStore((s) => {
    const [tx, ty, zoom] = s.transform
    if (zoom < LIVE_ZOOM) return false
    const x0 = positionAbsoluteX * zoom + tx
    const y0 = positionAbsoluteY * zoom + ty
    const x1 = x0 + AGENT_W * zoom
    const y1 = y0 + AGENT_H * zoom
    const visW = Math.max(0, Math.min(x1, s.width) - Math.max(x0, 0))
    const visH = Math.max(0, Math.min(y1, s.height) - Math.max(y0, 0))
    return visW * visH > 0.4 * (AGENT_W * zoom) * (AGENT_H * zoom)
  })

  if (!agent) return null
  const focused = focusedId === agent.id
  const status = statusOf(agent)
  const live = focused || onScreenLive

  return (
    <div className={`agent-node status-${status}${focused ? ' is-focused' : ''}`} style={{ width: AGENT_W, height: AGENT_H }}>
      <Handle type="target" position={Position.Top} className="agent-handle" />
      <div className="agent-node-header">
        <span className={`agent-dot dot-${status}`} />
        <span className="agent-node-name">{agent.name}</span>
        <span className="agent-node-kind">{agent.kind}</span>
        <span className="agent-node-status">{STATUS_LABEL[status]}</span>
        <button
          className="agent-node-close nodrag"
          title="Stop and remove agent"
          onClick={(e) => {
            e.stopPropagation()
            if (window.confirm(`Stop "${agent.name}"? Its terminal will be closed.`)) onRemove(agent.id)
          }}
        >
          ×
        </button>
      </div>

      {live ? (
        <div className={`agent-node-body${focused ? ' nodrag nowheel nopan' : ''}`}>
          <LiveTerminal id={agent.id} focused={focused} />
          {!focused && <div className="agent-node-shield" onClick={() => onOpen(agent.id)} title="Click to open" />}
        </div>
      ) : (
        <div className="agent-node-card" onClick={() => onOpen(agent.id)}>
          <p className="agent-card-line">{agent.lastLine || (agent.exited ? 'Process exited' : 'Starting…')}</p>
          <span className="agent-card-hint">Click to open</span>
        </div>
      )}
    </div>
  )
})
