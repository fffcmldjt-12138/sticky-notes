import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ZipArchive } from 'archiver'
import { Open, type File as ZipEntry } from 'unzipper'
import type { NotesFile } from '../../shared/models'
import {
  AssetService,
  matchesImageMagic,
  mimeTypeForFileName
} from './AssetService'
import { NoteStore } from './NoteStore'
import {
  ImportTransactionService,
  type ImportSummary,
  type PreparedImport
} from './ImportTransactionService'
import { validateNotesFile } from './storageValidators'

const STAGING_PREFIX = 'data-import-staging-'
const reservedWindowsName =
  /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9\u00b9\u00b2\u00b3]|lpt[1-9\u00b9\u00b2\u00b3])(?:\.|$)/i

export interface ArchiveLimits {
  maxZipBytes: number
  maxEntries: number
  maxManifestBytes: number
  maxNotesBytes: number
  maxAssetBytes: number
  maxTotalBytes: number
  maxCompressionRatio: number
}

export type { ImportSummary } from './ImportTransactionService'

export interface ManifestAsset {
  fileName: string
  mimeType: string
  size: number
  sha256: string
}

export interface ArchiveManifest {
  format: 'sticky-notes-data'
  version: 1
  exportedAt: string
  notesVersion: 5
  itemCount: number
  folderCount: number
  assetCount: number
  notesSha256: string
  assets: ManifestAsset[]
}

const defaultLimits: ArchiveLimits = {
  maxZipBytes: 512 * 1024 * 1024,
  maxEntries: 10_000,
  maxManifestBytes: 1024 * 1024,
  maxNotesBytes: 64 * 1024 * 1024,
  maxAssetBytes: 128 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 100
}

export class DataArchiveService {
  private readonly limits: ArchiveLimits
  private readonly now: () => Date
  private readonly transaction: ImportTransactionService

  constructor(
    private readonly userDataPath: string,
    private readonly notes: NoteStore,
    private readonly assets: AssetService,
    options: {
      now?: () => Date
      limits?: Partial<ArchiveLimits>
      transaction?: ImportTransactionService
    } = {}
  ) {
    this.now = options.now ?? (() => new Date())
    this.limits = { ...defaultLimits, ...options.limits }
    this.transaction = options.transaction ?? new ImportTransactionService(
      userDataPath,
      notes,
      assets,
      { now: this.now }
    )
  }

