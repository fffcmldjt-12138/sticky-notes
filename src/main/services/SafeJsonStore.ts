import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

export class SafeJsonStore<T> {
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    readonly filePath: string,
    private readonly createDefault: () => T,
    private readonly validate: (value: unknown) => T,
    private readonly beforeReplace?: (
      currentPath: string,
      currentValue: T
    ) => Promise<void>
  ) {}

  async read(): Promise<T> {
    await this.writeQueue
    await mkdir(dirname(this.filePath), { recursive: true })

    try {
      return this.validate(JSON.parse(await readFile(this.filePath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }

      const initial = this.createDefault()
      await this.write(initial)
      return initial
    }
  }

  write(value: T): Promise<void> {
    const operation = this.writeQueue.then(() => this.writeNow(value))
    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  private async writeNow(value: T): Promise<void> {
    const directory = dirname(this.filePath)
    await mkdir(directory, { recursive: true })
    const temporaryPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${randomUUID()}.tmp`
    )

    try {
      await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        flush: true
      })

      this.validate(JSON.parse(await readFile(temporaryPath, 'utf8')))

      let currentExists = false
      let currentValue!: T
      try {
        currentValue = this.validate(
          JSON.parse(await readFile(this.filePath, 'utf8'))
        )
        currentExists = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }

      if (currentExists) {
        await this.beforeReplace?.(this.filePath, currentValue)
      }

      await rename(temporaryPath, this.filePath)
    } finally {
      await rm(temporaryPath, { force: true })
    }
  }
}
