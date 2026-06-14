import { join } from 'node:path'
import type { AppConfig } from '../../shared/models'
import { JsonFileStore } from './JsonFileStore'

const defaultConfig = (): AppConfig => ({
  version: 1,
  autoLaunch: false,
  panelPosition: 'right',
  alwaysOnTop: true
})

export class ConfigStore {
  private readonly file: JsonFileStore<AppConfig>

  constructor(userDataPath: string) {
    this.file = new JsonFileStore(join(userDataPath, 'config.json'), defaultConfig)
  }

  get(): Promise<AppConfig> {
    return this.file.read()
  }

  async update(patch: Partial<Omit<AppConfig, 'version'>>): Promise<AppConfig> {
    const current = await this.file.read()
    const updated: AppConfig = { ...current, ...patch, version: 1 }
    await this.file.write(updated)
    return updated
  }
}

