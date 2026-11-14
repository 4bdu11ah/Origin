import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import type { CodeNode, EdgeType, Feature, MapEdge, NodeType, OriginMap, System } from '../../types/map'

// The codebase as a picture you can walk into. Three levels:
//   the product: its areas, the main journey left to right, the rest behind the scenes
//   an area: its parts, with where things come from and go to on either side
//   a part: its pieces, each kind with its own shape
// Everything reads in plain words first; the technical names are one toggle away.

export type Lang = 'plain' | 'tech'

export interface MapPath {
  systemId?: string
  featureId?: string
}

export const TILE = { w: 288, h: 188 }
export const PART = { w: 272, h: 176 }
export const PIECE = { w: 244, h: 116 }
export const GHOST = { w: 240, h: 58 }

export interface PieceKind {
  label: string
  icon: string
  shape: 'door' | 'step' | 'record' | 'guard' | 'block' | 'screen' | 'pill' | 'check'
}

export const PIECE_KIND: Record<NodeType, PieceKind> = {
  route: { label: 'Way in', icon: '🚪', shape: 'door' },
  function: { label: 'Step', icon: '⚙️', shape: 'step' },
  model: { label: 'Record', icon: '📋', shape: 'record' },
  type: { label: 'Shape of data', icon: '🏷️', shape: 'record' },
  middleware: { label: 'Guard', icon: '🛡️', shape: 'guard' },
  class: { label: 'Building block', icon: '🧱', shape: 'block' },
  component: { label: 'Screen part', icon: '🖼️', shape: 'screen' },
  hook: { label: 'Helper', icon: '🪝', shape: 'pill' },
  config: { label: 'Setting', icon: '🎛️', shape: 'pill' },
  test: { label: 'Check', icon: '✅', shape: 'check' }
}

const VERB: Record<EdgeType, string> = {
  calls: 'uses',
  imports: 'uses',
  renders: 'shows',
  'data-flow': 'passes data to',
  navigates: 'goes to',
  extends: 'builds on',
  emits: 'sends to',
  configures: 'sets up'
}

export const titleOf = (x: { label: string; title?: string }, lang: Lang): string => (lang === 'plain' ? x.title || x.label : x.label)
export const summaryOf = (x: { description: string; summary?: string }, lang: Lang): string =>
  lang === 'plain' ? x.summary || x.description : x.description
export const edgeText = (e: MapEdge): string => e.plain || e.label || VERB[e.type] || ''
export const systemIcon = (s: System): string => s.icon || '📦'
export const featureIcon = (f: Feature): string => f.icon || '🧩'

export interface MapIndex {
  map: OriginMap
  systems: System[]
  system: Map<string, System>
  feature: Map<string, Feature>
  piece: Map<string, CodeNode>
  systemOf: Map<string, System>
  featureOf: Map<string, Feature>
}

export function indexMap(map: OriginMap, systems: System[]): MapIndex {
  const ix: MapIndex = { map, systems, system: new Map(), feature: new Map(), piece: new Map(), systemOf: new Map(), featureOf: new Map() }
  for (const s of systems) {
    ix.system.set(s.id, s)
    for (const f of s.features) {
      ix.feature.set(f.id, f)
      ix.systemOf.set(f.id, s)
      for (const n of f.nodes) {
        ix.piece.set(n.id, n)
        ix.systemOf.set(n.id, s)
        ix.featureOf.set(n.id, f)
      }
    }
  }
  return ix
}

/** Keep a path only as deep as the map still goes. */
export function validPath(ix: MapIndex, path: MapPath): MapPath {
  if (!path.systemId || !ix.system.has(path.systemId)) return {}
  if (path.featureId && ix.systemOf.get(path.featureId)?.id === path.systemId) return path
  return { systemId: path.systemId }
}

// --- Scene --------------------------------------------------------------------

export type LinkKind = 'journey' | 'link' | 'context'
export interface LinkData extends Record<string, unknown> {
  kind: LinkKind
  text: string
  /** Every edge this link stands for, so hovering can explain it. */
  count: number
}

