import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export type BackupPhase = 'beforeReplace' | 'afterReplace'
export type BackupDiagnostic = (
  error: unknown,
  phase: BackupPhase
) => void | Promise<void>

export class SafeJsonStore<T> {
  private operationQueue: Promise<void> = Promise.resolve()

  /** The validator only validates and narrows persisted JSON; it must not migrate it. */
  constructor(
    readonly filePath: string,
    private readonly createDefault: () => T,
    private readonly validate: (value: unknown) => T,
    private readonly beforeReplace?: (
      currentPath: string,
      currentValue: T
    ) => Promise<void>,
    private readonly afterReplace?: (
      currentPath: string,
      newValue: T
    ) => Promise<void>,
    private readonly diagnostic?: BackupDiagnostic
  ) {}

  read(): Promise<T> {
    return this.enqueue(() => this.readNow())
  }

  write(value: T): Promise<void> {
    return this.enqueue(async () => {
      await this.writeNow(value)
    })
  }

  replaceInvalid(value: T, preservedPath: string): Promise<void> {
    return this.enqueue(() => this.replaceInvalidNow(value, preservedPath))
  }

  private enqueue<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }

  private async readNow(): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true })

    const contents = await this.readFileIfExists()
    if (contents === undefined) {
      return this.writeNow(this.createDefault())
    }

    return this.validate(JSON.parse(contents))
  }

  private async writeNow(value: T): Promise<T> {
    const directory = dirname(this.filePath)
    await mkdir(directory, { recursive: true })
    const temporaryPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`
    )
    let hasPrimaryError = false

    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        flush: true
      })

      const validatedValue = this.validate(
        JSON.parse(await readFile(temporaryPath, 'utf8'))
      )

      const currentContents = await this.readFileIfExists()
      if (currentContents !== undefined) {
        const currentValue = this.validate(JSON.parse(currentContents))
        await this.runBackup(
          'beforeReplace',
          this.beforeReplace,
          currentValue
        )
      }

      await rename(temporaryPath, this.filePath)
      await this.runBackup('afterReplace', this.afterReplace, validatedValue)
      return validatedValue
    } catch (error) {
      hasPrimaryError = true
      throw error
    } finally {
      try {
        await rm(temporaryPath, { force: true })
      } catch (cleanupError) {
        if (!hasPrimaryError) {
          throw cleanupError
        }
      }
    }
  }

  private async replaceInvalidNow(value: T, preservedPath: string): Promise<void> {
    const directory = dirname(this.filePath)
    await mkdir(directory, { recursive: true })
    const temporaryPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`
    )
    const stagingPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.recovery`
    )
    let movedPath: string | undefined
    let replacementSucceeded = false

    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        flush: true
      })
      this.validate(JSON.parse(await readFile(temporaryPath, 'utf8')))

      const preserveAlreadyExists = await pathExists(preservedPath)
      movedPath = preserveAlreadyExists ? stagingPath : preservedPath
      await rename(this.filePath, movedPath)
      try {
        await rename(temporaryPath, this.filePath)
        replacementSucceeded = true
      } catch (error) {
        try {
          await rename(movedPath, this.filePath)
          movedPath = undefined
        } catch {
          // Preserve the replacement error; the moved original remains recoverable.
        }
        throw error
      }

      if (preserveAlreadyExists) {
        await rm(movedPath, { force: true })
        movedPath = undefined
      }
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined)
      if (!replacementSucceeded && movedPath && await pathExists(this.filePath)) {
        await rm(movedPath, { force: true }).catch(() => undefined)
      }
    }
  }

  private async runBackup(
    phase: BackupPhase,
    backup: ((currentPath: string, value: T) => Promise<void>) | undefined,
    value: T
  ): Promise<void> {
    if (!backup) {
      return
    }
    try {
      await backup(this.filePath, value)
    } catch (error) {
      try {
        await this.diagnostic?.(error, phase)
      } catch {
        // Diagnostics must never change persistence behavior.
      }
    }
  }

  private async readFileIfExists(): Promise<string | undefined> {
    try {
      return await readFile(this.filePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined
      }
      throw error
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}
