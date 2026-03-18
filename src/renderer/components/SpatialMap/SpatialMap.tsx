import { useMemo } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { OriginMap, NavigationState, ZoomLevel } from '../../types/map'
import { useSettings } from '../../contexts/SettingsContext'
import { ProjectView } from './ProjectView'
import { SystemView } from './SystemView'
import { FeatureView } from './FeatureView'
import { BreathingDots } from './BreathingDots'
import './SpatialMap.css'

interface SpatialMapProps {
  map: OriginMap
  navigation: NavigationState
  onNavigate: (level: ZoomLevel, systemId?: string, featureId?: string) => void
  onNavigateBack: () => void
}

export function SpatialMap({ map, navigation, onNavigate, onNavigateBack }: SpatialMapProps) {
  const { settings } = useSettings()

  // Apply graph palette to system colors
  const coloredMap = useMemo(() => {
    const palette = settings.graphPalette
    if (!palette.length) return map
    return {
      ...map,
      systems: map.systems.map((system, i) => ({
        ...system,
        color: palette[i % palette.length]
      }))
    }
  }, [map, settings.graphPalette])

  const currentSystem = useMemo(() => {
    if (navigation.systemId) {
      return coloredMap.systems.find((s) => s.id === navigation.systemId)
    }
    return undefined
  }, [coloredMap, navigation.systemId])

  const currentFeature = useMemo(() => {
    if (currentSystem && navigation.featureId) {
      return currentSystem.features.find((f) => f.id === navigation.featureId)
    }
    return undefined
  }, [currentSystem, navigation.featureId])

  const handleSystemClick = (systemId: string) => {
    onNavigate('system', systemId)
  }

  const handleFeatureClick = (featureId: string) => {
    onNavigate('feature', navigation.systemId, featureId)
  }

  return (
    <div className="spatial-map">
      {settings.showDotGrid && <BreathingDots />}

      {navigation.level !== 'project' && (
        <button className="back-button" onClick={onNavigateBack}>
          <BackIcon />
          <span>Back</span>
        </button>
      )}

      <ReactFlowProvider>
        {navigation.level === 'project' && (
          <ProjectView map={coloredMap} onSystemClick={handleSystemClick} />
        )}
        {navigation.level === 'system' && currentSystem && (
          <SystemView
            map={coloredMap}
            system={currentSystem}
            onFeatureClick={handleFeatureClick}
          />
        )}
        {navigation.level === 'feature' && currentFeature && currentSystem && (
          <FeatureView
            map={coloredMap}
            feature={currentFeature}
            systemColor={currentSystem.color}
          />
        )}
      </ReactFlowProvider>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
