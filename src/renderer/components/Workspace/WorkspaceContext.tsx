import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { sampleWorkspace, type SampleWorkspace } from '../../sample/workspace'
import type { InboxItem, Ticket } from '../../types/work'

// Shared state for one project window: which screen is showing, and the
// project's record (tickets, inbox, releases, team...). Preview: the record is
// sample data held in memory; actions like accepting an inbox item change it
// so the screens feel connected, but nothing is saved yet.

export type Screen = 'canvas' | 'board' | 'inbox' | 'releases' | 'team' | 'connections' | 'chief'

interface WorkspaceValue extends Omit<SampleWorkspace, 'tickets' | 'inbox'> {
  projectPath: string
  systems: { id: string; label: string; color: string }[]
  screen: Screen
  setScreen: (s: Screen) => void
  tickets: Ticket[]
  inbox: InboxItem[]
  /** Ticket open in the detail panel on the Board. */
  openTicketKey: string | null
  openTicket: (key: string | null) => void
  acceptInbox: (id: string) => void
  dismissInbox: (id: string) => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function WorkspaceProvider({
  projectPath,
  systems,
  screen,
  setScreen,
  children
}: {
  projectPath: string
  systems: { id: string; label: string; color: string }[]
  screen: Screen
  setScreen: (s: Screen) => void
  children: ReactNode
}) {
  const sample = useMemo(() => sampleWorkspace(projectPath, systems), [projectPath, systems])
  const [tickets, setTickets] = useState<Ticket[]>(sample.tickets)
  const [inbox, setInbox] = useState<InboxItem[]>(sample.inbox)
  const [openTicketKey, setOpenTicketKey] = useState<string | null>(null)

  const openTicket = useCallback(
    (key: string | null) => {
      setOpenTicketKey(key)
      if (key) setScreen('board')
    },
    [setScreen]
  )

  const acceptInbox = useCallback(
    (id: string) => {
      const item = inbox.find((i) => i.id === id)
      if (!item) return
      setInbox((list) => list.filter((i) => i.id !== id))
      setTickets((list) => {
        const next = Math.max(0, ...list.map((t) => Number(t.key.split('-').pop()) || 0)) + 1
        return [
          ...list,
          {
            key: `${sample.prefix}-${next}`,
            title: item.title,
            status: 'todo',
            assignee: null,
            system: item.system,
            summary: item.summary,
            doneWhen: [],
            history: [
              { who: item.foundBy, text: `Found while on ${item.foundWhile}`, when: item.when },
              { who: { name: 'You', persona: { type: 'contractor' } }, text: 'Accepted from the inbox', when: 'now' }
            ],
            updated: 'just now'
          }
        ]
      })
    },
    [inbox, sample.prefix]
  )

  const dismissInbox = useCallback((id: string) => setInbox((list) => list.filter((i) => i.id !== id)), [])

  const value: WorkspaceValue = {
    ...sample,
    projectPath,
    systems,
    screen,
    setScreen,
    tickets,
    inbox,
    openTicketKey,
    openTicket,
    acceptInbox,
    dismissInbox
  }
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceValue {
  const v = useContext(WorkspaceContext)
  if (!v) throw new Error('useWorkspace outside WorkspaceProvider')
  return v
}