  async exportArchive(destinationPath: string): Promise<void> {
    const notes = validateNotesFile(await this.notes.getSnapshot())
    const notesBytes = Buffer.from(`${JSON.stringify(notes, null, 2)}\n`)
    const liveAssets = await this.assets.listLiveAssets()
    const liveAssetNames = new Set(liveAssets.map((asset) => asset.fileName))
    const missingReference = [...this.assets.collectReferencedFileNames(notes)]
      .find((fileName) => !liveAssetNames.has(fileName))
    if (missingReference) throw new Error(`Missing referenced asset: ${missingReference}`)
    const manifestAssets: ManifestAsset[] = []
    for (const asset of liveAssets) {
      if (asset.size > this.limits.maxAssetBytes) throw new Error('Asset size limit exceeded')
      const bytes = await readFile(asset.path)
      if (bytes.length !== asset.size || !matchesImageMagic(bytes, asset.mimeType)) {
        throw new Error(`Invalid live asset: ${asset.fileName}`)
      }
      manifestAssets.push({
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        size: bytes.length,
        sha256: sha256(bytes)
      })
    }
    const manifest: ArchiveManifest = {
      format: 'sticky-notes-data',
      version: 1,
      exportedAt: this.now().toISOString(),
      notesVersion: 5,
      itemCount: notes.items.length,
      folderCount: notes.folders.length,
      assetCount: manifestAssets.length,
      notesSha256: sha256(notesBytes),
      assets: manifestAssets
    }
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
    const partialPath = `${destinationPath}.partial-${randomUUID()}`
    await mkdir(dirname(destinationPath), { recursive: true })
    try {
      await writeArchive(partialPath, [
        { name: 'manifest.json', bytes: manifestBytes },
        { name: 'notes.json', bytes: notesBytes },
        ...liveAssets.map((asset) => ({
          name: `assets/${asset.fileName}`,
          path: asset.path
        }))
      ].sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
      await rename(partialPath, destinationPath)
    } catch (error) {
      await rm(partialPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async inspectImport(archivePath: string): Promise<ImportSummary> {
    const archiveMetadata = await stat(archivePath)
    if (!archiveMetadata.isFile() || archiveMetadata.size > this.limits.maxZipBytes) {
      throw new Error('ZIP size limit exceeded')
    }
    const archive = await Open.file(archivePath)
    validateCentralDirectory(archive.files, this.limits)
    const stagingPath = join(this.userDataPath, `${STAGING_PREFIX}${randomUUID()}`)
    await mkdir(stagingPath, { recursive: false })
    try {
      const extracted = new Map<string, { path: string; size: number; sha256: string }>()
      let actualTotal = 0
      for (const entry of archive.files) {
        if (entry.type === 'Directory') {
          const directoryPath = join(stagingPath, ...entry.path.split('/').filter(Boolean))
          await mkdir(directoryPath, { recursive: true })
          continue
        }
        const destination = join(stagingPath, ...entry.path.split('/'))
        await mkdir(dirname(destination), { recursive: true })
        const result = await streamEntry(entry, destination, limitForEntry(entry.path, this.limits))
        if (result.size !== entry.uncompressedSize) throw new Error('ZIP declared size mismatch')
        actualTotal += result.size
        if (actualTotal > this.limits.maxTotalBytes) throw new Error('Archive total size limit exceeded')
        const metadata = await lstat(destination)
        if (!metadata.isFile()) throw new Error('Extracted entry is not a regular file')
        extracted.set(entry.path, { path: destination, ...result })
      }
      const manifestFile = requiredExtracted(extracted, 'manifest.json')
      const notesFile = requiredExtracted(extracted, 'notes.json')
      const manifest = validateManifest(
        JSON.parse((await readFile(manifestFile.path, 'utf8')).replace(/^\uFEFF/, ''))
      )
      if (manifestFile.size > this.limits.maxManifestBytes) throw new Error('Manifest size limit exceeded')
      if (notesFile.size > this.limits.maxNotesBytes) throw new Error('Notes size limit exceeded')
      if (notesFile.sha256 !== manifest.notesSha256) throw new Error('Notes hash mismatch')
      const importedNotes = validateNotesFile(JSON.parse(await readFile(notesFile.path, 'utf8')))
      if (
        manifest.notesVersion !== importedNotes.version ||
        manifest.itemCount !== importedNotes.items.length ||
        manifest.folderCount !== importedNotes.folders.length ||
        manifest.assetCount !== manifest.assets.length
      ) throw new Error('Manifest notes counts mismatch')

      const declaredNames = new Set<string>()
      for (const asset of manifest.assets) {
        if (!this.assets.isCanonicalFileName(asset.fileName)) throw new Error('Invalid asset filename')
        if (declaredNames.has(asset.fileName)) throw new Error('Duplicate manifest asset')
        declaredNames.add(asset.fileName)
        if (asset.mimeType !== mimeTypeForFileName(asset.fileName)) throw new Error('Asset MIME mismatch')
        const actual = requiredExtracted(extracted, `assets/${asset.fileName}`)
        if (actual.size !== asset.size || actual.sha256 !== asset.sha256) {
          throw new Error('Asset size or hash mismatch')
        }
        if (!matchesImageMagic(await readFile(actual.path), asset.mimeType)) {
          throw new Error('Asset magic mismatch')
        }
      }
      const allowed = new Set([
        'manifest.json',
        'notes.json',
        'assets/',
        ...manifest.assets.map((asset) => `assets/${asset.fileName}`)
      ])
      const extra = archive.files.find((entry) => !allowed.has(entry.path))
      if (extra) throw new Error(`Extra archive entry: ${extra.path}`)
      const referenced = this.assets.collectReferencedFileNames(importedNotes)
      const missing = [...referenced].find((fileName) => !declaredNames.has(fileName))
      if (missing) throw new Error(`Missing referenced asset: ${missing}`)
      await mkdir(join(stagingPath, 'assets'), { recursive: true })
      const prepared: PreparedImport = {
        stagingPath,
        manifestSha256: manifestFile.sha256,
        notesSha256: manifest.notesSha256,
        assets: manifest.assets,
        counts: {
        itemCount: importedNotes.items.length,
        folderCount: importedNotes.folders.length,
        assetCount: manifest.assets.length,
          orphanAssetCount: manifest.assets.filter((asset) => !referenced.has(asset.fileName)).length
        }
      }
      return this.transaction.registerInspection(prepared)
    } catch (error) {
      await rm(stagingPath, { recursive: true, force: true })
      throw error
    }
  }

  confirmImport(inspectionId: string): Promise<void> {
    return this.transaction.confirmImport(inspectionId)
  }

  cancelInspection(inspectionId: string): Promise<void> {
    return this.transaction.cancelInspection(inspectionId)
  }

  recoverInterruptedImport(): Promise<void> {
    return this.transaction.recoverInterruptedImport()
  }

  cleanupStaleState(): Promise<void> {
    return this.transaction.cleanupStaleState()
  }
}

function validateCentralDirectory(entries: ZipEntry[], limits: ArchiveLimits): void {
  if (entries.length > limits.maxEntries) throw new Error('Entry count limit exceeded')
  const keys = new Map<string, { path: string; directory: boolean }>()
  const paths: Array<{ path: string; directory: boolean }> = []
  let total = 0
  for (const entry of entries) {
    validateArchivePath(entry.path)
    const directory = entry.type === 'Directory'
    const key = entry.path.replace(/\/$/, '').normalize('NFC').toLocaleLowerCase('en-US')
    const existing = keys.get(key)
    if (existing) {
      throw new Error(existing.directory === directory
        ? 'Duplicate archive path'
        : 'Archive file-directory prefix conflict')
    }
    keys.set(key, { path: entry.path, directory })
    validateEntryType(entry, directory)
    if ((entry.flags & 0x1) !== 0) throw new Error('Encrypted ZIP entries are not supported')
    if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
      throw new Error('Unsupported ZIP compression method')
    }
    if (!directory) {
      const perFileLimit = limitForEntry(entry.path, limits)
      if (entry.uncompressedSize > perFileLimit) throw new Error('Entry size limit exceeded')
      total += entry.uncompressedSize
      if (total > limits.maxTotalBytes) throw new Error('Archive total size limit exceeded')
      const ratio = entry.uncompressedSize / Math.max(1, entry.compressedSize)
      if (ratio > limits.maxCompressionRatio) throw new Error('ZIP compression ratio limit exceeded')
    }
    paths.push({ path: key, directory })
  }
  for (const candidate of paths) {
    for (const other of paths) {
      if (candidate === other) continue
      if (!candidate.directory && other.path.startsWith(`${candidate.path}/`)) {
        throw new Error('Archive file-directory prefix conflict')
      }
    }
  }
}

function validateArchivePath(path: string): void {
  if (!path || path.includes('\0') || path.includes('\\') || path.includes(':')) {
    throw new Error('Unsafe archive path')
  }
  if (path.startsWith('/') || /^\/?[a-z]:/i.test(path)) throw new Error('Unsafe archive path')
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path
  const segments = trimmed.split('/')
  if (!segments.length || segments.some((segment) =>
    !segment || segment === '.' || segment === '..' || /[. ]$/.test(segment) || reservedWindowsName.test(segment)
  )) throw new Error('Unsafe archive path')
}

function validateEntryType(entry: ZipEntry, directory: boolean): void {
  const madeBy = entry.versionMadeBy >> 8
  if (madeBy !== 3) return
  const mode = entry.externalFileAttributes >>> 16
  const kind = mode & 0o170000
  if (kind === 0) return
  if (directory ? kind !== 0o040000 : kind !== 0o100000) {
    throw new Error('Unsupported ZIP entry type')
  }
}

function limitForEntry(path: string, limits: ArchiveLimits): number {
  if (path === 'manifest.json') return limits.maxManifestBytes
  if (path === 'notes.json') return limits.maxNotesBytes
  if (path.startsWith('assets/')) return limits.maxAssetBytes
  return Math.max(limits.maxManifestBytes, limits.maxNotesBytes, limits.maxAssetBytes)
}

async function streamEntry(
  entry: ZipEntry,
  destination: string,
  limit: number
): Promise<{ size: number; sha256: string }> {
  const handle = await open(destination, 'wx')
  const hash = createHash('sha256')
  let size = 0
  try {
    for await (const rawChunk of entry.stream()) {
      const chunk = Buffer.from(rawChunk as Uint8Array)
      size += chunk.length
      if (size > limit) throw new Error('Actual entry size limit exceeded')
      hash.update(chunk)
      await handle.write(chunk)
    }
  } finally {
    await handle.close()
  }
  return { size, sha256: hash.digest('hex') }
}

function requiredExtracted(
  extracted: Map<string, { path: string; size: number; sha256: string }>,
  path: string
): { path: string; size: number; sha256: string } {
  const value = extracted.get(path)
  if (!value) throw new Error(`Missing archive entry: ${path}`)
  return value
}

function validateManifest(value: unknown): ArchiveManifest {
  if (!isObject(value)) throw new Error('Invalid manifest')
  exactKeys(value, [
    'format', 'version', 'exportedAt', 'notesVersion', 'itemCount',
    'folderCount', 'assetCount', 'notesSha256', 'assets'
  ])
  if (
    value.format !== 'sticky-notes-data' || value.version !== 1 ||
    value.notesVersion !== 5 || !isIsoDate(value.exportedAt) ||
    !Number.isSafeInteger(value.itemCount) || !Number.isSafeInteger(value.folderCount) ||
    !Number.isSafeInteger(value.assetCount) || !isSha256(value.notesSha256) ||
    (value.itemCount as number) < 0 || (value.folderCount as number) < 0 ||
    (value.assetCount as number) < 0 || !Array.isArray(value.assets)
  ) throw new Error('Invalid manifest')
  for (const asset of value.assets) {
    if (!isObject(asset)) throw new Error('Invalid manifest asset')
    exactKeys(asset, ['fileName', 'mimeType', 'size', 'sha256'])
    if (
      typeof asset.fileName !== 'string' || typeof asset.mimeType !== 'string' ||
      !Number.isSafeInteger(asset.size) || (asset.size as number) < 0 || !isSha256(asset.sha256)
    ) throw new Error('Invalid manifest asset')
  }
  return value as unknown as ArchiveManifest
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value).sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== [...expected].sort()[index])) {
    throw new Error('Invalid manifest fields')
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const epoch = Date.parse(value)
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function writeArchive(
  destination: string,
  entries: Array<{ name: string; bytes?: Buffer; path?: string }>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(destination, { flags: 'wx' })
    const archive = new ZipArchive({ zlib: { level: 9 } })
    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
    archive.pipe(output)
    for (const entry of entries) {
      if (entry.bytes) archive.append(entry.bytes, { name: entry.name })
      else archive.file(entry.path!, { name: entry.name })
    }
    void archive.finalize()
  })
}
