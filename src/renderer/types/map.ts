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
  | 'emits'
  | 'configures'

export interface CodeNode {
  id: string
  label: string
  type: NodeType
  file: string
  line: number
  description: string
  /** Plain words, 2 to 5, e.g. "Start a new job". */
  title?: string
  /** One plain sentence on what it does for the business. */
  summary?: string
}

export interface Feature {
  id: string
  label: string
  description: string
  nodes: CodeNode[]
  title?: string
  summary?: string
  icon?: string
}

export interface System {
  id: string
  label: string
  description: string
  color: string
  features: Feature[]
  title?: string
  summary?: string
  icon?: string
  /** main: a step in the product's main journey. support: behind the scenes. */
  lane?: 'main' | 'support'
  /** Position in the main journey, from 1. */
  order?: number
}

export interface MapEdge {
  from: string
  to: string
  type: EdgeType
  label?: string
  /** 2 to 4 plain words on what passes between them. */
  plain?: string
}

/** A link between two systems, in plain words. */
export interface MapFlow {
  from: string
  to: string
  label: string
}

export interface OriginMap {
  version: string
  project: {
    name: string
    description: string
    /** One plain sentence on what the product does for its users. */
    summary?: string
  }
  systems: System[]
  edges: MapEdge[]
  flows?: MapFlow[]
}

export interface OriginMeta {
  lastRunCommit: string
  lastRunTimestamp: string
  generatedSystems: string[]
  pendingSystems: string[]
}
