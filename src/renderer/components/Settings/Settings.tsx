import { useState, useEffect } from 'react'
import { useSettings } from '../../contexts/SettingsContext'
import type { OriginSettings } from '../../types/settings'
import './Settings.css'

const PALETTE_PRESETS = [
  {
    name: 'Vivid',
    colors: ['#6366F1', '#3B82F6', '#22C55E', '#EC4899', '#F59E0B', '#14B8A6', '#EF4444', '#A855F7']
  },
  {
    name: 'Ocean',
    colors: ['#0EA5E9', '#06B6D4', '#2563EB', '#6366F1', '#8B5CF6', '#0891B2', '#38BDF8', '#7C3AED']
  },
  {
    name: 'Earth',
    colors: ['#D97706', '#059669', '#B45309', '#0D9488', '#92400E', '#16A34A', '#78350F', '#065F46']
  },
  {
    name: 'Pastel',
    colors: ['#93C5FD', '#A5B4FC', '#86EFAC', '#FCA5A5', '#FDE68A', '#A7F3D0', '#FBCFE8', '#C4B5FD']
  },
  {
    name: 'Mono',
    colors: ['#6B7280', '#9CA3AF', '#4B5563', '#D1D5DB', '#374151', '#A1A1AA', '#71717A', '#E5E7EB']
  }
]

const TERMINAL_FONTS = [
  { value: 'monospace', label: 'System Monospace' },
  { value: "'SF Mono', monospace", label: 'SF Mono' },
  { value: "'Fira Code', monospace", label: 'Fira Code' },
  { value: "'Cascadia Code', monospace", label: 'Cascadia Code' },
  { value: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { value: "'Source Code Pro', monospace", label: 'Source Code Pro' }
]

interface SettingsProps {
  onClose: () => void
}

function palettesMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((c, i) => c.toLowerCase() === b[i].toLowerCase())
}

export function Settings({ onClose }: SettingsProps) {
  const { settings, updateSettings } = useSettings()
  const [appVersion, setAppVersion] = useState('0.1.0')

  useEffect(() => {
    window.api.appVersion().then(setAppVersion)
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="settings-backdrop" onClick={handleBackdropClick}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2 className="settings-title">Settings</h2>
          <button className="settings-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Appearance */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>

            <div className="settings-row">
              <label className="settings-label">Theme</label>
              <SegmentedToggle
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' }
                ]}
                value={settings.theme}
                onChange={(v) => updateSettings({ theme: v as OriginSettings['theme'] })}
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">UI Font Size</label>
              <Stepper
                value={settings.uiFontSize}
                min={12}
                max={20}
                suffix="px"
                onChange={(v) => updateSettings({ uiFontSize: v })}
              />
            </div>

            <div className="settings-row">
              <label className="settings-label">Dot Grid</label>
              <SegmentedToggle
                options={[
                  { value: 'on', label: 'On' },
                  { value: 'off', label: 'Off' }
                ]}
                value={settings.showDotGrid ? 'on' : 'off'}
                onChange={(v) => updateSettings({ showDotGrid: v === 'on' })}
              />
            </div>
          </section>

          {/* Graph Colors */}
          <section className="settings-section">
            <h3 className="settings-section-title">Graph Colors</h3>
            <p className="settings-section-hint">
              Colors assigned to systems on the spatial map
            </p>

            <div className="palette-list">
              {PALETTE_PRESETS.map((preset) => {
                const isActive = palettesMatch(settings.graphPalette, preset.colors)
                return (
                  <button
                    key={preset.name}
                    className={`palette-row ${isActive ? 'active' : ''}`}
                    onClick={() => updateSettings({ graphPalette: preset.colors })}
                  >
                    <span className="palette-name">{preset.name}</span>
                    <div className="palette-swatches">
                      {preset.colors.map((color, i) => (
                        <span
                          key={i}
                          className="palette-dot"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Terminal */}
          <section className="settings-section">
            <h3 className="settings-section-title">Terminal</h3>

            <div className="settings-row">
              <label className="settings-label">Font Family</label>
              <select
                className="settings-select"
                value={settings.terminalFontFamily}
                onChange={(e) => updateSettings({ terminalFontFamily: e.target.value })}
              >
                {TERMINAL_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label className="settings-label">Font Size</label>
              <Stepper
                value={settings.terminalFontSize}
                min={10}
                max={24}
                suffix="px"
                onChange={(v) => updateSettings({ terminalFontSize: v })}
              />
            </div>
          </section>

          {/* AI Descriptions */}
          <section className="settings-section">
            <h3 className="settings-section-title">AI Descriptions</h3>

            <div className="settings-row">
              <div>
                <label className="settings-label">Explanation Type</label>
                <p className="settings-hint">
                  Controls how /origin describes your codebase
                </p>
              </div>
              <SegmentedToggle
                options={[
                  { value: 'technical', label: 'Technical' },
                  { value: 'simple', label: 'Simple' }
                ]}
                value={settings.explanationType}
                onChange={(v) => updateSettings({ explanationType: v as OriginSettings['explanationType'] })}
              />
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h3 className="settings-section-title">About</h3>

            <div className="settings-row">
              <span className="settings-label">Version</span>
              <span className="settings-value">Origin v{appVersion}</span>
            </div>

            <div className="settings-row">
              <span className="settings-label">Repository</span>
              <a
                className="settings-link"
                href="https://github.com/anthropics/origin"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/anthropics/origin
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SegmentedToggle({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="segmented-toggle">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`segmented-option ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, min, max, suffix, onChange }: {
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div className="stepper">
      <button
        className="stepper-btn"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        -
      </button>
      <span className="stepper-value">{value}{suffix}</span>
      <button
        className="stepper-btn"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  )
}
