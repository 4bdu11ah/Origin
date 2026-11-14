import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  useStore,
  type Edge,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { DetailItem, OriginMap, System } from '../../types/map'
import { useSettings } from '../../contexts/SettingsContext'
import { getLayoutedElements } from '../SpatialMap/layout'
import { SystemNode } from '../SpatialMap/nodes/SystemNode'
import { DetailPanel } from '../SpatialMap/DetailPanel'
import { AgentNode, AGENT_H, AGENT_W, STATUS_LABEL } from './AgentNode'
import { agentStore, statusOf, useAgents, type Agent, type AgentKind } from './agentStore'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import './Canvas.css'

const nodeTypes = { system: SystemNode, agent: AgentNode }
const SYSTEM_W = 320
const SYSTEM_H = 180
const AGENT_GAP = 64
const STATUS_ORDER = { unread: 0, working: 1, idle: 2, exited: 3 } as const

interface CanvasViewProps {
  map: OriginMap | null
  projectPath: string
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}

function systemPrompt(system: System): string {
  const features = system.features.map((f) => `- ${f.label}: ${f.description}`).join('\n')
  return `You are working on the "${system.label}" system of this project.\n${system.description}\n\nFeatures:\n${features}\n\nStart by giving me a short overview of this system and anything that looks risky.`
}