export interface Scene {
  nodes: Node[]
  edges: Edge[]
}

interface Box {
  id: string
  w: number
  h: number
}

interface Link {
  from: string
  to: string
  text: string
  kind: LinkKind
  count: number
}

/** Collapse many edges into one link per pair, labelled with the most common words. */
function collapse(pairs: { from: string; to: string; text: string }[], kind: (from: string, to: string) => LinkKind): Link[] {
  const byPair = new Map<string, { from: string; to: string; texts: Map<string, number>; count: number }>()
  for (const p of pairs) {
    if (p.from === p.to) continue
    const key = `${p.from}->${p.to}`
    const entry = byPair.get(key) ?? { from: p.from, to: p.to, texts: new Map(), count: 0 }
    entry.count++
    if (p.text) entry.texts.set(p.text, (entry.texts.get(p.text) ?? 0) + 1)
    byPair.set(key, entry)
  }
  return [...byPair.values()].map((e) => {
    const text = [...e.texts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    return { from: e.from, to: e.to, text, count: e.count, kind: kind(e.from, e.to) }
  })
}

/** Left-to-right layers for linked boxes; anything unlinked sits in a tidy row underneath. */
function layered(boxes: Box[], links: Link[], gap = { node: 56, rank: 150 }): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>()
  const linked = new Set(links.flatMap((l) => [l.from, l.to]))
  const conn = boxes.filter((b) => linked.has(b.id))
  const loose = boxes.filter((b) => !linked.has(b.id))
  let bottom = 0
  let left = 0
  let right = 0
  if (conn.length) {
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph({ rankdir: 'LR', nodesep: gap.node, ranksep: gap.rank, marginx: 0, marginy: 0 })
    for (const b of conn) g.setNode(b.id, { width: b.w, height: b.h })
    for (const l of links) g.setEdge(l.from, l.to)
    dagre.layout(g)
    left = Infinity
    right = -Infinity
    for (const b of conn) {
      const n = g.node(b.id)
      const p = { x: n.x - b.w / 2, y: n.y - b.h / 2 }
      pos.set(b.id, p)
      bottom = Math.max(bottom, p.y + b.h)
      left = Math.min(left, p.x)
      right = Math.max(right, p.x + b.w)
    }
  }
  if (loose.length) {
    const cols = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(loose.length * 1.6))))
    const w = Math.max(...loose.map((b) => b.w))
    const h = Math.max(...loose.map((b) => b.h))
    const rowW = cols * w + (cols - 1) * 40
    const startX = conn.length ? (left + right) / 2 - rowW / 2 : 0
    const startY = conn.length ? bottom + 120 : 0
    loose.forEach((b, i) => pos.set(b.id, { x: startX + (i % cols) * (w + 40), y: startY + Math.floor(i / cols) * (h + 40) }))
  }
  return pos
}

const SIDE = { right: 'right', left: 'left', top: 'top', bottom: 'bottom' } as const
type Rect = { x: number; y: number; w: number; h: number }

/**
 * Lines leave from the side facing their target. Forward links run right to
 * left; anything in the same column goes straight up or down, so lines never
 * loop around a box.
 */
function sides(a: Rect, b: Rect) {
  if (b.x >= a.x + a.w - 8) return [SIDE.right, SIDE.left]
  if (b.x + b.w <= a.x + 8) return [SIDE.left, SIDE.right]
  return b.y >= a.y ? [SIDE.bottom, SIDE.top] : [SIDE.top, SIDE.bottom]
}

function toScene(
  items: (Box & { type: string; data: Record<string, unknown> })[],
  links: Link[],
  pos: Map<string, { x: number; y: number }>,
  extra: Node[] = []
): Scene {
  const nodes: Node[] = items.map((b) => ({
    id: b.id,
    type: b.type,
    position: pos.get(b.id) ?? { x: 0, y: 0 },
    width: b.w,
    height: b.h,
    draggable: false,
    selectable: false,
    data: b.data
  }))
  const box = new Map(items.map((b) => [b.id, { ...(pos.get(b.id) ?? { x: 0, y: 0 }), w: b.w, h: b.h }]))
  const edges: Edge[] = links
    .filter((l) => box.has(l.from) && box.has(l.to))
    .map((l) => {
      const [s, t] = sides(box.get(l.from)!, box.get(l.to)!)
      return {
        id: `${l.from}->${l.to}`,
        source: l.from,
        target: l.to,
        sourceHandle: `s-${s}`,
        targetHandle: `t-${t}`,
        type: 'map',
        className: `map-link is-${l.kind}`,
        data: { kind: l.kind, text: l.text, count: l.count } satisfies LinkData
      }
    })
  return { nodes: [...extra, ...nodes], edges }
}

