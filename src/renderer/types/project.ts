export interface ProjectInfo {
  path: string
  name: string
  openedAt: number
}

export interface RecentProject extends ProjectInfo {
  displayPath: string
  missing: boolean
}
