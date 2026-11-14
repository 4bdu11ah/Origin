import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Background, BackgroundVariant, MarkerType, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { OriginMap, System } from '../../types/map'
import { useSettings } from '../../contexts/SettingsContext'
import { FileChangesContext, STATUS_LABEL, type FileChange } from './agentStatus'
import { AgentSpace, setAgentTab } from './AgentSpace'
import { ActivityContext, sampleActivity, type AgentActivity } from './agentActivity'
import { agentStore, statusOf, useAgents, type Agent, type AgentKind } from './agentStore'
import { CommandPalette, type PaletteItem } from './CommandPalette'
import { Avatar } from './Avatar'
import { displayName, personaFor } from './personas'
import { useWorkspace, type Screen } from '../Workspace/WorkspaceContext'
import { askPrompt, buildScene, indexMap, titleOf, validPath, workPrompt, type Lang, type LinkData, type MapPath } from './mapScene'
import { MapLiveContext, mapNodeTypes, type MapLive } from './MapNodes'
import { LangSwitch, MapHeader, PiecePanel, ShapeKey } from './MapChrome'
import './Canvas.css'
import './Map.css'

const STATUS_ORDER = { 'needs-you': 0, error: 1, unread: 2, working: 3, idle: 4, exited: 5 } as const
/** A file counts as "changing now" for this long after its last write. */
const CHANGING_MS = 3 * 60_000

interface CanvasViewProps {
  map: OriginMap | null
  projectPath: string
  /** The canvas is the screen showing (it stays mounted, hidden, behind other screens). */
  active: boolean
}

export function CanvasView(props: CanvasViewProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  )
}

const SCREEN_ITEMS: { id: Screen; label: string }[] = [
  { id: 'board', label: 'Board' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'releases', label: 'Releases' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'team', label: 'Team' },
  { id: 'connections', label: 'Connections' },
  { id: 'chief', label: 'Chief of staff' }
]

function readJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* per-viewer convenience only */
  }
}