/** A soft, labelled region behind a group of boxes. */
function zone(id: string, boxes: Rect[], plain: string, tech: string, pad = 22): Node {
  const x = Math.min(...boxes.map((b) => b.x)) - pad
  const y = Math.min(...boxes.map((b) => b.y)) - pad - 26
  const w = Math.max(...boxes.map((b) => b.x + b.w)) + pad - x
  const h = Math.max(...boxes.map((b) => b.y + b.h)) + pad - y
  return { id, type: 'zone', position: { x, y }, width: w, height: h, zIndex: -1, draggable: false, selectable: false, data: { plain, tech } }
}

const pieceCount = (s: System) => s.features.reduce((n, f) => n + f.nodes.length, 0)

/** Links between areas: the map's own flows, or worked out from the code's edges. */
export function systemLinks(ix: MapIndex): Link[] {
  const flows = (ix.map.flows ?? []).filter((f) => ix.system.has(f.from) && ix.system.has(f.to))
  const kind = (from: string, to: string): LinkKind => {
    const a = ix.system.get(from)!
    const b = ix.system.get(to)!
    return a.lane === 'main' && b.lane === 'main' && a.order != null && b.order === a.order + 1 ? 'journey' : 'link'
  }
  if (flows.length) return collapse(flows.map((f) => ({ from: f.from, to: f.to, text: f.label })), kind)
  const pairs = ix.map.edges.flatMap((e) => {
    const a = ix.systemOf.get(e.from)
    const b = ix.systemOf.get(e.to)
    return a && b && a !== b ? [{ from: a.id, to: b.id, text: edgeText(e) }] : []
  })
  return collapse(pairs, kind)
}

function productScene(ix: MapIndex): Scene {
  const main = ix.systems.filter((s) => s.lane === 'main').sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const support = ix.systems.filter((s) => s.lane !== 'main')
  const links = systemLinks(ix)
  const items = ix.systems.map((s) => ({
    id: s.id,
    w: TILE.w,
    h: TILE.h,
    type: 'area',
    data: { systemId: s.id, step: s.lane === 'main' ? main.indexOf(s) + 1 : null, parts: s.features.length, pieces: pieceCount(s) }
  }))

  if (!main.length) return toScene(items, links, layered(items, links, { node: 64, rank: 170 }))

  // The journey reads like a path: left to right, then back the other way on
  // the next row, numbered so the order is never in doubt.
  const GAP_X = 132
  const GAP_Y = 110
  const perRow = main.length <= 5 ? main.length : Math.ceil(main.length / 2)
  const rows = Math.ceil(main.length / perRow)
  const pos = new Map<string, { x: number; y: number }>()
  main.forEach((s, i) => {
    const row = Math.floor(i / perRow)
    const col = row % 2 ? perRow - 1 - (i % perRow) : i % perRow
    pos.set(s.id, { x: col * (TILE.w + GAP_X), y: row * (TILE.h + GAP_Y) })
  })
  const mainW = perRow * TILE.w + (perRow - 1) * GAP_X
  const supPerRow = Math.max(perRow, 4)
  const supY = rows * (TILE.h + GAP_Y) + 40
  support.forEach((s, i) => {
    const row = Math.floor(i / supPerRow)
    const inRow = Math.min(supPerRow, support.length - row * supPerRow)
    const rowW = inRow * TILE.w + (inRow - 1) * 40
    pos.set(s.id, { x: mainW / 2 - rowW / 2 + (i % supPerRow) * (TILE.w + 40), y: supY + row * (TILE.h + 40) })
  })
  const extra = support.length
    ? [zone('zone-support', support.map((s) => ({ ...pos.get(s.id)!, w: TILE.w, h: TILE.h })), 'Behind the scenes', 'Supporting systems', 26)]
    : []
  return toScene(items, links, pos, extra)
}

