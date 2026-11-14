import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'

export const SKILL_DIR = path.join(os.homedir(), '.claude', 'skills', 'origin')
export const SKILL_PATH = path.join(SKILL_DIR, 'SKILL.md')

/** Where the bundled skill lives: Resources/skill in a packaged app, the repo's skill/ in dev. */
export function getBundledSkillPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'skill', 'SKILL.md')
    : path.join(app.getAppPath(), 'skill', 'SKILL.md')
}

export function getSkillContent(): string {
  const skillPath = getBundledSkillPath()
  if (!fs.existsSync(skillPath)) {
    throw new Error(`Could not find the bundled SKILL.md at ${skillPath}`)
  }
  return fs.readFileSync(skillPath, 'utf-8')
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
