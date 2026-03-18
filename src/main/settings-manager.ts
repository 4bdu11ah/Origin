import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { getSkillContent, SKILL_PATH, SKILL_DIR } from './skill-installer'

export interface OriginSettings {
  theme: 'dark' | 'light'
  graphPalette: string[]
  uiFontSize: number
  terminalFontFamily: string
  terminalFontSize: number
  explanationType: 'technical' | 'simple'
  showDotGrid: boolean
}

const DEFAULT_SETTINGS: OriginSettings = {
  theme: 'dark',
  graphPalette: [
    '#6366F1', '#3B82F6', '#22C55E', '#EC4899',
    '#F59E0B', '#14B8A6', '#EF4444', '#A855F7'
  ],
  uiFontSize: 14,
  terminalFontFamily: 'monospace',
  terminalFontSize: 13,
  explanationType: 'technical',
  showDotGrid: true
}

export class SettingsManager {
  private settingsPath: string
  private settings: OriginSettings

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json')
    this.settings = this.load()

    // Re-apply skill file in case installSkill() overwrote the 'simple' variant
    if (this.settings.explanationType === 'simple') {
      this.updateSkillFile()
    }
  }

  private load(): OriginSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = JSON.parse(fs.readFileSync(this.settingsPath, 'utf-8'))
        return { ...DEFAULT_SETTINGS, ...raw }
      }
    } catch {
      // Corrupted file — use defaults
    }
    return { ...DEFAULT_SETTINGS }
  }

  private save(): void {
    fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8')
  }

  get(): OriginSettings {
    return { ...this.settings }
  }

  update(partial: Partial<OriginSettings>): OriginSettings {
    const prevExplanationType = this.settings.explanationType
    this.settings = { ...this.settings, ...partial }
    this.save()

    if (partial.explanationType && partial.explanationType !== prevExplanationType) {
      this.updateSkillFile()
    }

    return { ...this.settings }
  }

  private updateSkillFile(): void {
    try {
      let content = getSkillContent()

      if (this.settings.explanationType === 'simple') {
        content += `\n\n## Description Style\n\nWhen generating descriptions for systems, features, and functions, use plain, simple language that a non-technical person can understand. Avoid jargon, technical terms, and implementation details. Focus on what things do from a user's perspective, not how they work internally.\n`
      }

      fs.mkdirSync(SKILL_DIR, { recursive: true })
      fs.writeFileSync(SKILL_PATH, content, 'utf-8')
    } catch (err) {
      console.error('Failed to update skill file:', err)
    }
  }
}
