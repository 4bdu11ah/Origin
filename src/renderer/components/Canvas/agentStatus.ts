import { createContext } from 'react'
import type { Agent, AgentStatus } from './agentStore'

export const STATUS_LABEL: Record<AgentStatus, string> = {
  working: 'Working',
  'needs-you': 'Needs you',
  error: 'Error',
  unread: 'Done, unread',
  idle: 'Idle',
  exited: 'Exited'
}

export interface FileChange {
  path: string
  at: number
  deleted: boolean
}

/** Project file changes, shared by the map and every agent space. */
export const FileChangesContext = createContext<FileChange[]>([])

export function changesFor(agent: Agent, changes: FileChange[]): FileChange[] {
  return changes.filter((c) => c.at >= agent.createdAt)
}