/** Neighbours just outside this view: areas or parts that send things in or take things out. */
function ghost(id: string, dir: 'in' | 'out', target: MapPath) {
  return { id, w: GHOST.w, h: GHOST.h, type: 'ghost', data: { dir, target, systemId: target.systemId, featureId: target.featureId } }
}

/**
 * Inside an area or a part: what comes in on the left, the inside in the
 * middle (left to right in the order things happen), what goes out on the right.
 */
function framed(
  inner: (Box & { type: string; data: Record<string, unknown> })[],
  ghosts: Map<string, ReturnType<typeof ghost>>,
  pairs: { from: string; to: string; text: string }[],
  gap: { node: number; rank: number }
): Scene {
  const links = collapse(pairs, (from, to) => (from.startsWith('in:') || to.startsWith('out:') ? 'context' : 'link'))
  // Lay everything out together so the inside lines up with what feeds it,
  // then move the neighbours out into their own columns.
  const pos = layered([...inner, ...ghosts.values()], links, gap)
  for (const id of ghosts.keys()) pos.delete(id)

  const rects = inner.map((b) => ({ ...pos.get(b.id)!, w: b.w, h: b.h }))
  const minX = Math.min(...rects.map((r) => r.x))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))

  // Each neighbour sits level with what it touches, so lines stay short and flat.
  const reach = (gid: string) => {
    const ys = links
      .filter((l) => l.from === gid || l.to === gid)
      .map((l) => (l.from === gid ? l.to : l.from))
      .filter((id) => pos.has(id))
      .map((id) => pos.get(id)!.y + (inner.find((b) => b.id === id)?.h ?? 0) / 2)
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : (minY + maxY) / 2
  }
  const COL_GAP = 150
  const extra: Node[] = []
  for (const dir of ['in', 'out'] as const) {
    const col = [...ghosts.values()].filter((g) => g.data.dir === dir).sort((a, b) => reach(a.id) - reach(b.id))
    if (!col.length) continue
    const x = dir === 'in' ? minX - COL_GAP - GHOST.w : maxX + COL_GAP
    // A tight stack, ordered like what it touches, centred on it.
    const mid = col.reduce((n, g) => n + reach(g.id), 0) / col.length
    const stackH = col.length * GHOST.h + (col.length - 1) * 14
    const top = Math.max(minY - 40, Math.min(mid - stackH / 2, maxY + 40 - stackH))
    col.forEach((g, i) => pos.set(g.id, { x, y: top + i * (GHOST.h + 14) }))
    extra.push(
      zone(
        `zone-${dir}`,
        col.map((g) => ({ ...pos.get(g.id)!, w: GHOST.w, h: GHOST.h })),
        dir === 'in' ? 'Comes from' : 'Goes to',
        dir === 'in' ? 'Inputs' : 'Outputs',
        16
      )
    )
  }
  return toScene([...inner, ...ghosts.values()], links, pos, extra)
}

function areaScene(ix: MapIndex, system: System): Scene {
  const inSys = (id: string) => ix.systemOf.get(id)?.id === system.id
  const parts = system.features.map((f) => ({ id: f.id, w: PART.w, h: PART.h, type: 'part', data: { featureId: f.id, pieces: f.nodes.length } }))
  const pairs: { from: string; to: string; text: string }[] = []
  const ghosts = new Map<string, ReturnType<typeof ghost>>()
  for (const e of ix.map.edges) {
    const a = ix.systemOf.get(e.from)
    const b = ix.systemOf.get(e.to)
    if (!a || !b) continue
    const fa = ix.featureOf.get(e.from)!.id
    const fb = ix.featureOf.get(e.to)!.id
    if (inSys(e.from) && inSys(e.to)) pairs.push({ from: fa, to: fb, text: edgeText(e) })
    else if (inSys(e.to)) {
      const id = `in:${a.id}`
      ghosts.set(id, ghost(id, 'in', { systemId: a.id }))
      pairs.push({ from: id, to: fb, text: edgeText(e) })
    } else if (inSys(e.from)) {
      const id = `out:${b.id}`
      ghosts.set(id, ghost(id, 'out', { systemId: b.id }))
      pairs.push({ from: fa, to: id, text: edgeText(e) })
    }
  }
  return framed(parts, ghosts, pairs, { node: 48, rank: 150 })
}

