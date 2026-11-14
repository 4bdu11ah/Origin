import type { DetailItem } from '../../types/map'
import './DetailPanel.css'

interface DetailPanelProps {
  item: DetailItem
  onClose: () => void
}

const NODE_TYPE_LABELS: Record<string, string> = {
  component: 'Component',
  function: 'Function',
  route: 'Route',
  model: 'Model',
  middleware: 'Middleware',
  class: 'Class',
  hook: 'Hook',
  config: 'Config',
  type: 'Type',
  test: 'Test'
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  calls: 'Calls',
  imports: 'Imports',
  renders: 'Renders',
  'data-flow': 'Data flow',
  navigates: 'Navigates',
  extends: 'Extends',
  emits: 'Emits',
  configures: 'Configures'
}

export function DetailPanel({ item, onClose }: DetailPanelProps) {
  return (
    <div className="detail-panel-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="detail-panel-header">
          <span className="detail-panel-kind">{item.kind}</span>
          <button className="detail-panel-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {item.kind === 'system' && <SystemDetail item={item} />}
        {item.kind === 'feature' && <FeatureDetail item={item} />}
        {item.kind === 'node' && <NodeDetail item={item} />}

        {item.edges.length > 0 && (
          <div className="detail-section">
            <h4 className="detail-section-title">Connections</h4>
            <div className="detail-edges">
              {item.edges.map((edge, i) => (
                <div key={i} className="detail-edge">
                  <span className="detail-edge-type">{EDGE_TYPE_LABELS[edge.type] || edge.type}</span>
                  <span className="detail-edge-path">
                    {shortId(edge.from)} &rarr; {shortId(edge.to)}
                  </span>
                  {edge.label && <span className="detail-edge-label">{edge.label}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SystemDetail({ item }: { item: Extract<DetailItem, { kind: 'system' }> }) {
  const { system } = item
  const totalNodes = system.features.reduce((acc, f) => acc + f.nodes.length, 0)

  return (
    <>
      <div className="detail-title-row">
        <span className="detail-color-dot" style={{ background: system.color }} />
        <h3 className="detail-title">{system.label}</h3>
      </div>
      <p className="detail-description">{system.description}</p>
      <div className="detail-meta">
        <span>{system.features.length} features</span>
        <span>{totalNodes} nodes</span>
      </div>
      <div className="detail-section">
        <h4 className="detail-section-title">Features</h4>
        <div className="detail-feature-list">
          {system.features.map((f) => (
            <div key={f.id} className="detail-feature-item">
              <span className="detail-feature-name">{f.label}</span>
              <span className="detail-feature-desc">{f.description}</span>
              <span className="detail-feature-count">{f.nodes.length} nodes</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function FeatureDetail({ item }: { item: Extract<DetailItem, { kind: 'feature' }> }) {
  const { feature, systemColor, systemLabel } = item

  return (
    <>
      <div className="detail-title-row">
        <span className="detail-color-dot" style={{ background: systemColor }} />
        <h3 className="detail-title">{feature.label}</h3>
      </div>
      <span className="detail-parent">{systemLabel}</span>
      <p className="detail-description">{feature.description}</p>
      <div className="detail-meta">
        <span>{feature.nodes.length} nodes</span>
      </div>
      <div className="detail-section">
        <h4 className="detail-section-title">Nodes</h4>
        <div className="detail-node-list">
          {feature.nodes.map((n) => (
            <div key={n.id} className="detail-node-item">
              <span className="detail-node-type-badge" style={{ background: systemColor }}>
                {NODE_TYPE_LABELS[n.type]?.[0] || '?'}
              </span>
              <div className="detail-node-info">
                <span className="detail-node-name">{n.label}</span>
                <span className="detail-node-desc">{n.description}</span>
                <span className="detail-node-file">{n.file}:{n.line}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function NodeDetail({ item }: { item: Extract<DetailItem, { kind: 'node' }> }) {
  const { node, systemColor } = item

  return (
    <>
      <div className="detail-title-row">
        <span className="detail-color-dot" style={{ background: systemColor }} />
        <h3 className="detail-title">{node.label}</h3>
      </div>
      <span className="detail-parent">{NODE_TYPE_LABELS[node.type] || node.type}</span>
      <p className="detail-description">{node.description}</p>
      <div className="detail-section">
        <h4 className="detail-section-title">Location</h4>
        <code className="detail-file-path">{node.file}:{node.line}</code>
      </div>
    </>
  )
}

function shortId(id: string): string {
  const parts = id.split('/')
  return parts[parts.length - 1]
}
