import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type BackupSource = 'notes' | 'config'
export type BackupKind = 'change' | 'daily' | 'protected'

export interface BackupEntry {
  path: string
  source: BackupSource
  kind: BackupKind
  createdAt: string
  size: number
}

export interface ValidBackup {
  entry: BackupEntry
  value: unknown
}

type BackupValidator = (value: unknown) => unknown
type BackupValidators = Record<BackupSource, BackupValidator>

interface ParsedBackupFile {
  name: string
  epoch: number
}

const BACKUP_NAME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})\.json$/
const CHANGE_LIMITS: Record<BackupSource, number> = {
  notes: 20,
  config: 5
}
const PROTECTED_MAX_AGE_MS = 168 * 60 * 60 * 1000

export class BackupService {
  private operationQueue: Promise<void> = Promise.resolve()
  private nextEpochByDirectoryAndDay = new Map<string, number>()

  constructor(
    readonly rootPath: string,
    private readonly validators: BackupValidators,
    private readonly now: () => Date = () => new Date()
  ) {}

  recordChange(source: BackupSource, value: unknown): Promise<BackupEntry> {
    return this.enqueue(async () => {
      const entry = await this.writeSnapshot(source, 'change', value)
      await this.retainNewest(source, 'change', CHANGE_LIMITS[source])
      return entry
    })
  }

  recordDaily(
    source: 'notes',
    value: unknown
  ): Promise<BackupEntry | null> {
    return this.enqueue(async () => {
      const current = this.now()
      const directory = this.kindPath(source, 'daily')
      await mkdir(directory, { recursive: true })
      const files = await this.listParsedFiles(directory)
      const sameDayFiles = files.filter(({ epoch }) =>
        isSameLocalDate(new Date(epoch), current)
      )
      let alreadyRecorded = false
      for (const { name } of sameDayFiles) {
        if (await this.isValidSnapshot(source, join(directory, name))) {
          alreadyRecorded = true
          break
        }
      }
      const entry = alreadyRecorded
        ? null
        : await this.writeSnapshot(source, 'daily', value, current)
      await this.retainDailyWindow(source, current)
      return entry
    })
  }

  recordProtected(
    source: BackupSource,
    value: unknown
  ): Promise<BackupEntry> {
    return this.enqueue(async () => {
      const current = this.now()
      const entry = await this.writeSnapshot(
        source,
        'protected',
        value,
        current
      )
      await this.removeExpiredProtected(source, current)
      return entry
    })
  }

  async beforeReplace(
    source: BackupSource,
    _currentPath: string,
    currentValue: unknown
  ): Promise<void> {
    await this.recordChange(source, currentValue)
  }

  async afterReplace(
    source: 'notes',
    _currentPath: string,
    newValue: unknown
  ): Promise<void> {
    await this.recordDaily(source, newValue)
  }

  findNewestValid(source: BackupSource): Promise<ValidBackup | null> {
    return this.enqueue(async () => {
      const kinds: Array<'change' | 'daily'> =
        source === 'notes' ? ['change', 'daily'] : ['change']
      const candidates = (
        await Promise.all(
          kinds.map(async (kind) =>
            (await this.listParsedFiles(this.kindPath(source, kind))).map(
              (file) => ({ ...file, kind })
            )
          )
        )
      )
        .flat()
        .sort((left, right) => right.epoch - left.epoch)

      for (const candidate of candidates) {
        const path = join(
          this.kindPath(source, candidate.kind),
          candidate.name
        )
        try {
          const value = this.validators[source](
            JSON.parse(await readFile(path, 'utf8'))
          )
          const details = await stat(path)
          if (!details.isFile()) {
            continue
          }
          return {
            entry: {
              path,
              source,
              kind: candidate.kind,
              createdAt: new Date(candidate.epoch).toISOString(),
              size: details.size
            },
            value
          }
        } catch {
          // Recovery selection deliberately skips unusable candidates.
        }
      }

      return null
    })
  }

  private enqueue<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async writeSnapshot(
    source: BackupSource,
    kind: BackupKind,
    value: unknown,
    current = this.now()
  ): Promise<BackupEntry> {
    const validatedValue = this.validators[source](value)
    const directory = this.kindPath(source, kind)
    await mkdir(directory, { recursive: true })
    const businessDay = formatLocalDate(current)
    const namingKey = `${directory}\0${businessDay}`
    const nextDayEpoch = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1
    ).getTime()
    let epoch = Math.max(
      current.getTime(),
      this.nextEpochByDirectoryAndDay.get(namingKey) ?? Number.NEGATIVE_INFINITY
    )

