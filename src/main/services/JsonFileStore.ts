import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly createDefault: () => T
  ) {}

  async read(): Promise<T> {
    await mkdir(dirname(this.filePath), { recursive: true })
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as T
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code === 'ENOENT') {
        const initial = this.createDefault()
        await this.write(initial)
        return initial
      }

      await copyFile(this.filePath, `${this.filePath}.corrupt-${Date.now()}`)
      const initial = this.createDefault()
      await this.write(initial)
      return initial
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.filePath)
  }
}

