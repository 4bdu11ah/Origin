import { useEffect, useRef } from 'react'
import { Terminal as XTerm, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { useSettings } from '../../contexts/SettingsContext'
import '@xterm/xterm/css/xterm.css'

export const DARK_THEME: ITheme = {
  background: '#0A0A0B',
  foreground: '#EDEDEF',
  cursor: '#E8853D',
  cursorAccent: '#0A0A0B',
  selectionBackground: 'rgba(232, 133, 61, 0.25)',
  selectionForeground: '#EDEDEF',
  black: '#1A1A1E',
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#F0A060',
  blue: '#6396F1',
  magenta: '#C084FC',
  cyan: '#22D3EE',
  white: '#EDEDEF',
  brightBlack: '#6B6B76',
  brightRed: '#F87171',
  brightGreen: '#4ADE80',
  brightYellow: '#F0A060',
  brightBlue: '#93B4F8',
  brightMagenta: '#D8B4FE',
  brightCyan: '#67E8F9',
  brightWhite: '#FFFFFF'
}

export const LIGHT_THEME: ITheme = {
  background: '#FAF9F7',
  foreground: '#1C1B18',
  cursor: '#E8853D',
  cursorAccent: '#FAF9F7',
  selectionBackground: 'rgba(232, 133, 61, 0.20)',
  selectionForeground: '#1C1B18',
  black: '#1C1B18',
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#B45309',
  blue: '#2563EB',
  magenta: '#9333EA',
  cyan: '#0891B2',
  white: '#F3F2EF',
  brightBlack: '#8C8B85',
  brightRed: '#EF4444',
  brightGreen: '#22C55E',
  brightYellow: '#D97706',
  brightBlue: '#3B82F6',
  brightMagenta: '#A855F7',
  brightCyan: '#06B6D4',
  brightWhite: '#FAF9F7'
}

interface TerminalPaneProps {
  id: string
}

export function TerminalPane({ id }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const { settings } = useSettings()

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      lineHeight: 1.2,
      cursorBlink: true,
      theme: settings.theme === 'dark' ? DARK_THEME : LIGHT_THEME
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon
    termRef.current = term

    term.open(containerRef.current)
    fitAddon.fit()
    term.focus()

    // Spawn a PTY for this terminal
    window.api.terminal.spawn(id)

    // Send keystrokes to PTY
    const dataDisposable = term.onData((data) => {
      window.api.terminal.write(id, data)
    })

    // Receive PTY output
    const unsubData = window.api.terminal.onData((termId, data) => {
      if (termId === id) {
        term.write(data)
      }
    })

    // Handle resize
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      window.api.terminal.resize(id, cols, rows)
    })

    // Fit on container resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit()
      } catch {
        // Ignore fit errors
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      unsubData()
      dataDisposable.dispose()
      resizeDisposable.dispose()
      resizeObserver.disconnect()
      window.api.terminal.kill(id)
      term.dispose()
      termRef.current = null
    }
  }, [id])

  // Live-update terminal font and theme settings
  useEffect(() => {
    const term = termRef.current
    if (!term || !term.element) return
    term.options.fontFamily = settings.terminalFontFamily
    term.options.fontSize = settings.terminalFontSize
    term.options.theme = settings.theme === 'dark' ? DARK_THEME : LIGHT_THEME
    try {
      fitAddonRef.current?.fit()
    } catch {
      // Ignore fit errors
    }
  }, [settings.terminalFontFamily, settings.terminalFontSize, settings.theme])

  const handleClick = () => {
    termRef.current?.focus()
  }

  return <div ref={containerRef} className="terminal-pane" onClick={handleClick} />
}
