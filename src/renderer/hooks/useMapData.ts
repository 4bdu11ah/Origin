import { useState, useEffect } from 'react'
import type { OriginMap } from '../types/map'

export function useMapData() {
  const [map, setMap] = useState<OriginMap | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [loading, setLoading] = useState(true)

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

  return { map, isStale, loading }
}
