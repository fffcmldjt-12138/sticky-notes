import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Open } from 'unzipper'
import { beforeEach, describe, expect, it } from 'vitest'
import { AssetService } from '../src/main/services/AssetService'
import { DataArchiveService } from '../src/main/services/DataArchiveService'
import { NoteStore } from '../src/main/services/NoteStore'
import {
  archiveEntries,
  emptyNotes,
  pngBytes,
  writeStoredZip
} from './archiveTestUtils'

const assetName = '01234567-89ab-4cde-8fab-0123456789ab.png'

describe('DataArchiveService', () => {
  let directory: string
  let notes: NoteStore
  let assets: AssetService
  let service: DataArchiveService

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-archive-'))
    notes = new NoteStore(directory)
    assets = new AssetService(directory)
    service = new DataArchiveService(directory, notes, assets, {
      now: () => new Date('2026-07-14T00:00:00.000Z')
    })
  })

  it('exports only a sorted manifest, notes, and canonical assets', async () => {
    const asset = await assets.importBuffer(pngBytes, 'image/png')
    const note = await notes.create('note', 'Round trip')
    await notes.update(note.id, note.revision, {
      contentMarkdown: `![image](asset://local/${asset.fileName})`
    })
    const output = join(directory, 'export.zip')

    await service.exportArchive(output)

    const archive = await Open.file(output)
    expect(archive.files.map((file) => file.path)).toEqual([
      'manifest.json',
      'notes.json',
      `assets/${asset.fileName}`
    ])
    const manifestEntry = archive.files.find((file) => file.path === 'manifest.json')!
    const manifest = JSON.parse((await manifestEntry.buffer()).toString('utf8'))
    expect(manifest).toMatchObject({
      format: 'sticky-notes-data',
      version: 1,
      notesVersion: 7,
      itemCount: 1,
      folderCount: 0,
      assetCount: 1
    })
    expect(manifest.assets[0]).toMatchObject({
      fileName: asset.fileName,
      mimeType: 'image/png',
      size: pngBytes.length
    })
    expect(manifest.notesSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('imports a version 5 archive by migrating its notes to version 7', async () => {
    const archivePath = join(directory, 'version-5.zip')
    const legacy = { version: 5, items: [], folders: [] }
    await writeStoredZip(
      archivePath,
      archiveEntries(legacy as never, [])
    )

    await expect(service.inspectImport(archivePath)).resolves.toMatchObject({
      itemCount: 0,
      folderCount: 0,
      assetCount: 0
    })
  })

  it.each([
    '/absolute',
    '//server/share',
    'C:/drive',
    '\\\\?\\device',
    'assets\\backslash.png',
    'assets/../escape.png',
    'assets/./dot.png',
    'assets//empty.png',
    'assets/name:stream.png',
    'assets/CON.png',
    'assets/CONIN$.png',
    'assets/COM\u00b9.png',
    'assets/trailing. '
  ])('rejects unsafe archive path %s', async (unsafePath) => {
    const archivePath = join(directory, 'unsafe.zip')
    await writeStoredZip(archivePath, [{ name: unsafePath, bytes: Buffer.from('x') }])
    await expect(service.inspectImport(archivePath)).rejects.toThrow(/path|路径/i)
  })

  it.each([
    [[
      { name: 'notes.json', bytes: Buffer.from('a') },
      { name: 'NOTES.JSON', bytes: Buffer.from('b') }
    ]],
    [[
      { name: 'assets', bytes: Buffer.from('a') },
      { name: `assets/${assetName}`, bytes: pngBytes }
    ]],
    [[
      { name: 'e\u0301.json', bytes: Buffer.from('a') },
      { name: '\u00e9.json', bytes: Buffer.from('b') }
    ]]
  ])('rejects duplicate or file-directory prefix conflicts', async (entries) => {
    const archivePath = join(directory, 'conflict.zip')
    await writeStoredZip(archivePath, entries)
    await expect(service.inspectImport(archivePath)).rejects.toThrow(/duplicate|conflict|重复|冲突/i)
  })

  it.each([
    [[
      { name: 'assets', bytes: Buffer.from('file') },
      { name: 'assets/' }
    ]],
    [[
      { name: 'Assets', bytes: Buffer.from('file') },
      { name: `assets/${assetName}`, bytes: pngBytes }
    ]]
  ])('rejects Windows-equivalent prefix conflicts', async (entries) => {
    const archivePath = join(directory, 'windows-prefix-conflict.zip')
    await writeStoredZip(archivePath, entries)
    await expect(service.inspectImport(archivePath)).rejects.toThrow(/conflict|冲突/i)
  })

  it('rejects symlinks, encryption, and unsupported compression methods', async () => {
    const variants = [
      { externalAttributes: 0o120777 << 16, versionMadeBy: 0x0314 },
      { flags: 0x801 },
      { method: 99 }
    ]
    for (const [index, variant] of variants.entries()) {
      const archivePath = join(directory, `metadata-${index}.zip`)
      await writeStoredZip(archivePath, [{
        name: 'notes.json',
        bytes: Buffer.from('{}'),
        ...variant
      }])
      await expect(service.inspectImport(archivePath)).rejects.toThrow()
    }
  })

  it('validates hashes, media magic, and the exact manifest file list', async () => {
    const notesFile = emptyNotes()
    const cases = [
      archiveEntries(notesFile, [{ fileName: assetName, bytes: pngBytes, mimeType: 'image/png' }], {
        notesSha256: '0'.repeat(64)
      }),
      archiveEntries(notesFile, [], { exportedAt: 'not-an-iso-date' }),
      archiveEntries(notesFile, [{ fileName: assetName, bytes: pngBytes, mimeType: 'image/gif' }]),
      archiveEntries(notesFile, [{ fileName: assetName, bytes: Buffer.from('not png'), mimeType: 'image/png' }]),
      [...archiveEntries(notesFile, []), { name: 'extra.txt', bytes: Buffer.from('extra') }]
    ]
    for (const [index, entries] of cases.entries()) {
      const archivePath = join(directory, `invalid-${index}.zip`)
      await writeStoredZip(archivePath, entries)
      await expect(service.inspectImport(archivePath)).rejects.toThrow()
    }
  })

  it('blocks missing references and reports retained orphan assets without live mutation', async () => {
    const missingPath = join(directory, 'missing.zip')
    await writeStoredZip(
      missingPath,
      archiveEntries(emptyNotes(`![missing](asset://local/${assetName})`), [])
    )
    await expect(service.inspectImport(missingPath)).rejects.toThrow(/missing|缺失/i)

    const originalNotes = await notes.getSnapshot()
    await writeFile(join(directory, 'sentinel.txt'), 'live')
    const orphanPath = join(directory, 'orphan.zip')
    await writeStoredZip(orphanPath, archiveEntries(emptyNotes(), [{
      fileName: assetName,
      bytes: pngBytes,
      mimeType: 'image/png'
    }]))

    const summary = await service.inspectImport(orphanPath)

    expect(summary.inspectionId).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(summary).toMatchObject({
      itemCount: 0,
      folderCount: 0,
      assetCount: 1,
      orphanAssetCount: 1
    })
    expect(await notes.getSnapshot()).toEqual(originalNotes)
    expect(await readFile(join(directory, 'sentinel.txt'), 'utf8')).toBe('live')
    expect(await readdir(join(directory, 'assets')).catch(() => [])).toEqual([])
  })

  it('enforces configured entry, file, total, zip, and ratio limits', async () => {
    const archivePath = join(directory, 'limited.zip')
    await writeStoredZip(archivePath, archiveEntries(emptyNotes(), []))
    for (const limits of [
      { maxZipBytes: 1 },
      { maxEntries: 1 },
      { maxManifestBytes: 1 },
      { maxNotesBytes: 1 },
      { maxTotalBytes: 1 },
      { maxCompressionRatio: 0.5 }
    ]) {
      const limited = new DataArchiveService(directory, notes, assets, { limits })
      await expect(limited.inspectImport(archivePath)).rejects.toThrow(/limit|ratio|大小|限额|压缩/i)
    }
  })

  it('removes a partial export when archive creation fails', async () => {
    await writeFile(join(directory, 'assets'), 'not a directory')
    const output = join(directory, 'partial.zip')
    await expect(service.exportArchive(output)).rejects.toThrow()
    await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses to export notes that reference a missing live asset', async () => {
    const note = await notes.create('note', 'Missing asset')
    await notes.update(note.id, note.revision, {
      contentMarkdown: `![missing](asset://local/${assetName})`
    })

    await expect(service.exportArchive(join(directory, 'invalid-export.zip')))
      .rejects.toThrow(/missing|缺失/i)
  })

  it('cancels an inspected import and rejects later confirmation', async () => {
    const archivePath = join(directory, 'cancel.zip')
    await writeStoredZip(archivePath, archiveEntries(emptyNotes(), []))
    const summary = await service.inspectImport(archivePath)

    await service.cancelInspection(summary.inspectionId)

    await expect(service.confirmImport(summary.inspectionId))
      .rejects.toThrow(/unknown|used|inspection/i)
    expect((await readdir(directory)).some((name) =>
      name.startsWith('data-import-staging-')
    )).toBe(false)
  })
})
