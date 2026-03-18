import { useMemo } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState
} from '@xyflow/react'
import type { OriginMap, System } from '../../types/map'
import { getGridLayout } from './layout'
import { FeatureNode } from './nodes/FeatureNode'

const nodeTypes = { feature: FeatureNode }

interface SystemViewProps {
  map: OriginMap
  system: System
  onFeatureClick: (featureId: string) => void
}

export function SystemView({ map, system, onFeatureClick }: SystemViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = system.features.map((feature) => ({
      id: feature.id,
      type: 'feature',
      position: { x: 0, y: 0 },
      data: {
        feature,
        systemColor: system.color,
        onClick: () => onFeatureClick(feature.id)
      }
    }))

    // Edges between features within this system
    const featureNodeSets = new Map<string, Set<string>>()
    for (const feature of system.features) {
      const nodeIds = new Set(feature.nodes.map((n) => n.id))
      featureNodeSets.set(feature.id, nodeIds)
    }

    const nodeToFeature = new Map<string, string>()
    for (const feature of system.features) {
      for (const node of feature.nodes) {
        nodeToFeature.set(node.id, feature.id)
      }
    }

    const edgeSet = new Set<string>()
    const edges: Edge[] = []

    for (const edge of map.edges) {
      const fromFeature = nodeToFeature.get(edge.from)
      const toFeature = nodeToFeature.get(edge.to)
      if (fromFeature && toFeature && fromFeature !== toFeature) {
        const key = `${fromFeature}->${toFeature}`
        if (!edgeSet.has(key)) {
          edgeSet.add(key)
          edges.push({
            id: key,
            source: fromFeature,
            target: toFeature,
            animated: true,
            type: 'smoothstep',
            style: { stroke: system.color, strokeWidth: 1.5, opacity: 0.35 }
          })
        }
      }
    }

    // Use grid layout for features (clean arrangement)
    const columns = Math.min(4, Math.ceil(Math.sqrt(nodes.length)))
    const layoutedNodes = getGridLayout(nodes, {
      columns,
      nodeWidth: 280,
      nodeHeight: 140,
      gap: 48
    })

    return { initialNodes: layoutedNodes, initialEdges: edges }
  }, [map, system, onFeatureClick])

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
      fitViewOptions={{ padding: 0.4 }}
      minZoom={0.3}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    />
  )
}
