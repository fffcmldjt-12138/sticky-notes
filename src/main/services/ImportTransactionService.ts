import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import type { NotesFile } from '../../shared/models'
import {
  AssetService,
  matchesImageMagic,
  mimeTypeForFileName
} from './AssetService'
import { NoteStore } from './NoteStore'
import { validateNotesFile } from './storageValidators'

const JOURNAL_NAME = 'data-import-journal.json'
const STAGING_PREFIX = 'data-import-staging-'
const PROTECTED_PREFIX = 'data-import-protected-'
const PROTECTED_TEMP_PREFIX = 'data-import-protected-tmp-'
const ROLLBACK_PREFIX = 'data-import-rollback-'
const RESTORE_PREFIX = 'data-import-restore-'
const DISCARD_PREFIX = 'data-import-discard-'
const INSPECTION_TTL_MS = 60 * 60 * 1000
const PROTECTED_TTL_MS = 7 * 24 * 60 * 60 * 1000
const ownedUuid = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const stagingPattern = new RegExp(`^${STAGING_PREFIX}${ownedUuid}$`, 'i')
const protectedPattern = new RegExp(`^${PROTECTED_PREFIX}${ownedUuid}$`, 'i')
const protectedTempPattern = new RegExp(`^${PROTECTED_TEMP_PREFIX}${ownedUuid}$`, 'i')
const uuidPattern = new RegExp(`^${ownedUuid}$`, 'i')

export type ImportTransactionPhase =
  | 'before-protected'
  | 'protected'
  | 'assets-swapped'
  | 'notes-replaced'
  | 'committed'

export interface PreparedAsset {
  fileName: string
  mimeType: string
  size: number
  sha256: string
}

export interface PreparedImport {
  stagingPath: string
  manifestSha256: string
  notesSha256: string
  assets: PreparedAsset[]
  counts: {
    itemCount: number
    folderCount: number
    assetCount: number
    orphanAssetCount: number
  }
}

export interface ImportSummary {
  inspectionId: string
  itemCount: number
  folderCount: number
  assetCount: number
  orphanAssetCount: number
  expiresAt: string
}

interface InspectionLease {
  prepared: PreparedImport
  expiresAt: number
}

type JournalPhase = 'protected' | 'assets-swapped' | 'notes-replaced' | 'committed'

interface ImportJournal {
  version: 1
  transactionId: string
  phase: JournalPhase
  protectedDirectory: string
  stagingDirectory: string
  rollbackDirectory: string
  createdAt: string
}

interface ProtectedManifest {
  version: 1
  transactionId: string
  createdAt: string
  notesSha256: string
  assets: Array<{ fileName: string; size: number; sha256: string }>
}

