import { useMemo } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState
} from '@xyflow/react'
import type { OriginMap, Feature } from '../../types/map'
import { getLayoutedElements } from './layout'
import { CodeNodeComponent } from './nodes/CodeNode'

const nodeTypes = { code: CodeNodeComponent }

interface FeatureViewProps {
  map: OriginMap
  feature: Feature
  systemColor: string
}

export function FeatureView({ map, feature, systemColor }: FeatureViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodeIdSet = new Set(feature.nodes.map((n) => n.id))

    const nodes: Node[] = feature.nodes.map((node) => ({
      id: node.id,
      type: 'code',
      position: { x: 0, y: 0 },
      data: {
        node,
        systemColor
      }
    }))

    // Edges between nodes within this feature
    const edges: Edge[] = map.edges
      .filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to))
      .map((e) => ({
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        label: e.label,
        animated: e.type === 'data-flow',
        type: 'smoothstep',
        style: { stroke: systemColor, strokeWidth: 1.5, opacity: 0.4 },
        labelStyle: { fontSize: 10, fill: 'var(--text-tertiary)' }
      }))

    // Use hierarchical layout (top to bottom) for code nodes
    const layouted = getLayoutedElements(nodes, edges, {
      direction: 'TB',
      nodeWidth: 280,
      nodeHeight: 140,
      spacing: 80
    })

    return { initialNodes: layouted.nodes, initialEdges: layouted.edges }
  }, [map, feature, systemColor])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.5 }}
      minZoom={0.3}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
    />
  )
}
