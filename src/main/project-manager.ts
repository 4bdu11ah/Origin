import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'

export interface ProjectInfo {
  path: string
  name: string
  openedAt: number
}

export interface RecentProject extends ProjectInfo {
  displayPath: string
  missing: boolean
}

interface StoredProjects {
  recent: ProjectInfo[]
  // Project open when the app last quit; reopened on launch. Null after an explicit close.
  last: string | null
}

const MAX_RECENT = 12

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function displayPath(p: string): string {
  const home = os.homedir()
  return p === home || p.startsWith(home + path.sep) ? '~' + p.slice(home.length) : p
}

export class ProjectManager {
  private file = path.join(app.getPath('userData'), 'projects.json')
  private data: StoredProjects
  private current: ProjectInfo | null = null

  constructor() {
    this.data = this.load()
  }

  private load(): StoredProjects {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      const recent = Array.isArray(raw?.recent)
        ? raw.recent.filter((p: ProjectInfo) => typeof p?.path === 'string')
        : []
      return { recent, last: typeof raw?.last === 'string' ? raw.last : null }
    } catch {
      return { recent: [], last: null }
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save projects.json:', err)
    }
  }

  getCurrent(): ProjectInfo | null {
    return this.current
  }

  getRecent(): RecentProject[] {
    return this.data.recent.map((p) => ({
      ...p,
      displayPath: displayPath(p.path),
      missing: !isDirectory(p.path)
    }))
  }

  /** Project to reopen on launch, if it still exists. */
  getLastOpen(): string | null {
    return this.data.last && isDirectory(this.data.last) ? this.data.last : null
  }

  /** Marks a folder as the current project. Throws if it isn't a directory. */
  open(dir: string): ProjectInfo {
    const resolved = fs.realpathSync(path.resolve(dir))
    if (!isDirectory(resolved)) throw new Error(`Not a folder: ${dir}`)

    const info: ProjectInfo = { path: resolved, name: path.basename(resolved), openedAt: Date.now() }
    this.data.recent = [info, ...this.data.recent.filter((p) => p.path !== resolved)].slice(0, MAX_RECENT)
    this.data.last = resolved
    this.current = info
    this.save()
    return info
  }

  close(): void {
    this.current = null
    this.data.last = null
    this.save()
  }

  removeRecent(dir: string): void {
    this.data.recent = this.data.recent.filter((p) => p.path !== dir)
    if (this.data.last === dir) this.data.last = null
    this.save()
  }

  clearRecent(): void {
    this.data.recent = this.current ? this.data.recent.filter((p) => p.path === this.current!.path) : []
    this.save()
  }
}
