import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

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
    ) => Promise<void>
  ) {}

  read(): Promise<T> {
    return this.enqueue(() => this.readNow())
  }

  write(value: T): Promise<void> {
    return this.enqueue(async () => {
      await this.writeNow(value)
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
        await this.beforeReplace?.(this.filePath, currentValue)
      }

      await rename(temporaryPath, this.filePath)
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
