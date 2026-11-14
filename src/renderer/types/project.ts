export interface ProjectInfo {
  path: string
  name: string
  openedAt: number
}

export interface RecentProject extends ProjectInfo {
  displayPath: string
  missing: boolean
  /** Already open in another window (opening it focuses that window). */
  openInWindow: boolean
  /** Agents that come back when it opens. */
  agents: number
}
