// xterm colour themes for agent terminals, matched to the app's dark and light themes.

import type { ITheme } from '@xterm/xterm'

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
