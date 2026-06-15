import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { AssetReference } from '../../shared/models'

const imageTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp']
])

export class AssetService {
  private readonly assetDirectory: string
  private readonly trashDirectory: string

  constructor(userDataPath: string) {
    this.assetDirectory = join(userDataPath, 'assets')
    this.trashDirectory = join(userDataPath, 'assets-trash')
  }

  async importBuffer(
    bytes: Uint8Array,
    mimeType: string
  ): Promise<AssetReference> {
    const extension = imageTypes.get(mimeType)
    if (!extension) throw new Error('Unsupported image type')

    await mkdir(this.assetDirectory, { recursive: true })
    const fileName = `${randomUUID()}${extension}`
    await writeFile(join(this.assetDirectory, fileName), bytes)
    return {
      fileName,
      mimeType,
      url: `asset://local/${fileName}`
    }
  }

  async importFile(filePath: string): Promise<AssetReference> {
    const extension = extname(filePath).toLowerCase()
    const mimeType = [...imageTypes.entries()]
      .find(([, candidate]) => candidate === extension)?.[0]
      ?? (extension === '.jpeg' ? 'image/jpeg' : null)
    if (!mimeType) throw new Error('Unsupported image type')
    return this.importBuffer(await readFile(filePath), mimeType)
  }

  resolveUrl(value: string): string | null {
    try {
      const url = new URL(value)
      if (url.protocol !== 'asset:' || url.hostname !== 'local') return null
      const fileName = basename(decodeURIComponent(url.pathname))
      return fileName && fileName === decodeURIComponent(url.pathname).slice(1)
        ? join(this.assetDirectory, fileName)
        : null
    } catch {
      return null
    }
  }

  async cleanUnused(markdownValues: string[], now = Date.now()): Promise<number> {
    await mkdir(this.assetDirectory, { recursive: true })
    await mkdir(this.trashDirectory, { recursive: true })
    const referenced = extractAssetFileNames(markdownValues)
    const files = await readdir(this.assetDirectory)
    const unused = files.filter((fileName) => !referenced.has(fileName))
    await Promise.all(
      unused.map((fileName) =>
        rename(
          join(this.assetDirectory, fileName),
          join(this.trashDirectory, `${now}--${fileName}`)
        )
      )
    )
    return unused.length
  }

  async restoreReferenced(markdownValues: string[]): Promise<number> {
    await mkdir(this.assetDirectory, { recursive: true })
    await mkdir(this.trashDirectory, { recursive: true })
    const referenced = extractAssetFileNames(markdownValues)
    const trashFiles = await readdir(this.trashDirectory)
    let restored = 0
    for (const fileName of referenced) {
      const trashed = trashFiles
        .filter((candidate) => candidate.endsWith(`--${fileName}`))
        .sort()
        .at(-1)
      if (!trashed) continue
      await rename(
        join(this.trashDirectory, trashed),
        join(this.assetDirectory, fileName)
      )
      restored += 1
    }
    return restored
  }

  async purgeTrashBefore(cutoff: Date): Promise<number> {
    await mkdir(this.trashDirectory, { recursive: true })
    const files = await readdir(this.trashDirectory)
    const expired = files.filter((fileName) => {
      const timestamp = Number(fileName.slice(0, fileName.indexOf('--')))
      return Number.isFinite(timestamp) && timestamp <= cutoff.getTime()
    })
    await Promise.all(
      expired.map((fileName) =>
        rm(join(this.trashDirectory, fileName), { force: true })
      )
    )
    return expired.length
  }
}

function extractAssetFileNames(markdownValues: string[]): Set<string> {
  const fileNames = new Set<string>()
  const pattern = /asset:\/\/local\/([^\s)"'>]+)/g
  for (const markdown of markdownValues) {
    for (const match of markdown.matchAll(pattern)) {
      const decoded = decodeURIComponent(match[1])
      if (decoded && basename(decoded) === decoded) fileNames.add(decoded)
    }
  }
  return fileNames
}
