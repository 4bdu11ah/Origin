import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { CodeNode as CodeNodeType } from '../../../types/map'
import './nodes.css'

type CodeNodeData = {
  node: CodeNodeType
  systemColor: string
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
  const { node, systemColor } = data as unknown as CodeNodeData

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
      <Handle type="source" position={Position.Bottom} className="code-handle" />
      <Handle type="target" position={Position.Top} className="code-handle" />
    </div>
  )
})
