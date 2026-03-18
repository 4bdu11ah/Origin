import { useState, useEffect, useCallback } from 'react'
import type { OriginMap, NavigationState, ZoomLevel } from '../types/map'

export function useMapData() {
  const [map, setMap] = useState<OriginMap | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [loading, setLoading] = useState(true)
  const [navigation, setNavigation] = useState<NavigationState>({ level: 'project' })

  useEffect(() => {
    // Load initial map
    window.api.loadMap().then((data) => {
      if (data) setMap(data as OriginMap)
      setLoading(false)
    })

    // Check initial stale status
    window.api.getStaleStatus().then(setIsStale)

    // Listen for map updates
    const unsubMap = window.api.onMapUpdate((data) => {
      setMap(data as OriginMap)
    })

    // Listen for stale status changes
    const unsubStale = window.api.onStaleStatusChange(setIsStale)

    return () => {
      unsubMap()
      unsubStale()
    }
  }, [])

  const navigateTo = useCallback((level: ZoomLevel, systemId?: string, featureId?: string) => {
    setNavigation({ level, systemId, featureId })
  }, [])

  const navigateBack = useCallback(() => {
    setNavigation((prev) => {
      if (prev.level === 'feature') {
        return { level: 'system', systemId: prev.systemId }
      }
      if (prev.level === 'system') {
        return { level: 'project' }
      }
      return prev
    })
  }, [])

  return { map, isStale, loading, navigation, navigateTo, navigateBack }
}
