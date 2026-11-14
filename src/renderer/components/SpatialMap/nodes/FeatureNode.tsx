import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Feature } from '../../../types/map'
import './nodes.css'

type FeatureNodeData = {
  feature: Feature
  systemColor: string
  onClick: () => void
  onShowDetail: () => void
  onChatWith: () => void
}

export const FeatureNode = memo(function FeatureNode({ data }: NodeProps) {
  const { feature, systemColor, onClick, onShowDetail, onChatWith } = data as unknown as FeatureNodeData

  return (
    <div
      className="feature-node"
      style={{ '--node-color': systemColor } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="feature-node-header">
        <span className="feature-node-label">{feature.label}</span>
        <span className="feature-node-count">{feature.nodes.length}</span>
      </div>
      <p className="feature-node-description">{feature.description}</p>
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
      <Handle type="source" position={Position.Bottom} className="feature-handle" />
      <Handle type="target" position={Position.Top} className="feature-handle" />
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
