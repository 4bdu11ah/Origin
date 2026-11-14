import type { ReactNode } from 'react'
import { PreviewBadge } from '../shared/StatusIcon'
import './Screens.css'

export function ScreenHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="screen-header">
      <div className="screen-heading">
        <h1 className="screen-title">{title}</h1>
        {sub && <p className="screen-sub">{sub}</p>}
      </div>
      <div className="screen-header-right">
        {children}
        <PreviewBadge />
      </div>
    </div>
  )
}
