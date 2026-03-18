export interface OriginSettings {
  theme: 'dark' | 'light'
  graphPalette: string[]
  uiFontSize: number
  terminalFontFamily: string
  terminalFontSize: number
  explanationType: 'technical' | 'simple'
  showDotGrid: boolean
}

export const DEFAULT_GRAPH_PALETTE = [
  '#6366F1', '#3B82F6', '#22C55E', '#EC4899',
  '#F59E0B', '#14B8A6', '#EF4444', '#A855F7'
]

export const DEFAULT_SETTINGS: OriginSettings = {
  theme: 'dark',
  graphPalette: DEFAULT_GRAPH_PALETTE,
  uiFontSize: 14,
  terminalFontFamily: 'monospace',
  terminalFontSize: 13,
  explanationType: 'technical',
  showDotGrid: true
}
