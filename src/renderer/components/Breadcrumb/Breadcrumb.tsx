import type { OriginMap, NavigationState, ZoomLevel } from '../../types/map'
import './Breadcrumb.css'

interface BreadcrumbProps {
  navigation: NavigationState
  map: OriginMap | null
  onNavigate: (level: ZoomLevel, systemId?: string, featureId?: string) => void
}

export function Breadcrumb({ navigation, map, onNavigate }: BreadcrumbProps) {
  if (!map) return null

  const system = navigation.systemId
    ? map.systems.find((s) => s.id === navigation.systemId)
    : undefined

  const feature = system && navigation.featureId
    ? system.features.find((f) => f.id === navigation.featureId)
    : undefined

  return (
    <nav className="breadcrumb">
      <button
        className={`breadcrumb-item ${navigation.level === 'project' ? 'active' : ''}`}
        onClick={() => onNavigate('project')}
      >
        {map.project.name}
      </button>

      {system && (
        <>
          <ChevronIcon />
          <button
            className={`breadcrumb-item ${navigation.level === 'system' ? 'active' : ''}`}
            onClick={() => onNavigate('system', system.id)}
            style={{ color: system.color }}
          >
            {system.label}
          </button>
        </>
      )}

      {feature && (
        <>
          <ChevronIcon />
          <span className="breadcrumb-item active">
            {feature.label}
          </span>
        </>
      )}
    </nav>
  )
}

function ChevronIcon() {
  return (
    <svg className="breadcrumb-separator" width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
