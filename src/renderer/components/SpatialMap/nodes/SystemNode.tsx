import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { System } from '../../../types/map'
import './nodes.css'

type SystemNodeData = {
  system: System
  nodeCount: number
  onClick: () => void
  onShowDetail: () => void
  onChatWith: () => void
}

export const SystemNode = memo(function SystemNode({ data }: NodeProps) {
  const { system, nodeCount, onClick, onShowDetail, onChatWith } = data as unknown as SystemNodeData

  return (
    <div
      className="system-node"
      style={{ '--node-color': system.color } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="system-node-header">
        <span className="system-node-label">{system.label}</span>
        <span className="system-node-count">{nodeCount} nodes</span>
      </div>
      <p className="system-node-description">{system.description}</p>
      <div className="system-node-features">
        {system.features.slice(0, 4).map((f) => (
          <span key={f.id} className="system-node-feature-tag">{f.label}</span>
        ))}
        {system.features.length > 4 && (
          <span className="system-node-feature-tag system-node-feature-more">
            +{system.features.length - 4}
          </span>
        )}
      </div>
      <div className="node-action-bar" onClick={(e) => e.stopPropagation()}>
        <button className="node-action-btn" onClick={onShowDetail}>
          <InfoIcon />
          <span>Info</span>
        </button>
        <button className="node-action-btn" onClick={onChatWith}>
          <ChatIcon />
          <span>Chat</span>
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="system-handle" />
      <Handle type="target" position={Position.Top} className="system-handle" />
    </div>
  )
})

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="4.5" r="0.75" fill="currentColor" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M2 2.5h10a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H4L2 12.5V3a.5.5 0 0 1 .5-.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
