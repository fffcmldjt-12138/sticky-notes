import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import type { NotesFile } from '../src/shared/models'

export const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
])

export interface StoredZipEntry {
  name: string
  bytes?: Buffer
  flags?: number
  method?: number
  externalAttributes?: number
  versionMadeBy?: number
  declaredCompressedSize?: number
  declaredUncompressedSize?: number
}

export async function writeStoredZip(
  filePath: string,
  entries: StoredZipEntry[]
): Promise<void> {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const bytes = entry.bytes ?? Buffer.alloc(0)
    const crc = crc32(bytes)
    const compressedSize = entry.declaredCompressedSize ?? bytes.length
    const uncompressedSize = entry.declaredUncompressedSize ?? bytes.length
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(entry.flags ?? 0x800, 6)
    local.writeUInt16LE(entry.method ?? 0, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressedSize, 18)
    local.writeUInt32LE(uncompressedSize, 22)
    local.writeUInt16LE(name.length, 26)
    locals.push(local, name, bytes)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(entry.versionMadeBy ?? 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(entry.flags ?? 0x800, 8)
    central.writeUInt16LE(entry.method ?? 0, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressedSize, 20)
    central.writeUInt32LE(uncompressedSize, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE((entry.externalAttributes ?? 0) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += local.length + name.length + bytes.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  await writeFile(filePath, Buffer.concat([...locals, ...centrals, end]))
}

export function archiveEntries(
  notes: NotesFile,
  assets: Array<{ fileName: string; bytes: Buffer; mimeType: string }>,
  overrides: Record<string, unknown> = {}
): StoredZipEntry[] {
  const notesBytes = Buffer.from(JSON.stringify(notes, null, 2))
  const manifest = {
    format: 'sticky-notes-data',
    version: 1,
    exportedAt: '2026-07-14T00:00:00.000Z',
    notesVersion: notes.version,
    itemCount: notes.items.length,
    folderCount: notes.folders.length,
    assetCount: assets.length,
    notesSha256: sha256(notesBytes),
    assets: assets.map((asset) => ({
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      size: asset.bytes.length,
      sha256: sha256(asset.bytes)
    })),
    ...overrides
  }
  return [
    { name: 'manifest.json', bytes: Buffer.from(JSON.stringify(manifest)) },
    { name: 'notes.json', bytes: notesBytes },
    ...assets.map((asset) => ({
      name: `assets/${asset.fileName}`,
      bytes: asset.bytes
    }))
  ]
}

export function emptyNotes(markdown = ''): NotesFile {
  if (!markdown) return { version: 5, items: [], folders: [] }
  const now = '2026-07-14T00:00:00.000Z'
  return {
    version: 5,
    folders: [],
    items: [{
      id: 'note-1',
      revision: 1,
      type: 'note',
      title: 'Archive note',
      headerColor: '#f2c94c',
      bodyTheme: 'light',
      pinned: false,
      detached: false,
      windowBounds: null,
      parentFolderId: null,
      tags: [],
      order: 0,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      contentMarkdown: markdown,
      syncedToSiyuan: false
    }]
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
