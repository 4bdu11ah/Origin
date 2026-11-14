// The agents of each project, saved so they survive a restart or a crash.
// `open` agents come back on relaunch (Claude ones resume their conversation);
// `closed` holds recently stopped agents that can be reopened. Stored in the
// app's data folder, never in the project, one file per project.

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AgentRecord {
  id: string
  kind: 'claude' | 'codex' | 'shell'
  name: string
  systemId: string | null
  createdAt: number
  sessionId: string | null
  exited?: boolean
  closedAt?: number
}

export interface AgentRecords {
  open: AgentRecord[]
  closed: AgentRecord[]
}

const MAX_CLOSED = 20
const EMPTY: AgentRecords = { open: [], closed: [] }

function clean(r: unknown): AgentRecord | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (typeof o.id !== 'string' || !['claude', 'codex', 'shell'].includes(o.kind as string) || typeof o.name !== 'string') return null
  const sessionId = typeof o.sessionId === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(o.sessionId) ? o.sessionId : null
  return {
    id: o.id.slice(0, 100),
    kind: o.kind as AgentRecord['kind'],
    name: o.name.slice(0, 200),
    systemId: typeof o.systemId === 'string' ? o.systemId.slice(0, 200) : null,
    createdAt: typeof o.createdAt === 'number' ? o.createdAt : Date.now(),
    sessionId,
    exited: o.exited === true || undefined,
    closedAt: typeof o.closedAt === 'number' ? o.closedAt : undefined
  }
}

export class AgentRecordStore {
  private readonly dir = path.join(app.getPath('userData'), 'agents')
  /** Saves are ignored while frozen: terminals being torn down must not erase what was open. */
  private frozen = false

  private fileFor(projectPath: string): string {
    const key = crypto.createHash('sha1').update(projectPath).digest('hex').slice(0, 16)
    return path.join(this.dir, `${key}.json`)
  }

  freeze(): void {
    this.frozen = true
  }

  load(projectPath: string): AgentRecords {
    this.frozen = false
    try {
      const raw = JSON.parse(fs.readFileSync(this.fileFor(projectPath), 'utf8')) as Record<string, unknown>
      const list = (v: unknown) => (Array.isArray(v) ? v.map(clean).filter((r): r is AgentRecord => r !== null) : [])
      return { open: list(raw.open), closed: list(raw.closed).slice(0, MAX_CLOSED) }
    } catch {
      return EMPTY
    }
  }

  save(projectPath: string, data: unknown): void {
    if (this.frozen || !data || typeof data !== 'object') return
    const d = data as Record<string, unknown>
    const list = (v: unknown) => (Array.isArray(v) ? v.map(clean).filter((r): r is AgentRecord => r !== null) : [])
    const records: AgentRecords = { open: list(d.open), closed: list(d.closed).slice(0, MAX_CLOSED) }
    fs.mkdirSync(this.dir, { recursive: true })
    // Write then rename, so a crash mid-write never leaves a broken file.
    const file = this.fileFor(projectPath)
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2))
    fs.renameSync(tmp, file)
  }
}
