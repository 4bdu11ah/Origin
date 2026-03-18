import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

interface LayoutOptions {
  direction?: 'TB' | 'LR'
  nodeWidth?: number
  nodeHeight?: number
  spacing?: number
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 280,
    nodeHeight = 160,
    spacing = 80
  } = options

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: spacing,
    ranksep: spacing * 1.5,
    marginx: 40,
    marginy: 40
  })

  nodes.forEach((node) => {
    const width = node.measured?.width ?? nodeWidth
    const height = node.measured?.height ?? nodeHeight
    g.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id)
    const width = node.measured?.width ?? nodeWidth
    const height = node.measured?.height ?? nodeHeight

    return {
      ...node,
      position: {
        x: dagreNode.x - width / 2,
        y: dagreNode.y - height / 2
      }
    }
  })

  return { nodes: layoutedNodes, edges }
}

/**
 * Simple grid layout for when there are no edges (e.g., feature cards)
 */
export function getGridLayout(
  nodes: Node[],
  options: { columns?: number; nodeWidth?: number; nodeHeight?: number; gap?: number } = {}
): Node[] {
  const {
    columns = 3,
    nodeWidth = 280,
    nodeHeight = 140,
    gap = 48
  } = options

  return nodes.map((node, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    return {
      ...node,
      position: {
        x: col * (nodeWidth + gap),
        y: row * (nodeHeight + gap)
      }
    }
  })
}
