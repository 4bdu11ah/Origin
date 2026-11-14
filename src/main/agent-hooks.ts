// Agent status from Claude Code hooks.
//
// Origin starts `claude --settings <file>` where the file adds hooks for the
// session lifecycle. Each hook runs a tiny script that POSTs the event to a
// local server here, tagged with the agent id from the PTY's environment.
// Nothing is added to the user's own Claude settings, and the script does
// nothing outside Origin and never blocks or fails the agent.

import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface HookEvent {
  agentId: string
  event: string
  sessionId?: string
  notificationType?: string
  message?: string
  toolName?: string
}

const EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd'
]

const MAX_BODY = 4 * 1024 * 1024

const SCRIPT = `#!/bin/sh
# Reports Claude Code events to Origin. Written by Origin; safe to delete.
# Does nothing outside Origin, and never blocks or fails the agent.
if [ -z "$ORIGIN_HOOK_URL" ] || [ -z "$ORIGIN_AGENT_ID" ] || [ -z "$ORIGIN_HOOK_TOKEN" ]; then
  cat >/dev/null
  exit 0
fi
curl -s -m 2 -o /dev/null -X POST \\
  -H "Authorization: Bearer $ORIGIN_HOOK_TOKEN" \\
  -H "Content-Type: application/json" \\
  --data-binary @- "$ORIGIN_HOOK_URL?agent=$ORIGIN_AGENT_ID" 2>/dev/null
exit 0
`

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v.slice(0, 500) : undefined
}

export class AgentHooks {
  private server: http.Server | null = null
  private readonly token = crypto.randomBytes(24).toString('hex')
  private url = ''
  readonly dir = path.join(app.getPath('userData'), 'hooks')
  readonly scriptPath = path.join(this.dir, 'origin-hook.sh')
  readonly settingsPath = path.join(this.dir, 'claude-settings.json')

  async start(onEvent: (e: HookEvent) => void): Promise<void> {
    this.writeFiles()
    this.server = http.createServer((req, res) => this.handle(req, res, onEvent))
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => resolve())
    })
    const { port } = this.server.address() as { port: number }
    this.url = `http://127.0.0.1:${port}/hook`
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }

  /** Environment for a PTY so hooks inside it report as this agent. */
  env(agentId: string): Record<string, string> {
    if (!this.url) return {}
    return { ORIGIN_AGENT_ID: agentId, ORIGIN_HOOK_URL: this.url, ORIGIN_HOOK_TOKEN: this.token }
  }

  private writeFiles(): void {
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(this.scriptPath, SCRIPT, { mode: 0o755 })
    fs.chmodSync(this.scriptPath, 0o755)
    const command = `"${this.scriptPath}"`
    const hooks = Object.fromEntries(EVENTS.map((e) => [e, [{ hooks: [{ type: 'command', command, timeout: 5 }] }]]))
    fs.writeFileSync(this.settingsPath, JSON.stringify({ hooks }, null, 2))
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse, onEvent: (e: HookEvent) => void): void {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const auth = req.headers.authorization ?? ''
    const expected = `Bearer ${this.token}`
    const authorized = auth.length === expected.length && crypto.timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
    if (req.method !== 'POST' || url.pathname !== '/hook' || !authorized) {
      res.writeHead(404).end()
      req.resume()
      return
    }

    const agentId = url.searchParams.get('agent') ?? ''
    const chunks: Buffer[] = []
    let size = 0
    let tooBig = false
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) tooBig = true
      else chunks.push(c)
    })
    req.on('end', () => {
      res.writeHead(204).end()
      if (!agentId || tooBig) return
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
        const event = str(body.hook_event_name)
        if (!event) return
        onEvent({
          agentId,
          event,
          sessionId: str(body.session_id),
          notificationType: str(body.notification_type),
          message: str(body.message),
          toolName: str(body.tool_name)
        })
      } catch {
        // Malformed body: ignore.
      }
    })
  }
}
