import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { System } from '../../../types/map'
import './nodes.css'

type SystemNodeData = {
  system: System
  nodeCount: number
  onClick: () => void
}

export const SystemNode = memo(function SystemNode({ data }: NodeProps) {
  const { system, nodeCount, onClick } = data as unknown as SystemNodeData

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
      <Handle type="source" position={Position.Bottom} className="system-handle" />
      <Handle type="target" position={Position.Top} className="system-handle" />
    </div>
  )
})
