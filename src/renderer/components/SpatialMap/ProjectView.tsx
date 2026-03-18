import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState
} from '@xyflow/react'
import type { OriginMap, System } from '../../types/map'
import { getLayoutedElements } from './layout'
import { SystemNode } from './nodes/SystemNode'

const nodeTypes = { system: SystemNode }

interface ProjectViewProps {
  map: OriginMap
  onSystemClick: (systemId: string) => void
}

function countSystemNodes(system: System): number {
  return system.features.reduce((acc, f) => acc + f.nodes.length, 0)
}

export function ProjectView({ map, onSystemClick }: ProjectViewProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = map.systems.map((system) => ({
      id: system.id,
      type: 'system',
      position: { x: 0, y: 0 },
      data: {
        system,
        nodeCount: countSystemNodes(system),
        onClick: () => onSystemClick(system.id)
      }
    }))

    // Edges between systems: aggregate node-level edges to system level
    const systemEdgeSet = new Set<string>()
    const systemEdges: Edge[] = []

    // Build a lookup: nodeId -> systemId
    const nodeToSystem = new Map<string, string>()
    for (const system of map.systems) {
      for (const feature of system.features) {
        for (const node of feature.nodes) {
          nodeToSystem.set(node.id, system.id)
        }
      }
    }

    for (const edge of map.edges) {
      const fromSystem = nodeToSystem.get(edge.from)
      const toSystem = nodeToSystem.get(edge.to)
      if (fromSystem && toSystem && fromSystem !== toSystem) {
        const key = `${fromSystem}->${toSystem}`
        if (!systemEdgeSet.has(key)) {
          systemEdgeSet.add(key)
          systemEdges.push({
            id: key,
            source: fromSystem,
            target: toSystem,
            animated: true,
            type: 'smoothstep',
            style: { stroke: 'var(--border-default)', strokeWidth: 1.5 }
          })
        }
      }
    }

    const layouted = getLayoutedElements(nodes, systemEdges, {
      direction: 'TB',
      nodeWidth: 320,
      nodeHeight: 180,
      spacing: 120
    })

    return { initialNodes: layouted.nodes, initialEdges: layouted.edges }
  }, [map, onSystemClick])

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
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    />
  )
}
