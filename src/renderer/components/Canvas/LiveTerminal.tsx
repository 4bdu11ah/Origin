import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettings } from '../../contexts/SettingsContext'
import { DARK_THEME, LIGHT_THEME } from '../Terminal/TerminalPane'
import '@xterm/xterm/css/xterm.css'

interface LiveTerminalProps {
  id: string
  focused: boolean
}

/**
 * A view onto an agent's existing PTY. Mounting replays the buffered output;
 * unmounting only detaches (the PTY keeps running). Live data carries a byte
 * offset so chunks already in the replayed buffer are not written twice.
 */
export function LiveTerminal({ id, focused }: LiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const { settings } = useSettings()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      scrollback: 5000,
      theme: settings.theme === 'dark' ? DARK_THEME : LIGHT_THEME
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    termRef.current = term
    try {
      fit.fit()
    } catch {
      // container not laid out yet
    }

    let disposed = false
    let replayedEnd = -1 // -1 until the buffer arrives
    const pending: Array<{ data: string; offset: number }> = []

    const writeLive = (data: string, offset: number) => {
      const end = offset + data.length
      if (end <= replayedEnd) return
      term.write(offset < replayedEnd ? data.slice(replayedEnd - offset) : data)
      replayedEnd = end
    }

    const unsubData = window.api.terminal.onData((termId, data, offset) => {
      if (termId !== id || disposed) return
      if (replayedEnd < 0) pending.push({ data, offset })
      else writeLive(data, offset)
    })

    window.api.terminal.buffer(id).then(({ data, end }) => {
      if (disposed) return
      term.write(data)
      replayedEnd = end
      for (const p of pending) writeLive(p.data, p.offset)
      pending.length = 0
      window.api.terminal.resize(id, term.cols, term.rows)
    })

    const dataDisposable = term.onData((data) => window.api.terminal.write(id, data))
    const resizeDisposable = term.onResize(({ cols, rows }) => window.api.terminal.resize(id, cols, rows))
    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        // ignore
      }
    })
    ro.observe(container)

    return () => {
      disposed = true
      unsubData()
      dataDisposable.dispose()
      resizeDisposable.dispose()
      ro.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [id])

  useEffect(() => {
    const term = termRef.current
    if (!term) return
    if (focused) term.focus()
    else term.blur()
  }, [focused])

  useEffect(() => {
    const term = termRef.current
    if (!term || !term.element) return
    term.options.fontFamily = settings.terminalFontFamily
    term.options.fontSize = settings.terminalFontSize
    term.options.theme = settings.theme === 'dark' ? DARK_THEME : LIGHT_THEME
  }, [settings.terminalFontFamily, settings.terminalFontSize, settings.theme])

  return <div ref={containerRef} className="live-terminal" />
}
