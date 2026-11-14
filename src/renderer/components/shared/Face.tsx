import { Avatar } from '../Canvas/Avatar'
import type { Person } from '../../types/work'

/** A person's face: employee mascot, contractor picture, or "you". */
export function Face({ person, size = 22 }: { person: Person; size?: number }) {
  if (person.name === 'You') {
    return (
      <span className="face-you" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} title="You">
        You
      </span>
    )
  }
  return <Avatar persona={person.persona} size={size} title={person.name} />
}
