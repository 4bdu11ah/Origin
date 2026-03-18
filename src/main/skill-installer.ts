import fs from 'fs'
import path from 'path'
import os from 'os'

export const SKILL_DIR = path.join(os.homedir(), '.claude', 'skills', 'origin')
export const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md')

export function getSkillContent(): string {
  // Read the skill from the bundled app resources
  const bundledSkillPath = path.join(__dirname, '../../skill/SKILL.md')
  if (fs.existsSync(bundledSkillPath)) {
    return fs.readFileSync(bundledSkillPath, 'utf-8')
  }

  // Fallback: read from the project source (dev mode)
  const devSkillPath = path.join(process.cwd(), 'skill', 'SKILL.md')
  if (fs.existsSync(devSkillPath)) {
    return fs.readFileSync(devSkillPath, 'utf-8')
  }

  throw new Error('Could not find SKILL.md in bundled resources or project directory')
}

export async function installSkill(): Promise<void> {
  try {
    const skillContent = getSkillContent()

    // Check if skill already exists and is up-to-date
    if (fs.existsSync(SKILL_PATH)) {
      const existing = fs.readFileSync(SKILL_PATH, 'utf-8')
      if (existing === skillContent) {
        return // Already installed and up-to-date
      }
    }

    // Create directory and write skill
    fs.mkdirSync(SKILL_DIR, { recursive: true })
    fs.writeFileSync(SKILL_PATH, skillContent, 'utf-8')
    console.log('Origin skill installed to', SKILL_PATH)
  } catch (err) {
    console.error('Failed to install Origin skill:', err)
  }
}