    while (epoch < nextDayEpoch) {
      const path = join(directory, formatBackupName(new Date(epoch)))
      try {
        const contents = `${JSON.stringify(validatedValue, null, 2)}\n`
        await writeFile(path, contents, {
          encoding: 'utf8',
          flag: 'wx',
          flush: true
        })
        this.nextEpochByDirectoryAndDay.set(namingKey, epoch + 1)
        return {
          path,
          source,
          kind,
          createdAt: new Date(epoch).toISOString(),
          size: Buffer.byteLength(contents)
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
        epoch += 1
      }
    }

    throw Object.assign(
      new Error(`No unique backup filename remains for ${businessDay}`),
      { code: 'EEXIST' }
    )
  }

  private async retainNewest(
    source: BackupSource,
    kind: BackupKind,
    limit: number
  ): Promise<void> {
    const directory = this.kindPath(source, kind)
    const files = (await this.listParsedFiles(directory)).sort(
      (left, right) => right.epoch - left.epoch
    )
    const validFiles: ParsedBackupFile[] = []
    for (const file of files) {
      if (await this.isValidSnapshot(source, join(directory, file.name))) {
        validFiles.push(file)
      }
    }
    await this.removeSnapshots(directory, validFiles.slice(limit))
  }

  private async isValidSnapshot(
    source: BackupSource,
    path: string
  ): Promise<boolean> {
    try {
      this.validators[source](JSON.parse(await readFile(path, 'utf8')))
      return true
    } catch {
      return false
    }
  }

  private async retainDailyWindow(
    source: 'notes',
    current: Date
  ): Promise<void> {
    const directory = this.kindPath(source, 'daily')
    const currentDay = localDayStart(current)
    const oldestDay = new Date(
      currentDay.getFullYear(),
      currentDay.getMonth(),
      currentDay.getDate() - 29
    ).getTime()
    const newestDay = currentDay.getTime()
    const files = await this.listParsedFiles(directory)
    await this.removeSnapshots(
      directory,
      files.filter(({ epoch }) => {
        const day = localDayStart(new Date(epoch)).getTime()
        return day < oldestDay || day > newestDay
      })
    )
  }

  private async removeExpiredProtected(
    source: BackupSource,
    current: Date
  ): Promise<void> {
    const directory = this.kindPath(source, 'protected')
    const files = await this.listParsedFiles(directory)
    await this.removeSnapshots(
      directory,
      files
        .filter(({ epoch }) => current.getTime() - epoch > PROTECTED_MAX_AGE_MS)
    )
  }

  private async removeSnapshots(
    directory: string,
    files: ParsedBackupFile[]
  ): Promise<void> {
    for (const { name } of files) {
      await rm(join(directory, name), { force: true })
    }
  }

  private async listParsedFiles(
    directory: string
  ): Promise<ParsedBackupFile[]> {
    try {
      const entries = await readdir(directory, { withFileTypes: true })
      return entries.flatMap((entry) => {
        if (!entry.isFile()) {
          return []
        }
        const epoch = parseBackupName(entry.name)
        return epoch === null ? [] : [{ name: entry.name, epoch }]
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  private kindPath(source: BackupSource, kind: BackupKind): string {
    return join(this.rootPath, source, kind)
  }
}

function formatBackupName(date: Date): string {
  return `${formatLocalDate(date)}T${pad(date.getHours(), 2)}-${pad(
    date.getMinutes(),
    2
  )}-${pad(date.getSeconds(), 2)}-${pad(date.getMilliseconds(), 3)}.json`
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1, 2)}-${pad(
    date.getDate(),
    2
  )}`
}

function parseBackupName(name: string): number | null {
  const match = BACKUP_NAME_PATTERN.exec(name)
  if (!match) {
    return null
  }
  const [year, month, day, hour, minute, second, millisecond] = match
    .slice(1)
    .map(Number)
  const date = new Date(year, month - 1, day, hour, minute, second, millisecond)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second ||
    date.getMilliseconds() !== millisecond
  ) {
    return null
  }
  return date.getTime()
}

function localDayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameLocalDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}
