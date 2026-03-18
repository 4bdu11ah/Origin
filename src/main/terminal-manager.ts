import { app, type BrowserWindow } from 'electron'
import fs from 'fs'
import os from 'os'

// node-pty is loaded dynamically to handle cases where it's not available
let pty: typeof import('node-pty') | null = null
try {
  pty = require('node-pty')
} catch {
  console.warn('node-pty not available — terminal will be disabled')
}

type IPty = import('node-pty').IPty

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  // On macOS/Linux, use SHELL env var or fall back to common shells
  if (process.env.SHELL && fs.existsSync(process.env.SHELL)) {
    return process.env.SHELL
  }
  if (fs.existsSync('/bin/zsh')) return '/bin/zsh'
  if (fs.existsSync('/bin/bash')) return '/bin/bash'
  return '/bin/sh'
}

function getDefaultCwd(): string {
  // Try the current working directory first, then home
  try {
    const cwd = process.cwd()
    if (fs.existsSync(cwd)) return cwd
  } catch {
    // cwd can throw if the directory was deleted
  }
  return os.homedir()
}

export class TerminalManager {
  private terminals = new Map<string, IPty>()

  spawn(id: string, window: BrowserWindow): void {
    if (!pty) {
      console.error('node-pty is not available')
      return
    }

    // Kill existing terminal with this ID if any
    this.kill(id)

    const shell = getDefaultShell()
    const cwd = getDefaultCwd()

    // Build a clean env — filter out undefined values
    const env: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value
      }
    }

    try {
      const proc = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env
      })

      this.terminals.set(id, proc)

      proc.onData((data) => {
        if (!window.isDestroyed()) {
          window.webContents.send('terminal:data', id, data)
        }
      })

      proc.onExit(() => {
        this.terminals.delete(id)
        if (!window.isDestroyed()) {
          window.webContents.send('terminal:exit', id)
        }
      })
    } catch (err) {
      console.error(`Failed to spawn terminal ${id}:`, err)
    }
  }

  write(id: string, data: string): void {
    this.terminals.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    try {
      this.terminals.get(id)?.resize(cols, rows)
    } catch {
      // Ignore resize errors (process may have exited)
    }
  }

  kill(id: string): void {
    const proc = this.terminals.get(id)
    if (proc) {
      try { proc.kill() } catch { /* already dead */ }
      this.terminals.delete(id)
    }
  }

  dispose(): void {
    for (const [, proc] of this.terminals) {
      try { proc.kill() } catch { /* already dead */ }
    }
    this.terminals.clear()
  }
}
