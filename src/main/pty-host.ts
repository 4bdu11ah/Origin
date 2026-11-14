// PTY Host — runs as a separate Node.js process (ELECTRON_RUN_AS_NODE=1)
// to avoid node-pty shells exiting immediately when spawned from Electron IPC handlers

type IPty = import('node-pty').IPty
const pty = require('node-pty') as typeof import('node-pty')
const ptys = new Map<string, IPty>()

interface SpawnMsg {
  type: 'spawn'
  id: string
  shell: string
  args: string[]
  cols: number
  rows: number
  cwd: string
  env: Record<string, string>
}

interface WriteMsg {
  type: 'write'
  id: string
  data: string
}

interface ResizeMsg {
  type: 'resize'
  id: string
  cols: number
  rows: number
}

interface KillMsg {
  type: 'kill'
  id: string
}

type HostMessage = SpawnMsg | WriteMsg | ResizeMsg | KillMsg

process.on('message', (msg: HostMessage) => {
  switch (msg.type) {
    case 'spawn': {
      if (ptys.has(msg.id)) return
      const proc = pty.spawn(msg.shell, msg.args, {
        name: 'xterm-256color',
        cols: msg.cols,
        rows: msg.rows,
        cwd: msg.cwd,
        env: msg.env
      })
      ptys.set(msg.id, proc)
      process.send!({ type: 'data', id: msg.id, data: '' }) // signal ready
      proc.onData((data: string) => {
        process.send!({ type: 'data', id: msg.id, data })
      })
      proc.onExit(({ exitCode }: { exitCode: number }) => {
        ptys.delete(msg.id)
        process.send!({ type: 'exit', id: msg.id, exitCode })
      })
      break
    }
    case 'write':
      ptys.get(msg.id)?.write(msg.data)
      break
    case 'resize':
      try { ptys.get(msg.id)?.resize(msg.cols, msg.rows) } catch {}
      break
    case 'kill': {
      const proc = ptys.get(msg.id)
      if (proc) {
        try { proc.kill() } catch {}
        ptys.delete(msg.id)
      }
      break
    }
  }
})

process.on('disconnect', () => {
  for (const [, proc] of ptys) {
    try { proc.kill() } catch {}
  }
  process.exit(0)
})