function Canvas({ map, projectPath }: CanvasViewProps) {
  const { setScreen } = useWorkspace()
  const { settings } = useSettings()
  const { agents, closed, focusedId } = useAgents()
  const rf = useReactFlow()
  const paneW = useStore((s) => s.width)
  const paneH = useStore((s) => s.height)
  // null = closed; otherwise the palette's starting query.
  const [palette, setPalette] = useState<string | null>(null)
  const pendingOpen = useRef<string | null>(null)
  const [insideId, setInsideId] = useState<string | null>(null)
  const [changes, setChanges] = useState<FileChange[]>([])
  const pathKey = `origin.mapPath:${projectPath}`
  const [path, setPath] = useState<MapPath>(() => readJSON(pathKey, {}))
  const [lang, setLang] = useState<Lang>(() => readJSON<Lang>('origin.mapLang', 'plain'))
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => writeJSON(pathKey, path), [pathKey, path])
  useEffect(() => writeJSON('origin.mapLang', lang), [lang])

  // Poll project file changes since the oldest agent started (cheap: main keeps them in memory).
  const oldestAgent = agents.reduce((min, a) => Math.min(min, a.createdAt), Infinity)
  useEffect(() => {
    if (!Number.isFinite(oldestAgent)) {
      setChanges([])
      return
    }
    let cancelled = false
    const poll = () => window.api.files.changedSince(oldestAgent).then((c) => !cancelled && setChanges(c))
    poll()
    const t = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [oldestAgent])

  // Leave the agent space if its agent goes away.
  useEffect(() => {
    if (insideId && !agents.some((a) => a.id === insideId)) setInsideId(null)
  }, [agents, insideId])

  const systems = useMemo<System[]>(() => {
    if (!map) return []
    return map.systems.map((s, i) => ({ ...s, color: settings.graphPalette[i % settings.graphPalette.length] || s.color }))
  }, [map, settings.graphPalette])
  const ix = useMemo(() => (map ? indexMap(map, systems) : null), [map, systems])
  const here = useMemo(() => (ix ? validPath(ix, path) : {}), [ix, path])
  const scene = useMemo(() => (ix ? buildScene(ix, here) : { nodes: [], edges: [] }), [ix, here])

  // --- Moving around the map ---------------------------------------------------
  // Room at the top for the header card, so nothing hides behind it.
  // With a piece open, keep clear of its card on the right.
  const panelOpen = useRef(false)
  const fit = useCallback(
    (duration = 0) =>
      rf.fitView({ padding: { top: '236px', bottom: '48px', left: '48px', right: panelOpen.current ? '400px' : '48px' }, maxZoom: 1.15, duration }),
    [rf]
  )

  // Step in (zoom toward what was clicked) or out (zoom away), fade, then swap the view.
  const go = useCallback(
    (next: MapPath, fromNode?: string) => {
      const node = fromNode ? rf.getNode(fromNode) : undefined
      const zoom = rf.getZoom()
      if (node) {
        rf.setCenter(node.position.x + (node.width ?? 0) / 2, node.position.y + (node.height ?? 0) / 2, { zoom: Math.min(zoom * 2.4, 3), duration: 320 })
      } else {
        const vp = rf.getViewport()
        rf.setViewport({ x: vp.x + (paneW * (1 - 0.55)) / 2, y: vp.y + (paneH * (1 - 0.55)) / 2, zoom: zoom * 0.55 }, { duration: 320 })
      }
      setFading(true)
      setHovered(null)
      setTimeout(() => {
        setSelected(null)
        setPath(next)
      }, 240)
    },
    [rf, paneW, paneH]
  )

  // A new view fits itself, then fades in.
  useEffect(() => {
    let raf2 = 0
    const raf = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        fit()
        setFading(false)
      })
    })
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(raf2)
    }
  }, [scene, fit])

  // Keep the view fitted when the window or a side panel changes size.
  useEffect(() => {
    if (paneW && paneH) fit()
  }, [paneW, paneH, fit])

  useEffect(() => {
    if (panelOpen.current === !!selected) return
    panelOpen.current = !!selected
    fit(300)
  }, [selected, fit])

  const up = useCallback(() => {
    if (here.featureId) go({ systemId: here.systemId })
    else if (here.systemId) go({})
    else fit(400)
  }, [here, go, fit])

  // Jump to a piece anywhere: open its part first if it lives elsewhere.
  const selectPiece = useCallback(
    (pieceId: string) => {
      if (!ix) return
      const f = ix.featureOf.get(pieceId)
      const s = ix.systemOf.get(pieceId)
      if (!f || !s) return
      if (here.featureId === f.id) setSelected(pieceId)
      else {
        go({ systemId: s.id, featureId: f.id })
        setTimeout(() => setSelected(pieceId), 300)
      }
    },
    [ix, here, go]
  )

  // --- Agents --------------------------------------------------------------------
  const openAgent = useCallback((id: string) => {
    agentStore.focus(id)
    setInsideId(id)
  }, [])

  const createAgent = useCallback(
    (kind: AgentKind, opts: { system?: System; prompt?: string } = {}) => {
      const id = agentStore.create(kind, { systemId: opts.system?.id ?? null, systemLabel: opts.system?.label, prompt: opts.prompt })
      setAgentTab(id, 'terminal')
      pendingOpen.current = id
    },
    []
  )

  // Open a newly created agent once the store has it.
  useEffect(() => {
    const id = pendingOpen.current
    if (id && agents.some((a) => a.id === id)) {
      pendingOpen.current = null
      openAgent(id)
    }
  }, [agents, openAgent])

  const closeAgent = useCallback(() => {
    setInsideId(null)
    agentStore.focus(null)
  }, [])

  const overview = useCallback(() => {
    setInsideId(null)
    agentStore.focus(null)
    if (here.systemId) go({})
    else fit(400)
  }, [here, go, fit])

  const ask = useCallback(
    (pieceId?: string | null) => {
      if (!ix) return createAgent('claude')
      const sys = here.systemId ? ix.system.get(here.systemId) : pieceId ? ix.systemOf.get(pieceId) : undefined
      createAgent('claude', { system: sys, prompt: askPrompt(ix, here, pieceId) })
    },
    [ix, here, createAgent]
  )

  // Preview: sample activity per agent until hooks and the board feed real data.
  const activities = useMemo(() => {
    const ctx = { projectPath, systems: systems.map((s) => ({ id: s.id, label: s.label, color: s.color })), agents }
    return new Map<string, AgentActivity>(agents.map((a) => [a.id, sampleActivity(a, ctx)]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.map((a) => `${a.id}:${a.name}:${a.systemId}`).join(','), systems, projectPath])

  // Where each agent works: its own area, or (preview) the first area its activity touches.
  const agentsIn = useMemo(() => {
    const by = new Map<string, Agent[]>()
    for (const a of agents) {
      const sid = a.systemId ?? activities.get(a.id)?.systems[0]?.id
      if (!sid || !ix?.system.has(sid)) continue
      by.set(sid, [...(by.get(sid) ?? []), a])
    }
    return by
  }, [agents, activities, ix])

  // Code changed in the last few minutes lights up its piece, part and area.
  const changing = useMemo(() => {
    const ids = new Set<string>()
    if (!ix) return ids
    const recent = new Set(changes.filter((c) => Date.now() - c.at < CHANGING_MS).map((c) => c.path))
    if (!recent.size) return ids
    for (const [id, n] of ix.piece) {
      if (!recent.has(n.file)) continue
      ids.add(id)
      ids.add(ix.featureOf.get(id)!.id)
      ids.add(ix.systemOf.get(id)!.id)
    }
    return ids
  }, [changes, ix])

  const live = useMemo<MapLive | null>(
    () => (ix ? { ix, lang, agentsIn, changing, selected, onOpenAgent: openAgent } : null),
    [ix, lang, agentsIn, changing, selected, openAgent]
  )

  // Lines stay quiet until you point at something; then its lines and their words come forward.
  const edges = useMemo<Edge[]>(() => {
    const focus = hovered ?? selected
    return scene.edges.map((e) => {
      const d = e.data as LinkData
      const lit = !!focus && (e.source === focus || e.target === focus)
      const showText = !!d.text && (d.kind === 'journey' || lit || !!here.systemId)
      return {
        ...e,
        animated: d.kind === 'journey',
        // On the product view only the journey shows; other links appear when you point at an area.
        className: `${e.className}${lit ? ' is-lit' : ''}${focus && !lit ? ' is-dim' : ''}${!here.systemId && d.kind === 'link' && !lit ? ' is-hidden' : ''}`,
        label: showText ? d.text : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: d.kind === 'journey' ? 'var(--accent)' : 'var(--text-tertiary)' },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 8
      }
    })
  }, [scene.edges, hovered, selected, here.systemId])

  // --- Keyboard: Cmd/Ctrl+K palette. Esc is left alone (it interrupts agents).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setPalette((p) => (p === null ? '' : null))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      { id: 'overview', label: 'Overview', hint: 'The whole product', run: overview },
      { id: 'new-claude', label: 'New Claude agent', hint: 'Unassigned', run: () => createAgent('claude') },
      { id: 'new-codex', label: 'New Codex agent', hint: 'Unassigned', run: () => createAgent('codex') },
      { id: 'new-shell', label: 'New shell', hint: 'Plain terminal', run: () => createAgent('shell') }
    ]
    for (const a of agents) items.push({ id: a.id, label: displayName(personaFor(a.id), a.name), hint: `Agent · ${STATUS_LABEL[statusOf(a)]}`, dot: statusOf(a), run: () => openAgent(a.id) })
    if (ix) {
      for (const s of ix.systems) {
        items.push({ id: s.id, label: titleOf(s, lang), hint: 'Area', run: () => (setInsideId(null), go({ systemId: s.id })) })
        for (const f of s.features) items.push({ id: f.id, label: titleOf(f, lang), hint: `Part of ${titleOf(s, lang)}`, run: () => (setInsideId(null), go({ systemId: s.id, featureId: f.id })) })
      }
    }
    for (const c of closed) {
      items.push({
        id: `reopen-${c.id}`,
        label: `Reopen ${displayName(personaFor(c.id), c.name)}`,
        hint: `Stopped ${ago(c.closedAt ?? Date.now())}`,
        run: () => {
          const id = agentStore.reopen(c.id)
          if (id) pendingOpen.current = id
        }
      })
    }
    // Anything on the canvas brings the canvas forward first; screens just switch.
    const canvasItems = items.map((i) => ({ ...i, run: () => (setScreen('canvas'), i.run()) }))
    const screenItems = SCREEN_ITEMS.map((s) => ({ id: `screen-${s.id}`, label: s.label, hint: 'Screen', run: () => setScreen(s.id) }))
    return [...canvasItems.slice(0, 1), { id: 'screen-canvas', label: 'Canvas', hint: 'Screen', run: () => setScreen('canvas') }, ...screenItems, ...canvasItems.slice(1)]
  }, [agents, closed, ix, lang, overview, createAgent, openAgent, go, setScreen])

  const stripAgents = useMemo(() => {
    const now = Date.now()
    return [...agents].sort((a, b) => STATUS_ORDER[statusOf(a, now)] - STATUS_ORDER[statusOf(b, now)] || a.createdAt - b.createdAt)
  }, [agents])

  const insideAgent = insideId ? agents.find((a) => a.id === insideId) : undefined
  const pieceTypes = useMemo(() => (ix && here.featureId ? ix.feature.get(here.featureId)!.nodes.map((n) => n.type) : []), [ix, here.featureId])

  return (
    <FileChangesContext.Provider value={changes}>
    <ActivityContext.Provider value={activities}>
    <MapLiveContext.Provider value={live}>
    <div
      className={`canvas-view${fading ? ' is-fading' : ''}${selected ? ' has-panel' : ''}`}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement
        if (target.classList.contains('react-flow__pane') && !target.closest('.agent-space')) up()
      }}
    >
      {ix && (
        <ReactFlow
          nodes={scene.nodes}
          edges={edges}
          nodeTypes={mapNodeTypes}
          nodesConnectable={false}
          nodesDraggable={false}
          elementsSelectable={false}
          onNodeClick={(_e, node) => {
            if (node.type === 'area') go({ systemId: node.id }, node.id)
            else if (node.type === 'part') go({ systemId: here.systemId, featureId: node.id }, node.id)
            else if (node.type === 'piece') setSelected((s) => (s === node.id ? null : node.id))
            else if (node.type === 'ghost') go((node.data as { target: MapPath }).target, node.id)
          }}
          onNodeMouseEnter={(_e, node) => setHovered(node.id)}
          onNodeMouseLeave={() => setHovered(null)}
          onPaneClick={() => {
            setSelected(null)
            if (focusedId) agentStore.focus(null)
          }}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1.2} color="var(--border-subtle)" />
        </ReactFlow>
      )}

      {ix && (
        <>
          <MapHeader ix={ix} path={here} lang={lang} agents={here.systemId ? agentsIn.get(here.systemId) ?? [] : []} onGo={(p) => go(p)} onAsk={() => ask(null)} onOpenAgent={openAgent} />
          <div className="map-corner">
            {here.systemId && (
              <button className="map-up" onClick={up} title="Go up a level (or double-click empty space)">
                ↑ Up
              </button>
            )}
            <LangSwitch lang={lang} onChange={setLang} />
          </div>
          {here.featureId && <ShapeKey types={pieceTypes} />}
          {selected && (
            <PiecePanel
              ix={ix}
              pieceId={selected}
              lang={lang}
              onClose={() => setSelected(null)}
              onSelect={selectPiece}
              onAsk={() => ask(selected)}
              onWork={() => createAgent('claude', { system: ix.systemOf.get(selected), prompt: workPrompt(ix, selected) })}
            />
          )}
        </>
      )}

      <AttentionStrip
        agents={stripAgents}
        closedCount={closed.length}
        focusedId={focusedId}
        onOpen={openAgent}
        onOverview={overview}
        onNew={(k) => createAgent(k)}
        onPalette={() => setPalette('')}
        onReopen={() => setPalette('Reopen ')}
        onStop={agentStore.remove}
      />

      {!map && (
        <div className="map-empty">
          <span className="map-empty-icon">🗺️</span>
          <h2>No map of this project yet</h2>
          <p>An agent reads the code once and draws it as areas, parts and pieces, in plain words. It takes a few minutes.</p>
          <button className="btn-primary" onClick={() => createAgent('claude', { prompt: '/origin' })}>
            Draw the map
          </button>
        </div>
      )}

      {insideAgent && activities.get(insideAgent.id) && (
        <AgentSpace key={insideAgent.id} agent={insideAgent} activity={activities.get(insideAgent.id)!} onBack={closeAgent} onOpenAgent={openAgent} />
      )}
      {/* Portal: ⌘K works from every screen, even while the canvas is hidden. */}
      {palette !== null && createPortal(<CommandPalette items={paletteItems} initialQuery={palette} onClose={() => setPalette(null)} />, document.body)}
    </div>
    </MapLiveContext.Provider>
    </ActivityContext.Provider>
    </FileChangesContext.Provider>
  )
}

