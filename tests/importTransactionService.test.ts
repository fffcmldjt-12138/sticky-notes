import { createHash } from 'node:crypto'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetService } from '../src/main/services/AssetService'
import { DataArchiveService } from '../src/main/services/DataArchiveService'
import {
  ImportTransactionService,
  type ImportTransactionPhase
} from '../src/main/services/ImportTransactionService'
import { NoteStore } from '../src/main/services/NoteStore'
import {
  archiveEntries,
  emptyNotes,
  pngBytes,
  sha256,
  writeStoredZip
} from './archiveTestUtils'

const importedAsset = '01234567-89ab-4cde-8fab-0123456789ab.png'

describe('ImportTransactionService', () => {
  let directory: string
  let notes: NoteStore
  let assets: AssetService

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-import-transaction-'))
    notes = new NoteStore(directory)
    assets = new AssetService(directory)
  })

  it('round trips notes and images through a recoverable confirmation', async () => {
    const source = await mkdtemp(join(tmpdir(), 'sticky-export-source-'))
    const sourceNotes = new NoteStore(source)
    const sourceAssets = new AssetService(source)
    const image = await sourceAssets.importBuffer(pngBytes, 'image/png')
    const note = await sourceNotes.create('note', 'Imported')
    await sourceNotes.update(note.id, note.revision, {
      contentMarkdown: `![image](asset://local/${image.fileName})`
    })
    const archivePath = join(source, 'data.zip')
    await new DataArchiveService(source, sourceNotes, sourceAssets).exportArchive(archivePath)

    await notes.create('note', 'Old')
    const transaction = new ImportTransactionService(directory, notes, assets)
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(archivePath)

    await service.confirmImport(summary.inspectionId)

    expect((await notes.getSnapshot()).items[0].title).toBe('Imported')
    expect(await readFile(join(directory, 'assets', image.fileName))).toEqual(pngBytes)
    const protectedBundles = (await readdir(directory)).filter((name) =>
      name.startsWith('data-import-protected-')
    )
    expect(protectedBundles).toHaveLength(1)
  })

  it('expires, rejects unknown IDs, and consumes a successful ID once', async () => {
    let now = new Date('2026-07-14T00:00:00.000Z')
    const transaction = new ImportTransactionService(directory, notes, assets, {
      now: () => now
    })
    const service = new DataArchiveService(directory, notes, assets, {
      now: () => now,
      transaction
    })
    const archivePath = await writeImportArchive(directory)
    const expired = await service.inspectImport(archivePath)
    now = new Date('2026-07-14T01:00:00.001Z')
    await expect(service.confirmImport(expired.inspectionId)).rejects.toThrow(/expired|过期/i)
    await expect(service.confirmImport('unknown')).rejects.toThrow(/unknown|未知/i)

    now = new Date('2026-07-14T02:00:00.000Z')
    const valid = await service.inspectImport(archivePath)
    await service.confirmImport(valid.inspectionId)
    await expect(service.confirmImport(valid.inspectionId)).rejects.toThrow(/unknown|used|未知|使用/i)
  })

  it('refuses to register staging paths outside the service-owned userData prefix', () => {
    const transaction = new ImportTransactionService(directory, notes, assets)

    expect(() => transaction.registerInspection({
      stagingPath: join(directory, '..', 'outside-staging'),
      manifestSha256: '0'.repeat(64),
      notesSha256: '0'.repeat(64),
      assets: [],
      counts: { itemCount: 0, folderCount: 0, assetCount: 0, orphanAssetCount: 0 }
    })).toThrow(/staging|路径/i)
  })

  it('linearizes concurrent confirmation of the same inspection', async () => {
    const transaction = new ImportTransactionService(directory, notes, assets)
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(await writeImportArchive(directory))

    const results = await Promise.allSettled([
      service.confirmImport(summary.inspectionId),
      service.confirmImport(summary.inspectionId)
    ])

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected'])
  })

  it('revalidates staged files before confirmation and cleans a tampered inspection', async () => {
    const transaction = new ImportTransactionService(directory, notes, assets)
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(await writeImportArchive(directory))
    const staging = (await readdir(directory)).find((name) =>
      /^data-import-staging-[0-9a-f-]{36}$/i.test(name)
    )!
    await writeFile(join(directory, staging, 'notes.json'), JSON.stringify(emptyNotes('tampered')))

    await expect(service.confirmImport(summary.inspectionId)).rejects.toThrow(/changed|变化/i)

    expect((await readdir(directory)).filter((name) =>
      name.startsWith('data-import-staging-')
    )).toEqual([])
  })

  it('fails closed when the journal cannot be published', async () => {
    const oldSnapshot = await notes.getSnapshot()
    await mkdir(join(directory, 'data-import-journal.json'))
    const transaction = new ImportTransactionService(directory, notes, assets)
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(await writeImportArchive(directory))

    await expect(service.confirmImport(summary.inspectionId)).rejects.toThrow()

    expect(await notes.getSnapshot()).toEqual(oldSnapshot)
    expect(await readdir(join(directory, 'assets'))).toEqual([])
  })

  it('rolls assets back even when normal note replacement protection keeps failing', async () => {
    await notes.create('note', 'Old')
    const oldAsset = await assets.importBuffer(pngBytes, 'image/png')
    const oldSnapshot = await notes.getSnapshot()
    vi.spyOn(notes, 'replaceSnapshot').mockRejectedValue(new Error('notes protected backup failed'))
    const transaction = new ImportTransactionService(directory, notes, assets)
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(await writeImportArchive(directory))

    await expect(service.confirmImport(summary.inspectionId)).rejects.toThrow('notes protected backup failed')

    expect(await notes.getSnapshot()).toEqual(oldSnapshot)
    expect(await readFile(join(directory, 'assets', oldAsset.fileName))).toEqual(pngBytes)
    await expect(access(join(directory, 'assets', importedAsset))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each<ImportTransactionPhase>([
    'before-protected',
    'protected',
    'assets-swapped',
    'notes-replaced'
  ])('rolls notes and assets back when confirmation fails at %s', async (failedPhase) => {
    const old = await notes.create('note', 'Old')
    const oldAsset = await assets.importBuffer(pngBytes, 'image/png')
    const oldSnapshot = await notes.getSnapshot()
    const transaction = new ImportTransactionService(directory, notes, assets, {
      onPhase: (phase) => {
        if (phase === failedPhase) throw new Error(`fail at ${phase}`)
      }
    })
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(await writeImportArchive(directory))

    await expect(service.confirmImport(summary.inspectionId)).rejects.toThrow(`fail at ${failedPhase}`)

    expect(await notes.getSnapshot()).toEqual(oldSnapshot)
    expect((await notes.getSnapshot()).items[0].id).toBe(old.id)
    expect(await readFile(join(directory, 'assets', oldAsset.fileName))).toEqual(pngBytes)
    await expect(access(join(directory, 'assets', importedAsset))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(directory, 'data-import-journal.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['protected', 'assets-swapped', 'notes-replaced'] as const)(
    'recovers an interrupted %s journal to the protected notes and assets',
    async (phase) => {
      const oldNotes = emptyNotes('old')
      const importedNotes = emptyNotes(`![new](asset://local/${importedAsset})`)
      await notes.replaceSnapshot(importedNotes, 'import')
      await mkdir(join(directory, 'assets'), { recursive: true })
      await writeFile(join(directory, 'assets', importedAsset), pngBytes)
      await writeInterruptedState(directory, phase, oldNotes)

      const recoveringNotes = new NoteStore(directory)
      const transaction = new ImportTransactionService(
        directory,
        recoveringNotes,
        new AssetService(directory)
      )
      await transaction.recoverInterruptedImport()

      expect(await recoveringNotes.getSnapshot()).toEqual(oldNotes)
      expect(await readFile(join(directory, 'assets', 'old.txt'), 'utf8')).toBe('old asset')
      await expect(access(join(directory, 'assets', importedAsset))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(access(join(directory, 'data-import-journal.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    }
  )

  it('finishes cleanup without rollback for a committed journal', async () => {
    const importedNotes = emptyNotes(`![new](asset://local/${importedAsset})`)
    await notes.replaceSnapshot(importedNotes, 'import')
    await mkdir(join(directory, 'assets'), { recursive: true })
    await writeFile(join(directory, 'assets', importedAsset), pngBytes)
    const names = await writeInterruptedState(directory, 'committed', emptyNotes('old'))

    await new ImportTransactionService(directory, notes, assets).recoverInterruptedImport()

    expect(await notes.getSnapshot()).toEqual(importedNotes)
    expect(await readFile(join(directory, 'assets', importedAsset))).toEqual(pngBytes)
    await expect(access(join(directory, names.staging))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(directory, names.rollback))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('recovers a journal produced from an independently generated staging ID', async () => {
    await notes.create('note', 'Old')
    let capturedJournal = ''
    const transaction = new ImportTransactionService(directory, notes, assets, {
      onPhase: async (phase) => {
        if (phase !== 'protected') return
        capturedJournal = await readFile(join(directory, 'data-import-journal.json'), 'utf8')
        throw new Error('simulate process boundary')
      }
    })
    const service = new DataArchiveService(directory, notes, assets, { transaction })
    const summary = await service.inspectImport(await writeImportArchive(directory))
    await expect(service.confirmImport(summary.inspectionId)).rejects.toThrow('simulate process boundary')
    await writeFile(join(directory, 'data-import-journal.json'), capturedJournal)

    await new ImportTransactionService(directory, notes, assets).recoverInterruptedImport()

    expect((await notes.getSnapshot()).items[0].title).toBe('Old')
  })

  it('retries recovery after a crash left both restored live assets and discard assets', async () => {
    const transactionId = '30000000-0000-4000-8000-000000000000'
    const oldNotes = emptyNotes('old')
    await notes.replaceSnapshot(emptyNotes('imported'), 'import')
    await mkdir(join(directory, 'assets'), { recursive: true })
    await writeFile(join(directory, 'assets', 'old.txt'), 'old asset')
    await mkdir(join(directory, `data-import-discard-${transactionId}`), { recursive: true })
    await writeFile(join(directory, `data-import-discard-${transactionId}`, importedAsset), pngBytes)
    await writeInterruptedState(directory, 'assets-swapped', oldNotes)

    await new ImportTransactionService(directory, notes, assets).recoverInterruptedImport()

    expect(await notes.getSnapshot()).toEqual(oldNotes)
    expect(await readFile(join(directory, 'assets', 'old.txt'), 'utf8')).toBe('old asset')
    await expect(access(join(directory, `data-import-discard-${transactionId}`)))
      .rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('cleans only stale service-owned staging and seven-day protected directories', async () => {
    let now = new Date('2026-07-14T12:00:00.000Z')
    const staleStaging = 'data-import-staging-00000000-0000-4000-8000-000000000000'
    const freshStaging = 'data-import-staging-10000000-0000-4000-8000-000000000000'
    const staleProtected = 'data-import-protected-20000000-0000-4000-8000-000000000000'
    const unrelated = 'data-import-staging-not-owned'
    for (const name of [staleStaging, freshStaging, staleProtected, unrelated]) {
      await mkdir(join(directory, name))
    }
    const old = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
    const fresh = new Date(now.getTime() - 30 * 60 * 1000)
    const { utimes } = await import('node:fs/promises')
    await utimes(join(directory, staleStaging), old, old)
    await utimes(join(directory, staleProtected), old, old)
    await utimes(join(directory, freshStaging), fresh, fresh)

    await new ImportTransactionService(directory, notes, assets, {
      now: () => now
    }).cleanupStaleState()

    await expect(access(join(directory, staleStaging))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(directory, staleProtected))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(access(join(directory, freshStaging))).resolves.toBeUndefined()
    await expect(access(join(directory, unrelated))).resolves.toBeUndefined()
  })
})

async function writeImportArchive(directory: string): Promise<string> {
  const path = join(directory, `import-${Date.now()}-${Math.random()}.zip`)
  const notes = emptyNotes(`![new](asset://local/${importedAsset})`)
  await writeStoredZip(path, archiveEntries(notes, [{
    fileName: importedAsset,
    bytes: pngBytes,
    mimeType: 'image/png'
  }]))
  return path
}

async function writeInterruptedState(
  directory: string,
  phase: 'protected' | 'assets-swapped' | 'notes-replaced' | 'committed',
  oldNotes: ReturnType<typeof emptyNotes>
): Promise<{ staging: string; rollback: string }> {
  const transactionId = '30000000-0000-4000-8000-000000000000'
  const protectedName = `data-import-protected-${transactionId}`
  const staging = `data-import-staging-${transactionId}`
  const rollback = `data-import-rollback-${transactionId}`
  const protectedPath = join(directory, protectedName)
  const notesBytes = Buffer.from(`${JSON.stringify(oldNotes, null, 2)}\n`)
  const oldAsset = Buffer.from('old asset')
  await mkdir(join(protectedPath, 'assets'), { recursive: true })
  await writeFile(join(protectedPath, 'notes.json'), notesBytes)
  await writeFile(join(protectedPath, 'assets', 'old.txt'), oldAsset)
  await writeFile(join(protectedPath, 'manifest.json'), JSON.stringify({
    version: 1,
    transactionId,
    createdAt: '2026-07-14T00:00:00.000Z',
    notesSha256: sha256(notesBytes),
    assets: [{ fileName: 'old.txt', size: oldAsset.length, sha256: sha256(oldAsset) }]
  }))
  await mkdir(join(directory, staging), { recursive: true })
  await mkdir(join(directory, rollback), { recursive: true })
  await writeFile(join(directory, 'data-import-journal.json'), JSON.stringify({
    version: 1,
    transactionId,
    phase,
    protectedDirectory: protectedName,
    stagingDirectory: staging,
    rollbackDirectory: rollback,
    createdAt: '2026-07-14T00:00:00.000Z'
  }))
  return { staging, rollback }
}
