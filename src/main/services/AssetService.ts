import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
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

  constructor(userDataPath: string) {
    this.assetDirectory = join(userDataPath, 'assets')
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
}
