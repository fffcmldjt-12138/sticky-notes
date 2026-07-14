import { constants } from 'node:fs'
import { copyFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { AppConfig } from '../../shared/models'
import { BackupService } from './BackupService'
import { SafeJsonStore } from './SafeJsonStore'
import {
  DataUnavailableError,
  UnsupportedDataVersionError
} from './storageErrors'
import { validateAppConfig, validateNotesFile } from './storageValidators'

const defaultConfig = (): AppConfig => ({
  version: 1,
  autoLaunch: false,
  panelPosition: 'right',
  alwaysOnTop: true,
  siyuan: {
    endpoint: 'http://127.0.0.1:6806',
    inboxNotebookId: null
  }
})

export class ConfigStore {
  private readonly filePath: string
  private readonly file: SafeJsonStore<AppConfig>
  private readonly backups: BackupService
  private operationQueue: Promise<void> = Promise.resolve()
  private initialized: Promise<void> | null = null

  constructor(userDataPath: string, backups?: BackupService) {
    this.filePath = join(userDataPath, 'config.json')
    this.backups = backups ?? new BackupService(join(userDataPath, 'backups'), {
      notes: validateNotesFile,
      config: validateAppConfig
    })
    this.file = new SafeJsonStore(
      this.filePath,
      defaultConfig,
      validateAppConfig,
      (path, value) => this.backups.beforeReplace('config', path, value),
      undefined,
      (error, phase) => console.error(`config ${phase} backup failed`, error)
    )
  }

  get(): Promise<AppConfig> {
    return this.enqueue(async () => {
      await this.ensureInitialized()
      return structuredClone(await this.file.read())
    })
  }

  update(patch: Partial<Omit<AppConfig, 'version'>>): Promise<AppConfig> {
    const candidatePatch = structuredClone(patch)
    return this.enqueue(async () => {
      await this.ensureInitialized()
      const current = await this.file.read()
      const updated = validateAppConfig({
        ...current,
        ...candidatePatch,
        version: 1
      })
      await this.file.write(updated)
      return structuredClone(updated)
    })
  }

  private ensureInitialized(): Promise<void> {
    this.initialized ??= this.initialize()
    return this.initialized
  }

  private async initialize(): Promise<void> {
    let contents: Buffer
    try {
      contents = await readFile(this.filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.file.read()
        return
      }
      throw new DataUnavailableError('config', error)
    }

    try {
      const raw = JSON.parse(contents.toString('utf8')) as unknown
      const version = persistedVersion(raw)
      if (Number.isSafeInteger(version) && Number(version) > 1) {
        throw new UnsupportedDataVersionError('config', version)
      }
      validateAppConfig(raw)
    } catch (error) {
      if (error instanceof UnsupportedDataVersionError) throw error
      const corruptPath = corruptCopyPath(this.filePath, contents)
      const backup = await this.backups.findNewestValid('config')
      if (!backup) {
        await preserveCorruptCopy(this.filePath, corruptPath)
        throw new DataUnavailableError('config', error)
      }
      const candidate = validateAppConfig(backup.value)
      await this.file.replaceInvalid(candidate, corruptPath)
      validateAppConfig(await this.file.read())
    }
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

function persistedVersion(value: unknown): unknown {
  return value && typeof value === 'object' && 'version' in value
    ? value.version
    : undefined
}

function corruptCopyPath(filePath: string, contents: Buffer): string {
  const digest = createHash('sha256').update(contents).digest('hex')
  return `${filePath}.corrupt-${digest}`
}

async function preserveCorruptCopy(
  filePath: string,
  corruptPath: string
): Promise<void> {
  try {
    await copyFile(filePath, corruptPath, constants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
}
