import './StaleIndicator.css'

export function StaleIndicator() {
  return (
    <div className="stale-indicator" title="Source files have changed since the map was last generated. Run /origin to update.">
      <div className="stale-indicator-dot" />
      <span className="stale-indicator-text">Map outdated</span>
    </div>
  )
}
