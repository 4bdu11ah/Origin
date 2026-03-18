export type NodeType =
  | 'component'
  | 'function'
  | 'route'
  | 'model'
  | 'middleware'
  | 'class'
  | 'hook'
  | 'config'
  | 'type'
  | 'test'

export type EdgeType =
  | 'calls'
  | 'imports'
  | 'renders'
  | 'data-flow'
  | 'navigates'
  | 'extends'

export interface CodeNode {
  id: string
  label: string
  type: NodeType
  file: string
  line: number
  description: string
}

export interface Feature {
  id: string
  label: string
  description: string
  nodes: CodeNode[]
}

export interface System {
  id: string
  label: string
  description: string
  color: string
  features: Feature[]
}

export interface MapEdge {
  from: string
  to: string
  type: EdgeType
  label?: string
}

export interface OriginMap {
  version: string
  project: {
    name: string
    description: string
  }
  systems: System[]
  edges: MapEdge[]
}

export interface OriginMeta {
  lastRunCommit: string
  lastRunTimestamp: string
  generatedSystems: string[]
  pendingSystems: string[]
}

export type ZoomLevel = 'project' | 'system' | 'feature'

export interface NavigationState {
  level: ZoomLevel
  systemId?: string
  featureId?: string
}