export class ImportTransactionService {
  private readonly inspections = new Map<string, InspectionLease>()
  private readonly now: () => Date
  private readonly onPhase?: (phase: ImportTransactionPhase) => void | Promise<void>
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly userDataPath: string,
    private readonly notes: NoteStore,
    private readonly assets: AssetService,
    options: {
      now?: () => Date
      onPhase?: (phase: ImportTransactionPhase) => void | Promise<void>
    } = {}
  ) {
    this.now = options.now ?? (() => new Date())
    this.onPhase = options.onPhase
  }

  registerInspection(prepared: PreparedImport): ImportSummary {
    const stagingPath = resolve(prepared.stagingPath)
    const stagingName = basename(stagingPath)
    if (
      dirname(stagingPath) !== resolve(this.userDataPath) ||
      !stagingPattern.test(stagingName)
    ) throw new Error('Invalid import staging path')
    const inspectionId = randomBytes(32).toString('base64url')
    const expiresAt = this.now().getTime() + INSPECTION_TTL_MS
    this.inspections.set(inspectionId, { prepared, expiresAt })
    return {
      inspectionId,
      ...prepared.counts,
      expiresAt: new Date(expiresAt).toISOString()
    }
  }

  async confirmImport(inspectionId: string): Promise<void> {
    const lease = this.inspections.get(inspectionId)
    if (!lease) throw new Error('Unknown or already used inspection ID')
    this.inspections.delete(inspectionId)
    if (this.now().getTime() > lease.expiresAt) {
      await rm(lease.prepared.stagingPath, { recursive: true, force: true })
      throw new Error('Inspection ID expired')
    }
    try {
      await this.enqueue(() => this.confirmPrepared(lease.prepared))
    } catch (error) {
      await rm(lease.prepared.stagingPath, { recursive: true, force: true })
        .catch(() => undefined)
      throw error
    }
  }

  async recoverInterruptedImport(): Promise<void> {
    let journal: ImportJournal
    try {
      journal = validateJournal(JSON.parse(await readFile(this.journalPath, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    if (journal.phase !== 'committed') {
      await this.rollback(journal)
    }
    await this.cleanupCommitted(journal)
  }

  async cleanupStaleState(): Promise<void> {
    const now = this.now().getTime()
    let activeProtected: string | null = null
    try {
      activeProtected = validateJournal(
        JSON.parse(await readFile(this.journalPath, 'utf8'))
      ).protectedDirectory
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const entries = await readdir(this.userDataPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === activeProtected) continue
      const maxAge = stagingPattern.test(entry.name) || protectedTempPattern.test(entry.name)
        ? INSPECTION_TTL_MS
        : protectedPattern.test(entry.name)
          ? PROTECTED_TTL_MS
          : null
      if (maxAge === null) continue
      const path = join(this.userDataPath, entry.name)
      const metadata = await lstat(path)
      if (!metadata.isDirectory() || now - metadata.mtimeMs <= maxAge) continue
      await rm(path, { recursive: true, force: true })
    }
  }

  private async confirmPrepared(prepared: PreparedImport): Promise<void> {
    await this.verifyPrepared(prepared)
    const transactionId = randomUUID()
    const journal: ImportJournal = {
      version: 1,
      transactionId,
      phase: 'protected',
      protectedDirectory: `${PROTECTED_PREFIX}${transactionId}`,
      stagingDirectory: basename(prepared.stagingPath),
      rollbackDirectory: `${ROLLBACK_PREFIX}${transactionId}`,
      createdAt: this.now().toISOString()
    }
    let journalPublished = false
    let committed = false
    try {
      await this.onPhase?.('before-protected')
      await this.createProtectedBundle(journal)
      await this.writeJournal(journal)
      journalPublished = true
      await this.onPhase?.('protected')

      await this.switchAssets(journal)
      journal.phase = 'assets-swapped'
      await this.writeJournal(journal)
      await this.onPhase?.('assets-swapped')

      const importedNotes = await this.readPreparedNotes(prepared)
      await this.notes.replaceSnapshot(importedNotes, 'import')
      journal.phase = 'notes-replaced'
      await this.writeJournal(journal)
      await this.onPhase?.('notes-replaced')

      journal.phase = 'committed'
      await this.writeJournal(journal)
      committed = true
      await this.onPhase?.('committed')
    } catch (error) {
      if (journalPublished && !committed) {
        try {
          await this.rollback(journal)
          await this.cleanupCommitted(journal)
        } catch (rollbackError) {
          throw new AggregateError([error, rollbackError], 'Import failed and rollback did not complete')
        }
      } else if (!journalPublished) {
        await rm(prepared.stagingPath, { recursive: true, force: true })
      }
      throw error
    }
    await this.cleanupCommitted(journal).catch(() => undefined)
  }

  private async verifyPrepared(prepared: PreparedImport): Promise<void> {
    const root = await lstat(prepared.stagingPath)
    if (!root.isDirectory()) throw new Error('Import staging is not a directory')
    const rootEntries = (await readdir(prepared.stagingPath)).sort()
    if (JSON.stringify(rootEntries) !== JSON.stringify(['assets', 'manifest.json', 'notes.json'])) {
      throw new Error('Import staging contents changed')
    }
    const manifestPath = join(prepared.stagingPath, 'manifest.json')
    const manifestMetadata = await lstat(manifestPath)
    if (!manifestMetadata.isFile() || await hashFile(manifestPath) !== prepared.manifestSha256) {
      throw new Error('Import manifest changed after inspection')
    }
    await this.readPreparedNotes(prepared)
    const assetDirectory = join(prepared.stagingPath, 'assets')
    const assetMetadata = await lstat(assetDirectory)
    if (!assetMetadata.isDirectory()) throw new Error('Import assets changed after inspection')
    const entries = await readdir(assetDirectory, { withFileTypes: true })
    const expected = prepared.assets.map((asset) => asset.fileName).sort()
    if (JSON.stringify(entries.map((entry) => entry.name).sort()) !== JSON.stringify(expected)) {
      throw new Error('Import asset list changed after inspection')
    }
    for (const asset of prepared.assets) {
      const path = join(assetDirectory, asset.fileName)
      const metadata = await lstat(path)
      if (!metadata.isFile() || metadata.size !== asset.size || await hashFile(path) !== asset.sha256) {
        throw new Error(`Import asset changed after inspection: ${asset.fileName}`)
      }
      if (
        asset.mimeType !== mimeTypeForFileName(asset.fileName) ||
        !matchesImageMagic(await readFile(path), asset.mimeType)
      ) throw new Error(`Import asset media changed after inspection: ${asset.fileName}`)
    }
  }

  private async readPreparedNotes(prepared: PreparedImport): Promise<NotesFile> {
    const notesPath = join(prepared.stagingPath, 'notes.json')
    const metadata = await lstat(notesPath)
    if (!metadata.isFile() || await hashFile(notesPath) !== prepared.notesSha256) {
      throw new Error('Import notes changed after inspection')
    }
    const notes = validateNotesFile(JSON.parse(await readFile(notesPath, 'utf8')))
    const referenced = this.assets.collectReferencedFileNames(notes)
    const available = new Set(prepared.assets.map((asset) => asset.fileName))
    const missing = [...referenced].find((fileName) => !available.has(fileName))
    if (missing) throw new Error(`Missing referenced asset: ${missing}`)
    return notes
  }

  private async createProtectedBundle(journal: ImportJournal): Promise<void> {
    const temporaryName = `${PROTECTED_TEMP_PREFIX}${journal.transactionId}`
    const temporaryPath = join(this.userDataPath, temporaryName)
    const finalPath = join(this.userDataPath, journal.protectedDirectory)
    await mkdir(join(temporaryPath, 'assets'), { recursive: true })
    try {
      const snapshot = validateNotesFile(await this.notes.getSnapshot())
      const notesBytes = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`)
      await writeFile(join(temporaryPath, 'notes.json'), notesBytes, { flag: 'wx' })
      const liveDirectory = join(this.userDataPath, 'assets')
      await mkdir(liveDirectory, { recursive: true })
      const entries = await readdir(liveDirectory, { withFileTypes: true })
      const manifestAssets: ProtectedManifest['assets'] = []
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const source = join(liveDirectory, entry.name)
        const metadata = await lstat(source)
        if (!entry.isFile() || !metadata.isFile()) {
          throw new Error(`Cannot protect non-regular live asset: ${entry.name}`)
        }
        const destination = join(temporaryPath, 'assets', entry.name)
        await copyFile(source, destination)
        manifestAssets.push({
          fileName: entry.name,
          size: metadata.size,
          sha256: await hashFile(destination)
        })
      }
      const manifest: ProtectedManifest = {
        version: 1,
        transactionId: journal.transactionId,
        createdAt: journal.createdAt,
        notesSha256: sha256(notesBytes),
        assets: manifestAssets
      }
      await writeFile(join(temporaryPath, 'manifest.json'), JSON.stringify(manifest), { flag: 'wx' })
      await verifyProtectedBundle(temporaryPath, journal.transactionId)
      await rename(temporaryPath, finalPath)
    } catch (error) {
      await rm(temporaryPath, { recursive: true, force: true })
      throw error
    }
  }

  private async switchAssets(journal: ImportJournal): Promise<void> {
    const livePath = join(this.userDataPath, 'assets')
    const rollbackPath = join(this.userDataPath, journal.rollbackDirectory)
    const stagedPath = join(this.userDataPath, journal.stagingDirectory, 'assets')
    try {
      await rename(livePath, rollbackPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    try {
      await rename(stagedPath, livePath)
    } catch (error) {
      await rename(rollbackPath, livePath).catch(() => undefined)
      throw error
    }
  }

  private async rollback(journal: ImportJournal): Promise<void> {
    const protectedPath = join(this.userDataPath, journal.protectedDirectory)
    const manifest = await verifyProtectedBundle(protectedPath, journal.transactionId)
    const oldNotes = validateNotesFile(
      JSON.parse(await readFile(join(protectedPath, 'notes.json'), 'utf8'))
    )
    await this.notes.restoreImportRollbackSnapshot(oldNotes)
    await restoreAssets(
      this.userDataPath,
      join(protectedPath, 'assets'),
      journal.transactionId,
      manifest.assets
    )
  }

  private async writeJournal(journal: ImportJournal): Promise<void> {
    const temporaryPath = `${this.journalPath}.tmp-${randomUUID()}`
    const handle = await open(temporaryPath, 'wx')
    try {
      await handle.writeFile(`${JSON.stringify(journal, null, 2)}\n`)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await rename(temporaryPath, this.journalPath)
    } catch (error) {
      await rm(temporaryPath, { force: true })
      throw error
    }
  }

  private async cleanupCommitted(journal: ImportJournal): Promise<void> {
    await rm(join(this.userDataPath, journal.stagingDirectory), { recursive: true, force: true })
    await rm(join(this.userDataPath, journal.rollbackDirectory), { recursive: true, force: true })
    await rm(this.journalPath, { force: true })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.operationQueue.then(operation, operation)
    this.operationQueue = result.catch(() => undefined)
    return result
  }

  private get journalPath(): string {
    return join(this.userDataPath, JOURNAL_NAME)
  }
}

async function restoreAssets(
  userDataPath: string,
  protectedAssetsPath: string,
  transactionId: string,
  assets: ProtectedManifest['assets']
): Promise<void> {
  const restorePath = join(userDataPath, `${RESTORE_PREFIX}${transactionId}`)
  const discardPath = join(userDataPath, `${DISCARD_PREFIX}${transactionId}`)
  const livePath = join(userDataPath, 'assets')
  await rm(restorePath, { recursive: true, force: true })
  await rm(discardPath, { recursive: true, force: true })
  await mkdir(restorePath)
  for (const asset of assets) {
    await copyFile(join(protectedAssetsPath, asset.fileName), join(restorePath, asset.fileName))
  }
  try {
    await rename(livePath, discardPath)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  await rename(restorePath, livePath)
  await rm(discardPath, { recursive: true, force: true })
}

async function verifyProtectedBundle(
  protectedPath: string,
  transactionId: string
): Promise<ProtectedManifest> {
  const root = await lstat(protectedPath)
  if (!root.isDirectory()) throw new Error('Protected import bundle is not a directory')
  const manifest = validateProtectedManifest(
    JSON.parse(await readFile(join(protectedPath, 'manifest.json'), 'utf8')),
    transactionId
  )
  const notesPath = join(protectedPath, 'notes.json')
  if ((await lstat(notesPath)).isFile() === false || await hashFile(notesPath) !== manifest.notesSha256) {
    throw new Error('Protected notes do not match manifest')
  }
  validateNotesFile(JSON.parse(await readFile(notesPath, 'utf8')))
  const assetDirectory = join(protectedPath, 'assets')
  if (!(await lstat(assetDirectory)).isDirectory()) throw new Error('Protected assets missing')
  const entries = await readdir(assetDirectory, { withFileTypes: true })
  const expected = manifest.assets.map((asset) => asset.fileName).sort()
  if (JSON.stringify(entries.map((entry) => entry.name).sort()) !== JSON.stringify(expected)) {
    throw new Error('Protected asset list mismatch')
  }
  for (const asset of manifest.assets) {
    const path = join(assetDirectory, asset.fileName)
    const metadata = await lstat(path)
    if (!metadata.isFile() || metadata.size !== asset.size || await hashFile(path) !== asset.sha256) {
      throw new Error('Protected asset mismatch')
    }
  }
  return manifest
}

function validateJournal(value: unknown): ImportJournal {
  if (!isObject(value)) throw new Error('Invalid import journal')
  exactKeys(value, [
    'version', 'transactionId', 'phase', 'protectedDirectory',
    'stagingDirectory', 'rollbackDirectory', 'createdAt'
  ])
  if (
    value.version !== 1 || typeof value.transactionId !== 'string' ||
    !uuidPattern.test(value.transactionId) ||
    !['protected', 'assets-swapped', 'notes-replaced', 'committed'].includes(String(value.phase)) ||
    value.protectedDirectory !== `${PROTECTED_PREFIX}${value.transactionId}` ||
    typeof value.stagingDirectory !== 'string' || !stagingPattern.test(value.stagingDirectory) ||
    value.rollbackDirectory !== `${ROLLBACK_PREFIX}${value.transactionId}` ||
    typeof value.createdAt !== 'string' || Number.isNaN(Date.parse(value.createdAt))
  ) throw new Error('Invalid import journal')
  return value as unknown as ImportJournal
}

function validateProtectedManifest(value: unknown, transactionId: string): ProtectedManifest {
  if (!isObject(value)) throw new Error('Invalid protected manifest')
  exactKeys(value, ['version', 'transactionId', 'createdAt', 'notesSha256', 'assets'])
  if (
    value.version !== 1 || value.transactionId !== transactionId ||
    typeof value.createdAt !== 'string' || !isSha256(value.notesSha256) ||
    !Array.isArray(value.assets)
  ) throw new Error('Invalid protected manifest')
  for (const asset of value.assets) {
    if (!isObject(asset)) throw new Error('Invalid protected asset')
    exactKeys(asset, ['fileName', 'size', 'sha256'])
    if (
      typeof asset.fileName !== 'string' || basename(asset.fileName) !== asset.fileName ||
      !Number.isSafeInteger(asset.size) || (asset.size as number) < 0 || !isSha256(asset.sha256)
    ) throw new Error('Invalid protected asset')
  }
  return value as unknown as ProtectedManifest
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  const handle = await open(path, 'r')
  try {
    for await (const chunk of handle.readableWebStream()) {
      hash.update(Buffer.from(chunk as Uint8Array))
    }
  } finally {
    await handle.close()
  }
  return hash.digest('hex')
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: string[]): void {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error('Invalid transaction metadata fields')
  }
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}
