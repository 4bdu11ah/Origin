import { useMemo, useState, useCallback } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { OriginMap, NavigationState, ZoomLevel, DetailItem } from '../../types/map'
import { useSettings } from '../../contexts/SettingsContext'
import { ProjectView } from './ProjectView'
import { SystemView } from './SystemView'
import { FeatureView } from './FeatureView'
import { DetailPanel } from './DetailPanel'
import { BreathingDots } from './BreathingDots'
import './SpatialMap.css'

interface SpatialMapProps {
  map: OriginMap
  navigation: NavigationState
  onNavigate: (level: ZoomLevel, systemId?: string, featureId?: string) => void
  onNavigateBack: () => void
  onChatWith: (context: string) => void
}

export function SpatialMap({ map, navigation, onNavigate, onNavigateBack, onChatWith }: SpatialMapProps) {
  const { settings } = useSettings()
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null)

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
    setDetailItem(null)
    onNavigate('system', systemId)
  }

  const handleFeatureClick = (featureId: string) => {
    setDetailItem(null)
    onNavigate('feature', navigation.systemId, featureId)
  }

  // Collect edges relevant to a given set of node IDs
  const getEdgesFor = useCallback((nodeIds: Set<string>) => {
    return coloredMap.edges.filter((e) => nodeIds.has(e.from) || nodeIds.has(e.to))
  }, [coloredMap.edges])

  const handleShowSystemDetail = useCallback((systemId: string) => {
    const system = coloredMap.systems.find((s) => s.id === systemId)
    if (!system) return
    const nodeIds = new Set<string>()
    for (const f of system.features) {
      for (const n of f.nodes) nodeIds.add(n.id)
    }
    setDetailItem({ kind: 'system', system, edges: getEdgesFor(nodeIds) })
  }, [coloredMap, getEdgesFor])

  const handleShowFeatureDetail = useCallback((featureId: string) => {
    for (const system of coloredMap.systems) {
      const feature = system.features.find((f) => f.id === featureId)
      if (feature) {
        const nodeIds = new Set(feature.nodes.map((n) => n.id))
        setDetailItem({
          kind: 'feature',
          feature,
          systemColor: system.color,
          systemLabel: system.label,
          edges: getEdgesFor(nodeIds)
        })
        return
      }
    }
  }, [coloredMap, getEdgesFor])

  const handleShowNodeDetail = useCallback((nodeId: string) => {
    for (const system of coloredMap.systems) {
      for (const feature of system.features) {
        const node = feature.nodes.find((n) => n.id === nodeId)
        if (node) {
          const nodeIds = new Set([node.id])
          setDetailItem({
            kind: 'node',
            node,
            systemColor: system.color,
            edges: getEdgesFor(nodeIds)
          })
          return
        }
      }
    }
  }, [coloredMap, getEdgesFor])

  const handleChatWithSystem = useCallback((systemId: string) => {
    const system = coloredMap.systems.find((s) => s.id === systemId)
    if (!system) return

    const nodeIds = new Set<string>()
    for (const f of system.features) {
      for (const n of f.nodes) nodeIds.add(n.id)
    }
    const edges = coloredMap.edges.filter((e) => nodeIds.has(e.from) || nodeIds.has(e.to))

    const features = system.features.map((f) => {
      const nodes = f.nodes.map((n) => `    - ${n.label} (${n.type}) — ${n.file}:${n.line} — ${n.description}`).join('\n')
      return `  Feature: ${f.label} — ${f.description}\n${nodes}`
    }).join('\n')

    const connections = edges.length
      ? '\nConnections:\n' + edges.map((e) => `  ${e.from} —[${e.type}]→ ${e.to}${e.label ? ` (${e.label})` : ''}`).join('\n')
      : ''

    onChatWith(`Tell me about the "${system.label}" system.\n${system.description}\n\n${features}${connections}`)
  }, [coloredMap, onChatWith])

  const handleChatWithFeature = useCallback((featureId: string) => {
    for (const system of coloredMap.systems) {
      const feature = system.features.find((f) => f.id === featureId)
      if (feature) {
        const nodeIds = new Set(feature.nodes.map((n) => n.id))
        const edges = coloredMap.edges.filter((e) => nodeIds.has(e.from) || nodeIds.has(e.to))

        const nodes = feature.nodes.map((n) =>
          `  - ${n.label} (${n.type}) — ${n.file}:${n.line} — ${n.description}`
        ).join('\n')

        const connections = edges.length
          ? '\nConnections:\n' + edges.map((e) => `  ${e.from} —[${e.type}]→ ${e.to}${e.label ? ` (${e.label})` : ''}`).join('\n')
          : ''

        onChatWith(`Tell me about the "${feature.label}" feature in the ${system.label} system.\n${feature.description}\n\nCode:\n${nodes}${connections}`)
        return
      }
    }
  }, [coloredMap, onChatWith])

  const handleChatWithNode = useCallback((nodeId: string) => {
    for (const system of coloredMap.systems) {
      for (const feature of system.features) {
        const node = feature.nodes.find((n) => n.id === nodeId)
        if (node) {
          const edges = coloredMap.edges.filter((e) => e.from === node.id || e.to === node.id)

          const connections = edges.length
            ? '\nConnections:\n' + edges.map((e) => `  ${e.from} —[${e.type}]→ ${e.to}${e.label ? ` (${e.label})` : ''}`).join('\n')
            : ''

          onChatWith(`Tell me about ${node.label} (${node.type}) in ${feature.label} > ${system.label}.\nFile: ${node.file}:${node.line}\n${node.description}${connections}`)
          return
        }
      }
    }
  }, [coloredMap, onChatWith])

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
          <ProjectView
            map={coloredMap}
            onSystemClick={handleSystemClick}
            onShowDetail={handleShowSystemDetail}
            onChatWith={handleChatWithSystem}
          />
        )}
        {navigation.level === 'system' && currentSystem && (
          <SystemView
            map={coloredMap}
            system={currentSystem}
            onFeatureClick={handleFeatureClick}
            onShowDetail={handleShowFeatureDetail}
            onChatWith={handleChatWithFeature}
          />
        )}
        {navigation.level === 'feature' && currentFeature && currentSystem && (
          <FeatureView
            map={coloredMap}
            feature={currentFeature}
            systemColor={currentSystem.color}
            onShowDetail={handleShowNodeDetail}
            onChatWith={handleChatWithNode}
          />
        )}
      </ReactFlowProvider>

      {detailItem && (
        <DetailPanel item={detailItem} onClose={() => setDetailItem(null)} />
      )}
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