function partScene(ix: MapIndex, system: System, feature: Feature): Scene {
  const inPart = (id: string) => ix.featureOf.get(id)?.id === feature.id
  const pieces = feature.nodes.map((n) => ({ id: n.id, w: PIECE.w, h: PIECE.h, type: 'piece', data: { pieceId: n.id } }))
  const pairs: { from: string; to: string; text: string }[] = []
  const ghosts = new Map<string, ReturnType<typeof ghost>>()
  const outside = (nodeId: string, dir: 'in' | 'out') => {
    const s = ix.systemOf.get(nodeId)!
    const f = ix.featureOf.get(nodeId)!
    // A sibling part is shown by name; anything further away by its area.
    const target = s.id === system.id ? { systemId: s.id, featureId: f.id } : { systemId: s.id }
    const id = `${dir}:${target.featureId ?? target.systemId}`
    if (!ghosts.has(id)) ghosts.set(id, ghost(id, dir, target))
    return id
  }
  for (const e of ix.map.edges) {
    if (!ix.piece.has(e.from) || !ix.piece.has(e.to)) continue
    if (inPart(e.from) && inPart(e.to)) pairs.push({ from: e.from, to: e.to, text: edgeText(e) })
    else if (inPart(e.to)) pairs.push({ from: outside(e.from, 'in'), to: e.to, text: edgeText(e) })
    else if (inPart(e.from)) pairs.push({ from: e.from, to: outside(e.to, 'out'), text: edgeText(e) })
  }
  return framed(pieces, ghosts, pairs, { node: 36, rank: 130 })
}

export function buildScene(ix: MapIndex, path: MapPath): Scene {
  const system = path.systemId ? ix.system.get(path.systemId) : undefined
  const feature = path.featureId ? ix.feature.get(path.featureId) : undefined
  if (system && feature) return partScene(ix, system, feature)
  if (system) return areaScene(ix, system)
  return productScene(ix)
}

// --- Prompts for agents sent to look at a place on the map ---------------------

export function askPrompt(ix: MapIndex, path: MapPath, pieceId?: string | null): string {
  const piece = pieceId ? ix.piece.get(pieceId) : undefined
  if (piece) {
    return `Explain "${piece.label}" (${piece.file}:${piece.line}) in plain words: what it does for users, what depends on it, and anything that looks risky. Keep it short.`
  }
  const feature = path.featureId ? ix.feature.get(path.featureId) : undefined
  if (feature) {
    const list = feature.nodes.map((n) => `- ${n.label} (${n.file}): ${n.description}`).join('\n')
    return `You are looking at the "${feature.label}" part of this project.\n${feature.description}\n\nPieces:\n${list}\n\nGive me a short plain-words overview of this part and anything that looks risky.`
  }
  const system = path.systemId ? ix.system.get(path.systemId) : undefined
  if (system) {
    const list = system.features.map((f) => `- ${f.label}: ${f.description}`).join('\n')
    return `You are working on the "${system.label}" system of this project.\n${system.description}\n\nFeatures:\n${list}\n\nStart by giving me a short overview of this system and anything that looks risky.`
  }
  return 'Give me a short plain-words overview of this project: what it does, its main parts, and anything that looks risky.'
}

export function workPrompt(ix: MapIndex, pieceId: string): string {
  const p = ix.piece.get(pieceId)!
  return `We're going to change "${p.title || p.label}" (${p.label} in ${p.file}:${p.line}). Read it, tell me in two plain sentences what it does today, then ask me what I want changed.`
}
