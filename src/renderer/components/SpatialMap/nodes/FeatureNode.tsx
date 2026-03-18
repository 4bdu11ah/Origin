import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { Feature } from '../../../types/map'
import './nodes.css'

type FeatureNodeData = {
  feature: Feature
  systemColor: string
  onClick: () => void
}

export const FeatureNode = memo(function FeatureNode({ data }: NodeProps) {
  const { feature, systemColor, onClick } = data as unknown as FeatureNodeData

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
      <Handle type="source" position={Position.Bottom} className="feature-handle" />
      <Handle type="target" position={Position.Top} className="feature-handle" />
    </div>
  )
})