const MOD = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl+'

function ago(at: number): string {
  const m = Math.round((Date.now() - at) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

function AttentionStrip({
  agents,
  closedCount,
  focusedId,
  onOpen,
  onOverview,
  onNew,
  onPalette,
  onReopen,
  onStop
}: {
  agents: Agent[]
  closedCount: number
  focusedId: string | null
  onOpen: (id: string) => void
  onOverview: () => void
  onNew: (kind: AgentKind) => void
  onPalette: () => void
  onReopen: () => void
  onStop: (id: string) => void
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
      {closedCount > 0 && (
        <button className="strip-btn strip-reopen" onClick={onReopen} title="Reopen a stopped agent; its conversation resumes">
          ↺ {closedCount}
        </button>
      )}
      {agents.length > 0 && <span className="strip-sep" />}
      <div className="strip-agents">
        {agents.map((a) => {
          const status = statusOf(a)
          return (
            <span key={a.id} className="strip-chip-wrap" data-id={a.id} data-hook={a.hook ?? ''} data-status={STATUS_LABEL[status]} data-created={a.createdAt}>
              <button
                className={`strip-chip chip-${status}${focusedId === a.id ? ' is-focused' : ''}`}
                onClick={() => onOpen(a.id)}
                title={`${a.name} · ${STATUS_LABEL[status]}`}
              >
                <Avatar persona={personaFor(a.id)} size={18} />
                {displayName(personaFor(a.id), a.name)}
                <span className={`agent-dot dot-${status}`} />
              </button>
              <button className="strip-chip-close" onClick={() => onStop(a.id)} title="Stop this agent" aria-label={`Stop ${a.name}`}>
                ×
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
