import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { BackupService } from '../src/main/services/BackupService'
import { ConfigStore } from '../src/main/services/ConfigStore'
import { NoteStore } from '../src/main/services/NoteStore'
import { DataUnavailableError } from '../src/main/services/storageErrors'
import {
  validateAppConfig,
  validateNotesFile
} from '../src/main/services/storageValidators'

const emptyNotes = { version: 5 as const, items: [], folders: [] }
const config = {
  version: 1 as const,
  autoLaunch: true,
  panelPosition: 'right' as const,
  alwaysOnTop: false
}

describe('startup recovery', () => {
  let directory: string
  let backups: BackupService

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-recovery-'))
    backups = new BackupService(join(directory, 'backups'), {
      notes: validateNotesFile,
      config: validateAppConfig
    })
  })

  it('restores corrupt notes from the newest valid backup and preserves exact bytes once', async () => {
    await backups.recordChange('notes', emptyNotes)
    const recovered = {
      version: 5 as const,
      items: [],
      folders: [{
        id: 'folder_recovered',
        revision: 1,
        title: 'Recovered',
        parentFolderId: null,
        order: 0,
        collapsed: false,
        detached: false,
        windowBounds: null,
        deletedAt: null,
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z'
      }]
    }
    await backups.recordChange('notes', recovered)
    const corruptBytes = Buffer.from([0x7b, 0x22, 0xff, 0x7d])
    await writeFile(join(directory, 'notes.json'), corruptBytes)

    const store = new NoteStore(directory, backups)
    await expect(store.getSnapshot()).resolves.toEqual(recovered)

    const corruptFiles = (await readdir(directory)).filter((name) =>
      name.startsWith('notes.json.corrupt-')
    )
    expect(corruptFiles).toHaveLength(1)
    expect(await readFile(join(directory, corruptFiles[0]))).toEqual(corruptBytes)
    await expect(new NoteStore(directory, backups).getSnapshot()).resolves.toEqual(
      recovered
    )
    expect(
      (await readdir(directory)).filter((name) =>
        name.startsWith('notes.json.corrupt-')
      )
    ).toHaveLength(1)
  })

  it('throws a typed notes error without overwriting the corrupt formal file', async () => {
    const notesPath = join(directory, 'notes.json')
    const corrupt = '{"version":5,"items":[{}],"folders":[]}'
    await writeFile(notesPath, corrupt, 'utf8')

    const store = new NoteStore(directory, backups)
    await expect(store.getSnapshot()).rejects.toMatchObject({
      code: 'DATA_UNAVAILABLE',
      source: 'notes'
    })
    await expect(store.getSnapshot()).rejects.toBeInstanceOf(DataUnavailableError)
    expect(await readFile(notesPath, 'utf8')).toBe(corrupt)
    const copies = (await readdir(directory)).filter((name) =>
      name.startsWith('notes.json.corrupt-')
    )
    expect(copies).toHaveLength(1)
    expect(await readFile(join(directory, copies[0]), 'utf8')).toBe(corrupt)
  })

  it('recovers corrupt config and preserves it byte-for-byte', async () => {
    await backups.recordChange('config', config)
    const corrupt = Buffer.from('{broken config', 'utf8')
    await writeFile(join(directory, 'config.json'), corrupt)

    await expect(new ConfigStore(directory, backups).get()).resolves.toEqual(config)
    const copy = (await readdir(directory)).find((name) =>
      name.startsWith('config.json.corrupt-')
    )
    expect(copy).toBeDefined()
    expect(await readFile(join(directory, copy!))).toEqual(corrupt)
  })

  it('throws a typed config error and keeps the formal file when no backup is valid', async () => {
    const configPath = join(directory, 'config.json')
    const invalid = '{"version":1,"autoLaunch":"yes"}'
    await writeFile(configPath, invalid, 'utf8')
    const invalidBackupDirectory = join(directory, 'backups', 'config', 'change')
    await mkdir(invalidBackupDirectory, { recursive: true })
    await writeFile(
      join(invalidBackupDirectory, '2026-07-14T10-00-00-000.json'),
      '{}',
      'utf8'
    )

    await expect(new ConfigStore(directory, backups).get()).rejects.toMatchObject({
      code: 'DATA_UNAVAILABLE',
      source: 'config'
    })
    expect(await readFile(configPath, 'utf8')).toBe(invalid)
  })
})
