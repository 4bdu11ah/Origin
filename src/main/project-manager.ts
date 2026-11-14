import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'

// Recent projects and which ones were open in a window. One window holds one
// project, like VS Code; the windows open at quit (or at a crash) come back
// on the next launch.

export interface ProjectInfo {
  path: string
  name: string
  /** When the project was last opened in a window. */
  openedAt: number
}

export interface RecentProject extends ProjectInfo {
  displayPath: string
  missing: boolean
}

interface StoredProjects {
  recent: ProjectInfo[]
  /** Projects open in a window, restored on launch. */
  open: string[]
}

const MAX_RECENT = 20

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

  constructor() {
    this.data = this.load()
  }

  private load(): StoredProjects {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8'))
      const recent = Array.isArray(raw?.recent) ? raw.recent.filter((p: ProjectInfo) => typeof p?.path === 'string') : []
      const open = Array.isArray(raw?.open)
        ? raw.open.filter((p: unknown) => typeof p === 'string')
        : typeof raw?.last === 'string'
          ? [raw.last] // older single-project format
          : []
      return { recent, open }
    } catch {
      return { recent: [], open: [] }
    }
  }

  private save(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save projects.json:', err)
    }
  }

  getRecent(): RecentProject[] {
    return this.data.recent.map((p) => ({ ...p, displayPath: displayPath(p.path), missing: !isDirectory(p.path) }))
  }

  /** Projects that were open in windows, if they still exist. */
  getOpenAtLastRun(): string[] {
    return this.data.open.filter(isDirectory)
  }

  setOpen(paths: string[]): void {
    this.data.open = [...new Set(paths)]
    this.save()
  }

  /** Resolves a folder and records it as just opened. Throws if it isn't a directory. */
  touch(dir: string): ProjectInfo {
    const resolved = fs.realpathSync(path.resolve(dir))
    if (!isDirectory(resolved)) throw new Error(`Not a folder: ${dir}`)
    const info: ProjectInfo = { path: resolved, name: path.basename(resolved), openedAt: Date.now() }
    this.data.recent = [info, ...this.data.recent.filter((p) => p.path !== resolved)].slice(0, MAX_RECENT)
    this.save()
    return info
  }

  removeRecent(dir: string): void {
    this.data.recent = this.data.recent.filter((p) => p.path !== dir)
    this.save()
  }

  /** Clears the list, keeping projects that are open right now. */
  clearRecent(keep: string[]): void {
    this.data.recent = this.data.recent.filter((p) => keep.includes(p.path))
    this.save()
  }
}
