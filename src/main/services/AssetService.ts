import { randomUUID } from 'node:crypto'
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { AssetReference, NotesFile } from '../../shared/models'

const imageTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/gif', '.gif'],
  ['image/webp', '.webp']
])
const canonicalAssetPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:png|jpe?g|gif|webp)$/

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

  isCanonicalFileName(fileName: string): boolean {
    return canonicalAssetPattern.test(fileName)
  }

  collectReferencedFileNames(notes: NotesFile): Set<string> {
    const markdownValues: string[] = []
    for (const item of notes.items) {
      if (item.type === 'note') {
        markdownValues.push(item.contentMarkdown)
        continue
      }
      for (const task of item.tasks) {
        markdownValues.push(task.contentMarkdown)
        markdownValues.push(...task.children.map((child) => child.contentMarkdown))
      }
    }
    return extractAssetFileNames(markdownValues, (name) =>
      this.isCanonicalFileName(name)
    )
  }

  async listLiveAssets(): Promise<Array<{
    fileName: string
    path: string
    size: number
    mimeType: string
  }>> {
    await mkdir(this.assetDirectory, { recursive: true })
    const entries = await readdir(this.assetDirectory, { withFileTypes: true })
    const assets = []
    for (const entry of entries) {
      if (!entry.isFile() || !this.isCanonicalFileName(entry.name)) continue
      const path = join(this.assetDirectory, entry.name)
      const metadata = await lstat(path)
      if (!metadata.isFile()) throw new Error(`Asset is not a regular file: ${entry.name}`)
      assets.push({
        fileName: entry.name,
        path,
        size: metadata.size,
        mimeType: mimeTypeForFileName(entry.name)
      })
    }
    return assets.sort((left, right) => left.fileName.localeCompare(right.fileName))
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
    const liveFiles = new Set(await readdir(this.assetDirectory))
    const trashFiles = await readdir(this.trashDirectory)
    let restored = 0
    for (const fileName of referenced) {
      if (liveFiles.has(fileName)) continue
      const trashed = trashFiles
        .filter((candidate) => candidate.endsWith(`--${fileName}`))
        .sort()
        .at(-1)
      if (!trashed) continue
      await rename(
        join(this.trashDirectory, trashed),
        join(this.assetDirectory, fileName)
      )
      liveFiles.add(fileName)
      restored += 1
    }
    return restored
  }

  async findMissingReferenced(notes: NotesFile): Promise<string[]> {
    const referenced = this.collectReferencedFileNames(notes)
    const live = new Set((await this.listLiveAssets()).map((asset) => asset.fileName))
    return [...referenced].filter((fileName) => !live.has(fileName)).sort()
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

export function mimeTypeForFileName(fileName: string): string {
  const extension = extname(fileName).toLowerCase()
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.gif') return 'image/gif'
  if (extension === '.webp') return 'image/webp'
  throw new Error(`Unsupported asset filename: ${fileName}`)
}

export function matchesImageMagic(bytes: Uint8Array, mimeType: string): boolean {
  const buffer = Buffer.from(bytes)
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  if (mimeType === 'image/gif') {
    const signature = buffer.subarray(0, 6).toString('ascii')
    return signature === 'GIF87a' || signature === 'GIF89a'
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

function extractAssetFileNames(
  markdownValues: string[],
  accept: (fileName: string) => boolean = () => true
): Set<string> {
  const fileNames = new Set<string>()
  const pattern = /asset:\/\/local\/([^\s)"'>]+)/g
  for (const markdown of markdownValues) {
    for (const match of markdown.matchAll(pattern)) {
      try {
        const decoded = decodeURIComponent(match[1])
        if (decoded && basename(decoded) === decoded && accept(decoded)) {
          fileNames.add(decoded)
        }
      } catch {
        // Malformed user-authored URLs are ignored rather than crashing cleanup.
      }
    }
  }
  return fileNames
}
