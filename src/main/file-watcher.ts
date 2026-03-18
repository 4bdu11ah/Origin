import fs from 'fs'
import path from 'path'
import { watch, type FSWatcher } from 'chokidar'

export interface OriginMapData {
  version: string
  project: { name: string; description: string }
  systems: unknown[]
  edges: unknown[]
}

type MapChangeCallback = (map: OriginMapData) => void
type StaleChangeCallback = (isStale: boolean) => void

export class MapWatcher {
  private projectDir: string
  private mapPath: string
  private mapWatcher: FSWatcher | null = null
  private srcWatcher: FSWatcher | null = null
  private currentMap: OriginMapData | null = null
  private stale = false
  private mapChangeCallbacks: MapChangeCallback[] = []
  private staleChangeCallbacks: StaleChangeCallback[] = []
  private mapLastModified = 0

  constructor(projectDir: string) {
    this.projectDir = projectDir
    this.mapPath = path.join(projectDir, '.origin', 'map.json')
    this.loadMap()
  }

  private loadMap(): void {
    try {
      if (fs.existsSync(this.mapPath)) {
        const content = fs.readFileSync(this.mapPath, 'utf-8')
        this.currentMap = JSON.parse(content)
        this.mapLastModified = fs.statSync(this.mapPath).mtimeMs
      }
    } catch (err) {
      console.error('Failed to load map.json:', err)
      this.currentMap = null
    }
  }

  start(): void {
    const originDir = path.join(this.projectDir, '.origin')

    // Ensure .origin directory exists so chokidar can watch inside it
    fs.mkdirSync(originDir, { recursive: true })

    // Watch .origin/map.json for changes (map regeneration)
    this.mapWatcher = watch(this.mapPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300 }
    })

    this.mapWatcher.on('add', () => this.handleMapChange())
    this.mapWatcher.on('change', () => this.handleMapChange())

    // Watch source files to detect staleness
    this.srcWatcher = watch(this.projectDir, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/release/**',
        '**/.origin/**',
        '**/.DS_Store'
      ],
      ignoreInitial: true,
      persistent: true
    })

    this.srcWatcher.on('all', (_event, filePath) => {
      // Source file changed — map might be stale
      if (this.currentMap && !this.stale) {
        const fileStat = fs.statSync(filePath, { throwIfNoEntry: false })
        if (fileStat && fileStat.mtimeMs > this.mapLastModified) {
          this.stale = true
          this.staleChangeCallbacks.forEach((cb) => cb(true))
        }
      }
    })
  }

  private handleMapChange(): void {
    this.loadMap()
    if (this.currentMap) {
      this.stale = false
      this.mapChangeCallbacks.forEach((cb) => cb(this.currentMap!))
      this.staleChangeCallbacks.forEach((cb) => cb(false))
    }
  }

  stop(): void {
    this.mapWatcher?.close()
    this.srcWatcher?.close()
  }

  getCurrentMap(): OriginMapData | null {
    return this.currentMap
  }

  isStale(): boolean {
    return this.stale
  }

  onMapChange(callback: MapChangeCallback): void {
    this.mapChangeCallbacks.push(callback)
  }

  onStaleChange(callback: StaleChangeCallback): void {
    this.staleChangeCallbacks.push(callback)
  }
}
