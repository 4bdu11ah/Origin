import { useState, useCallback } from 'react'
import { TerminalPane } from './TerminalPane'
import './Terminal.css'

let nextId = 1
function createTabId(): string {
  return `term-${nextId++}`
}

interface Tab {
  id: string
  title: string
}

export function Terminal() {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const first = createTabId()
    return [{ id: first, title: 'Terminal' }]
  })
  const [activeTab, setActiveTab] = useState(tabs[0].id)

  const addTab = useCallback(() => {
    const id = createTabId()
    setTabs((prev) => [...prev, { id, title: 'Terminal' }])
    setActiveTab(id)
  }, [])

  const closeTab = useCallback((id: string) => {
    window.api.terminal.kill(id)
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (next.length === 0) {
        // Always keep at least one tab
        const newId = createTabId()
        setActiveTab(newId)
        return [{ id: newId, title: 'Terminal' }]
      }
      // If we closed the active tab, switch to the nearest one
      if (id === activeTab) {
        const closedIndex = prev.findIndex((t) => t.id === id)
        const newActive = next[Math.min(closedIndex, next.length - 1)]
        setActiveTab(newActive.id)
      }
      return next
    })
  }, [activeTab])

  return (
    <div className="terminal-wrapper">
      <div className="terminal-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`terminal-tab ${tab.id === activeTab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="terminal-tab-title">{tab.title}</span>
            <button
              className="terminal-tab-close"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              <CloseIcon />
            </button>
          </div>
        ))}
        <button className="terminal-tab-add" onClick={addTab} title="New terminal">
          <PlusIcon />
        </button>
      </div>
      <div className="terminal-panes">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="terminal-pane-wrapper"
            style={{ display: tab.id === activeTab ? 'block' : 'none' }}
          >
            <TerminalPane id={tab.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
