import { access, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { AssetService } from '../src/main/services/AssetService'
import type { NotesFile } from '../src/shared/models'

describe('AssetService', () => {
  let directory: string
  let service: AssetService

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-assets-'))
    service = new AssetService(directory)
  })

  it('stores supported image bytes under a generated stable asset URL', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const asset = await service.importBuffer(bytes, 'image/png')

    expect(asset.url).toMatch(/^asset:\/\/local\/[a-z0-9-]+\.png$/)
    const files = await readdir(join(directory, 'assets'))
    expect(files).toEqual([asset.fileName])
    expect(await readFile(join(directory, 'assets', asset.fileName))).toEqual(bytes)
  })

  it('rejects unsupported clipboard data', async () => {
    await expect(
      service.importBuffer(Buffer.from('text'), 'text/plain')
    ).rejects.toThrow('Unsupported image type')
  })

  it('moves only unreferenced images to asset trash', async () => {
    const shared = await service.importBuffer(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'image/png'
    )
    const unused = await service.importBuffer(
      Buffer.from([0x89, 0x50, 0x4e, 0x48]),
      'image/png'
    )

    expect(await service.cleanUnused([`![shared](${shared.url})`], 1000)).toBe(1)
    expect(await readdir(join(directory, 'assets'))).toEqual([shared.fileName])
    expect(await readdir(join(directory, 'assets-trash'))).toEqual([
      `1000--${unused.fileName}`
    ])
  })

  it('restores a trashed image when its markdown is restored', async () => {
    const asset = await service.importBuffer(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'image/png'
    )
    await service.cleanUnused([], 1000)

    expect(await service.restoreReferenced([`![image](${asset.url})`])).toBe(1)
    await expect(access(join(directory, 'assets', asset.fileName))).resolves.toBeUndefined()
  })

  it('does not overwrite a live image with an older trashed copy', async () => {
    const liveBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const asset = await service.importBuffer(liveBytes, 'image/png')
    await mkdir(join(directory, 'assets-trash'), { recursive: true })
    await writeFile(
      join(directory, 'assets-trash', `1000--${asset.fileName}`),
      Buffer.from('older')
    )

    expect(await service.restoreReferenced([asset.url])).toBe(0)
    expect(await readFile(join(directory, 'assets', asset.fileName))).toEqual(liveBytes)
  })

  it('returns null instead of throwing for malformed percent encoding', () => {
    expect(service.resolveUrl('asset://local/%E0%A4%A')).toBeNull()
  })

  it('collects canonical references from notes, tasks, and subtasks', () => {
    const first = '01234567-89ab-4cde-8fab-0123456789ab.png'
    const second = '11234567-89ab-4cde-8fab-0123456789ab.jpg'
    const third = '21234567-89ab-4cde-8fab-0123456789ab.webp'
    const notes = {
      version: 5,
      folders: [],
      items: [
        {
          ...baseItem('note-1'),
          type: 'note',
          contentMarkdown: `![one](asset://local/${first}) bad asset://local/%E0%A4%A`,
          syncedToSiyuan: false
        },
        {
          ...baseItem('todo-1'),
          type: 'todo',
          panelExpanded: false,
          tasks: [{
            id: 'task-1',
            contentMarkdown: `![two](asset://local/${second})`,
            completed: false,
            tags: [],
            importance: 'normal',
            urgency: 'normal',
            schedule: null,
            children: [{
              id: 'subtask-1',
              contentMarkdown: `![three](asset://local/${third})`,
              completed: false,
              importance: 'normal',
              urgency: 'normal',
              tags: [],
              schedule: null
            }]
          }]
        }
      ]
    } satisfies NotesFile

    expect(service.collectReferencedFileNames(notes)).toEqual(
      new Set([first, second, third])
    )
  })

  it('recognizes only canonical UUID image filenames', () => {
    expect(service.isCanonicalFileName('01234567-89ab-4cde-8fab-0123456789ab.jpeg')).toBe(true)
    expect(service.isCanonicalFileName('01234567-89ab-4cde-8fab-0123456789AB.PNG')).toBe(false)
    expect(service.isCanonicalFileName('../01234567-89ab-4cde-8fab-0123456789ab.png')).toBe(false)
  })
})

function baseItem(id: string) {
  const now = '2026-07-14T00:00:00.000Z'
  return {
    id,
    revision: 1,
    title: id,
    headerColor: '#f2c94c' as const,
    bodyTheme: 'light' as const,
    pinned: false,
    detached: false,
    windowBounds: null,
    parentFolderId: null,
    tags: [],
    order: 0,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  }
}
