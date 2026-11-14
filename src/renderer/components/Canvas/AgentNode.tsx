import { createContext, memo, useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { statusOf, useAgents, type Agent, type AgentStatus } from './agentStore'
import { ActivityContext } from './agentActivity'
import { Avatar } from './Avatar'
import { displayName, personaFor, roleOf } from './personas'

// Agents on the overview are cards the size of system cards. Their terminal
// and files live inside the agent (AgentSpace), not on the canvas.
export const AGENT_W = 340
export const AGENT_H = 172

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Working',
  'needs-you': 'Needs you',
  error: 'Error',
  unread: 'Done, unread',
  idle: 'Idle',
  exited: 'Exited'
}

export interface FileChange {
  path: string
  at: number
  deleted: boolean
}

/** Project file changes, shared by every agent card and the agent space. */
export const FileChangesContext = createContext<FileChange[]>([])

export function changesFor(agent: Agent, changes: FileChange[]): FileChange[] {
  return changes.filter((c) => c.at >= agent.createdAt)
}

type AgentNodeData = {
  agentId: string
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

export const AgentNode = memo(function AgentNode({ data }: NodeProps) {
  const { agentId, onOpen, onRemove } = data as unknown as AgentNodeData
  const { agents, focusedId } = useAgents()
  const activity = useContext(ActivityContext).get(agentId)
  const agent = agents.find((a) => a.id === agentId)
  if (!agent) return null

  const status = statusOf(agent)
  const persona = personaFor(agent.id)
  const ticket = activity?.tickets[0]
  const overlap = activity?.peers.find((p) => p.relation === 'overlaps')

  return (
    <div
      className={`agent-node status-${status}${focusedId === agent.id ? ' is-focused' : ''}`}
      style={{ width: AGENT_W, height: AGENT_H }}
      onClick={() => onOpen(agent.id)}
      data-hook={agent.hook ?? ''}
      title="Open this agent"
    >
      <Handle type="target" position={Position.Top} className="agent-handle" />
      <div className="agent-node-header">
        <Avatar persona={persona} ring={status} size={34} />
        <span className="agent-node-who">
          <span className="agent-node-name">{displayName(persona, agent.name)}</span>
          <span className="agent-node-role">{roleOf(persona)}</span>
        </span>
        <span className="agent-node-kind">{agent.kind}</span>
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
      <div className="agent-node-body">
        <p className="agent-node-line">
          {agent.lastLine || (agent.exited ? 'Process exited' : agent.screen.length ? 'Ready for input' : 'Starting…')}
        </p>
        <div className="agent-node-meta">
          <span className={`agent-node-status text-${status}`}>{STATUS_LABEL[status]}</span>
          {overlap && <span className="agent-node-overlap" title={`${overlap.name}: ${overlap.detail}`}>⚠ Overlap</span>}
          {ticket && <span className="agent-node-ticket" title={ticket.title}>{ticket.key}</span>}
        </div>
      </div>
    </div>
  )
})
