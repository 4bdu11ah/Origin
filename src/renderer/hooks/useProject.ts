import { useEffect, useState } from 'react'
import type { ProjectInfo } from '../types/project'

/** The open project, kept in sync with the main process. */
export function useProject() {
  const [project, setProject] = useState<ProjectInfo | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.project.current().then((p) => {
      if (cancelled) return
      setProject(p)
      setReady(true)
    })
    const unsub = window.api.project.onChange((p) => {
      setProject(p)
      setReady(true)
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  return { project, ready }
}