function Canvas({ map, projectPath }: CanvasViewProps) {
  const { settings } = useSettings()
  const { agents, focusedId } = useAgents()
  const rf = useReactFlow()
  const paneW = useStore((s) => s.width)
  const paneH = useStore((s) => s.height)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [detail, setDetail] = useState<DetailItem | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const dragged = useRef(new Map<string, { x: number; y: number }>())

  useEffect(() => agentStore.resetFor(projectPath), [projectPath])

  const systems = useMemo(() => {
    if (!map) return []
    return map.systems.map((s, i) => ({ ...s, color: settings.graphPalette[i % settings.graphPalette.length] || s.color }))
  }, [map, settings.graphPalette])

  // --- Actions ---------------------------------------------------------------
  const createAgent = useCallback((kind: AgentKind, system?: System) => {
    const id = agentStore.create(kind, system ? { systemId: system.id, systemLabel: system.label, prompt: systemPrompt(system) } : {})
    pendingFocus.current = id
  }, [])

  const overview = useCallback(() => {
    agentStore.focus(null)
    rf.fitView({ padding: 0.12, duration: 450 })
  }, [rf])

  const flyToNode = useCallback(
    (id: string, w: number, h: number, maxZoom: number) => {
      const node = rf.getNode(id)
      if (!node) return
      const zoom = Math.min((paneW - 48) / w, (paneH - 48) / h, maxZoom)
      rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom, duration: 450 })
    },
    [rf, paneW, paneH]
  )

  const openAgent = useCallback(
    (id: string) => {
      agentStore.focus(id)
      flyToNode(id, AGENT_W, AGENT_H, 1.6)
    },
    [flyToNode]
  )

  const showSystemDetail = useCallback(
    (system: System) => {
      const ids = new Set(system.features.flatMap((f) => f.nodes.map((n) => n.id)))
      setDetail({ kind: 'system', system, edges: (map?.edges ?? []).filter((e) => ids.has(e.from) || ids.has(e.to)) })
    },
    [map]
  )

  // --- Graph -----------------------------------------------------------------
  const { mapNodes, mapEdges, mapBounds } = useMemo(() => {
    const nodeToSystem = new Map<string, string>()
    for (const s of systems) for (const f of s.features) for (const n of f.nodes) nodeToSystem.set(n.id, s.id)

    const nodes: Node[] = systems.map((system) => ({
      id: system.id,
      type: 'system',
      position: { x: 0, y: 0 },
      draggable: false,
      data: {
        system,
        nodeCount: system.features.reduce((acc, f) => acc + f.nodes.length, 0),
        onClick: () => flyToNode(system.id, SYSTEM_W, SYSTEM_H, 1.4),
        onShowDetail: () => showSystemDetail(system),
        onChatWith: () => createAgent('claude', system)
      }
    }))

    const seen = new Set<string>()
    const edges: Edge[] = []
    for (const e of map?.edges ?? []) {
      const a = nodeToSystem.get(e.from)
      const b = nodeToSystem.get(e.to)
      const key = `${a}->${b}`
      if (a && b && a !== b && !seen.has(key)) {
        seen.add(key)
        edges.push({ id: key, source: a, target: b, type: 'smoothstep', style: { stroke: 'var(--border-default)', strokeWidth: 1.5 } })
      }
    }

    const laid = nodes.length
      ? getLayoutedElements(nodes, edges, { direction: 'TB', nodeWidth: SYSTEM_W, nodeHeight: SYSTEM_H, spacing: 120 }).nodes
      : []
    const xs = laid.map((n) => n.position.x)
    const ys = laid.map((n) => n.position.y)
    const bounds = laid.length
      ? { minX: Math.min(...xs), maxX: Math.max(...xs) + SYSTEM_W, maxY: Math.max(...ys) + SYSTEM_H }
      : { minX: 0, maxX: 0, maxY: -200 }
    return { mapNodes: laid, mapEdges: edges, mapBounds: bounds }
  }, [systems, map, flyToNode, showSystemDetail, createAgent])

  // Agents sit in a row under the map, linked to the system they belong to.
  const agentNodes = useMemo<Node[]>(() => {
    const rowW = agents.length * AGENT_W + Math.max(0, agents.length - 1) * AGENT_GAP
    const startX = (mapBounds.minX + mapBounds.maxX) / 2 - rowW / 2
    return agents.map((agent, i) => ({
      id: agent.id,
      type: 'agent',
      position: dragged.current.get(agent.id) ?? { x: startX + i * (AGENT_W + AGENT_GAP), y: mapBounds.maxY + 240 },
      dragHandle: '.agent-node-header',
      width: AGENT_W,
      height: AGENT_H,
      data: { agentId: agent.id, onOpen: openAgent, onRemove: agentStore.remove }
    }))
    // Only structural changes (add/remove) re-layout; status ticks don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map((a) => a.id).join(','), mapBounds, openAgent])

  const agentEdges = useMemo<Edge[]>(
    () =>
      agents
        .filter((a) => a.systemId && systems.some((s) => s.id === a.systemId))
        .map((a) => ({
          id: `own-${a.id}`,
          source: a.systemId!,
          target: a.id,
          type: 'smoothstep',
          style: { stroke: systems.find((s) => s.id === a.systemId)?.color, strokeWidth: 2, strokeDasharray: '6 6', opacity: 0.7 }
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agents.map((a) => `${a.id}:${a.systemId}`).join(','), systems]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  useEffect(() => setNodes([...mapNodes, ...agentNodes]), [mapNodes, agentNodes, setNodes])
  const edges = useMemo(() => [...mapEdges, ...agentEdges], [mapEdges, agentEdges])

  // Fly to a newly created agent once its node exists.
  useEffect(() => {
    const id = pendingFocus.current
    if (id && nodes.some((n) => n.id === id)) {
      pendingFocus.current = null
      requestAnimationFrame(() => openAgent(id))
    }
  }, [nodes, openAgent])

  // --- Keyboard: Cmd/Ctrl+K palette. Esc is left alone (it interrupts agents).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      { id: 'overview', label: 'Overview', hint: 'See everything', run: overview },
      { id: 'new-claude', label: 'New Claude agent', hint: 'Unassigned', run: () => createAgent('claude') },
      { id: 'new-codex', label: 'New Codex agent', hint: 'Unassigned', run: () => createAgent('codex') },
      { id: 'new-shell', label: 'New shell', hint: 'Plain terminal', run: () => createAgent('shell') }
    ]
    for (const a of agents) items.push({ id: a.id, label: a.name, hint: `Agent · ${STATUS_LABEL[statusOf(a)]}`, dot: statusOf(a), run: () => openAgent(a.id) })
    for (const s of systems) items.push({ id: s.id, label: s.label, hint: 'System', run: () => flyToNode(s.id, SYSTEM_W, SYSTEM_H, 1.4) })
    return items
  }, [agents, systems, overview, createAgent, openAgent, flyToNode])

  const stripAgents = useMemo(() => {
    const now = Date.now()
    return [...agents].sort((a, b) => STATUS_ORDER[statusOf(a, now)] - STATUS_ORDER[statusOf(b, now)] || a.createdAt - b.createdAt)
  }, [agents])

  return (
    <div
      className="canvas-view"
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('react-flow__pane')) overview()
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_e, node) => dragged.current.set(node.id, node.position)}
        onPaneClick={() => focusedId && agentStore.focus(null)}
        nodeTypes={nodeTypes}
        nodesConnectable={false}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.05}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      />

      <AttentionStrip agents={stripAgents} focusedId={focusedId} onOpen={openAgent} onOverview={overview} onNew={createAgent} onPalette={() => setPaletteOpen(true)} />

      {!map && (
        <div className="canvas-hint">
          <strong>No map yet.</strong> Start a Claude agent and run <code>/origin</code> to map this project.
        </div>
      )}

      {paletteOpen && <CommandPalette items={paletteItems} onClose={() => setPaletteOpen(false)} />}
      {detail && <DetailPanel item={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

const MOD = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl+'

function AttentionStrip({
  agents,
  focusedId,
  onOpen,
  onOverview,
  onNew,
  onPalette
}: {
  agents: Agent[]
  focusedId: string | null
  onOpen: (id: string) => void
  onOverview: () => void
  onNew: (kind: AgentKind) => void
  onPalette: () => void
}) {
  return (
    <div className="attention-strip">
      <button className="strip-btn" onClick={onOverview} title="Zoom out to see everything (or double-click the canvas)">
        Overview
      </button>
      <button className="strip-btn" onClick={onPalette} title="Jump to anything">
        {MOD}K
      </button>
      <span className="strip-sep" />
      <button className="strip-btn" onClick={() => onNew('claude')}>+ Claude</button>
      <button className="strip-btn" onClick={() => onNew('codex')}>+ Codex</button>
      <button className="strip-btn" onClick={() => onNew('shell')}>+ Shell</button>
      {agents.length > 0 && <span className="strip-sep" />}
      <div className="strip-agents">
        {agents.map((a) => {
          const status = statusOf(a)
          return (
            <button
              key={a.id}
              className={`strip-chip chip-${status}${focusedId === a.id ? ' is-focused' : ''}`}
              onClick={() => onOpen(a.id)}
              title={`${a.name} · ${STATUS_LABEL[status]}`}
            >
              <span className={`agent-dot dot-${status}`} />
              {a.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
