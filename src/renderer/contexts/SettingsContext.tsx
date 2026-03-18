import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { OriginSettings } from '../types/settings'
import { DEFAULT_SETTINGS } from '../types/settings'

interface SettingsContextValue {
  settings: OriginSettings
  updateSettings: (partial: Partial<OriginSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {}
})

export function useSettings() {
  return useContext(SettingsContext)
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<OriginSettings>(DEFAULT_SETTINGS)

  // Load settings on mount
  useEffect(() => {
    window.api.settings.get().then((s) => {
      if (s) setSettings(s)
    })
  }, [])

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  // Apply UI font size via zoom
  useEffect(() => {
    const zoom = settings.uiFontSize / 14
    const appEl = document.querySelector('.app') as HTMLElement | null
    if (appEl) {
      appEl.style.zoom = String(zoom)
    }
  }, [settings.uiFontSize])

  const updateSettings = useCallback((partial: Partial<OriginSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      window.api.settings.update(partial)
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}
