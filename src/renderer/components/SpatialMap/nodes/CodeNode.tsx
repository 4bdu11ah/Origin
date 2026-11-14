import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CodeNode as CodeNodeType } from '../../../types/map'
import './nodes.css'

type CodeNodeData = {
  node: CodeNodeType
  systemColor: string
  onShowDetail: () => void
  onChatWith: () => void
}

const NODE_TYPE_ICONS: Record<string, string> = {
  component: 'C',
  function: 'f',
  route: 'R',
  model: 'M',
  middleware: 'MW',
  class: 'Cl',
  hook: 'H',
  config: 'Cf',
  type: 'T',
  test: 'Te'
}

const NODE_TYPE_LABELS: Record<string, string> = {
  component: 'Component',
  function: 'Function',
  route: 'Route',
  model: 'Model',
  middleware: 'Middleware',
  class: 'Class',
  hook: 'Hook',
  config: 'Config',
  type: 'Type',
  test: 'Test'
}

export const CodeNodeComponent = memo(function CodeNodeComponent({ data }: NodeProps) {
  const { node, systemColor, onShowDetail, onChatWith } = data as unknown as CodeNodeData

  return (
    <div className="code-node">
      <div className="code-node-header">
        <span
          className="code-node-type-badge"
          style={{ background: systemColor }}
          title={NODE_TYPE_LABELS[node.type] || node.type}
        >
          {NODE_TYPE_ICONS[node.type] || '?'}
        </span>
        <span className="code-node-label">{node.label}</span>
      </div>
      <p className="code-node-description">{node.description}</p>
      <span className="code-node-file">
        {node.file}:{node.line}
      </span>
      <div className="node-action-bar">
        <button className="node-action-btn" onClick={onShowDetail}>
          <InfoIcon />
          <span>Info</span>
        </button>
        <button className="node-action-btn" onClick={onChatWith}>
          <ChatIcon />
          <span>Chat</span>
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} className="code-handle" />
      <Handle type="target" position={Position.Top} className="code-handle" />
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
