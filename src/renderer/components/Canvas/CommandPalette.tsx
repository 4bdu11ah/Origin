import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentStatus } from './agentStore'

export interface PaletteItem {
  id: string
  label: string
  hint?: string
  dot?: AgentStatus
  run: () => void
}

export function CommandPalette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => `${i.label} ${i.hint ?? ''}`.toLowerCase().includes(q))
  }, [items, query])

  useEffect(() => setIndex(0), [query])

  const choose = (item: PaletteItem | undefined) => {
    if (!item) return
    onClose()
    item.run()
  }

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Jump to">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Jump to an agent or system, or start one…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(results[index])
            } else if (e.key === 'Escape') {
              e.preventDefault()
              onClose()
            }
          }}
        />
        <ul className="palette-list" role="listbox">
          {results.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === index}
              className={`palette-item${i === index ? ' is-active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => choose(item)}
            >
              {item.dot && <span className={`agent-dot dot-${item.dot}`} />}
              <span className="palette-label">{item.label}</span>
              {item.hint && <span className="palette-hint">{item.hint}</span>}
            </li>
          ))}
          {results.length === 0 && <li className="palette-empty">Nothing matches</li>}
        </ul>
      </div>
    </div>
  )
}
