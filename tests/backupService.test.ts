import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BackupService } from '../src/main/services/BackupService'

interface NotesValue {
  kind: 'notes'
  value: number
}

interface ConfigValue {
  kind: 'config'
  theme: string
}

function validateNotes(value: unknown): NotesValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    value.kind !== 'notes' ||
    !('value' in value) ||
    typeof value.value !== 'number'
  ) {
    throw new Error('invalid notes')
  }
  return value as NotesValue
}

function validateConfig(value: unknown): ConfigValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    value.kind !== 'config' ||
    !('theme' in value) ||
    typeof value.theme !== 'string'
  ) {
    throw new Error('invalid config')
  }
  return value as ConfigValue
}

describe('BackupService', () => {
  let directory: string
  let now: Date
  let backups: BackupService

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-backups-'))
    now = new Date(2026, 6, 14, 10, 0, 0, 0)
    backups = new BackupService(
      directory,
      { notes: validateNotes, config: validateConfig },
      () => new Date(now)
    )
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('retains the newest 20 notes change snapshots', async () => {
    for (let value = 0; value < 21; value += 1) {
      await backups.recordChange('notes', { kind: 'notes', value })
    }

    const files = await readdir(join(directory, 'notes', 'change'))
    expect(files).toHaveLength(20)
    const values = await Promise.all(
      files.map(async (file) =>
        JSON.parse(
          await readFile(join(directory, 'notes', 'change', file), 'utf8')
        )
      )
    )
    expect(values.map((value) => value.value).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1)
    )
  })

  it('retains the newest five config change snapshots', async () => {
    for (let value = 0; value < 6; value += 1) {
      await backups.recordChange('config', {
        kind: 'config',
        theme: String(value)
      })
    }

    expect(await readdir(join(directory, 'config', 'change'))).toHaveLength(5)
    await expect(
      readdir(join(directory, 'config', 'daily'))
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('creates one notes daily per local day and retains a 30-day window', async () => {
    const firstDay = new Date(2026, 5, 1, 23, 59, 0, 0)
    for (let day = 0; day < 31; day += 1) {
      now = new Date(
        firstDay.getFullYear(),
        firstDay.getMonth(),
        firstDay.getDate() + day,
        23,
        59
      )
      await Promise.all([
        backups.recordDaily('notes', { kind: 'notes', value: day }),
        backups.recordDaily('notes', { kind: 'notes', value: day + 100 })
      ])
    }

    const files = await readdir(join(directory, 'notes', 'daily'))
    expect(files).toHaveLength(30)
    expect(files.some((file) => file.startsWith('2026-06-01T'))).toBe(false)
    expect(files.filter((file) => file.startsWith('2026-07-01T'))).toHaveLength(1)
  })

  it('uses the current local day after the system clock moves backward', async () => {
    now = new Date(2026, 6, 20, 18, 0, 0, 0)
    await backups.recordChange('notes', { kind: 'notes', value: 1 })

    now = new Date(2026, 6, 14, 8, 30, 0, 0)
    const entry = await backups.recordDaily('notes', {
      kind: 'notes',
      value: 2
    })

    expect(basename(entry?.path ?? '')).toBe(
      '2026-07-14T08-30-00-000.json'
    )
    expect(JSON.parse(await readFile(entry?.path ?? '', 'utf8'))).toEqual({
      kind: 'notes',
      value: 2
    })
    await expect(
      backups.recordDaily('notes', { kind: 'notes', value: 3 })
    ).resolves.toBeNull()
  })

  it('creates a daily when same-day files are corrupt or domain-invalid', async () => {
    const dailyDirectory = join(directory, 'notes', 'daily')
    await mkdir(dailyDirectory, { recursive: true })
    await writeFile(
      join(dailyDirectory, '2026-07-14T10-00-00-000.json'),
      '{broken'
    )
    await writeFile(
      join(dailyDirectory, '2026-07-14T10-00-00-001.json'),
      JSON.stringify({ kind: 'config', theme: 'dark' })
    )

    const entry = await backups.recordDaily('notes', {
      kind: 'notes',
      value: 8
    })

    expect(entry).not.toBeNull()
    expect(await readdir(dailyDirectory)).toHaveLength(3)
    expect(JSON.parse(await readFile(entry?.path ?? '', 'utf8'))).toEqual({
      kind: 'notes',
      value: 8
    })
  })

  it('keeps protected snapshots at exactly 168 hours and removes them after', async () => {
    const first = new Date(now)
    await backups.recordProtected('notes', { kind: 'notes', value: 1 })

    now = new Date(first.getTime() + 168 * 60 * 60 * 1000)
    await backups.recordProtected('notes', { kind: 'notes', value: 2 })
    expect(await readdir(join(directory, 'notes', 'protected'))).toHaveLength(2)

    now = new Date(first.getTime() + 168 * 60 * 60 * 1000 + 1)
    await backups.recordProtected('notes', { kind: 'notes', value: 3 })
    expect(await readdir(join(directory, 'notes', 'protected'))).toHaveLength(2)
  })

  it('skips a newer corrupt or domain-invalid backup for an older valid one', async () => {
    const changeDirectory = join(directory, 'notes', 'change')
    const dailyDirectory = join(directory, 'notes', 'daily')
    await mkdir(changeDirectory, { recursive: true })
    await mkdir(dailyDirectory, { recursive: true })
    await writeFile(
      join(dailyDirectory, '2026-07-14T09-00-00-000.json'),
      JSON.stringify({ kind: 'notes', value: 7 })
    )
    await writeFile(
      join(changeDirectory, '2026-07-14T10-00-00-000.json'),
      JSON.stringify({ kind: 'config', theme: 'dark' })
    )
    await writeFile(
      join(changeDirectory, '2026-07-14T11-00-00-000.json'),
      '{broken'
    )

    const recovered = await backups.findNewestValid('notes')

    expect(recovered?.value).toEqual({ kind: 'notes', value: 7 })
    expect(recovered?.entry.kind).toBe('daily')
  })

  it('uses an explicit recovery validator without weakening the strict default', async () => {
    const changeDirectory = join(directory, 'notes', 'change')
    const dailyDirectory = join(directory, 'notes', 'daily')
    await mkdir(changeDirectory, { recursive: true })
    await mkdir(dailyDirectory, { recursive: true })
    await writeFile(
      join(dailyDirectory, '2026-07-14T09-00-00-000.json'),
      JSON.stringify({ kind: 'notes', value: 7 })
    )
    await writeFile(
      join(changeDirectory, '2026-07-14T10-00-00-000.json'),
      JSON.stringify({ kind: 'legacy-notes', value: 9 })
    )

    const strict = await backups.findNewestValid('notes')
    const recoverable = await backups.findNewestValid('notes', (value) => {
      if (
        value &&
        typeof value === 'object' &&
        'kind' in value &&
        value.kind === 'legacy-notes' &&
        'value' in value &&
        typeof value.value === 'number'
      ) {
        return { kind: 'notes' as const, value: value.value }
      }
      return validateNotes(value)
    })

    expect(strict?.value).toEqual({ kind: 'notes', value: 7 })
    expect(recoverable?.value).toEqual({ kind: 'notes', value: 9 })
  })

  it('counts only domain-valid change snapshots toward source retention', async () => {
    const fixtures = [
      {
        source: 'notes' as const,
        limit: 20,
        valid: (value: number) => ({ kind: 'notes' as const, value }),
        invalid: { kind: 'config', theme: 'dark' }
      },
      {
        source: 'config' as const,
        limit: 5,
        valid: (value: number) => ({
          kind: 'config' as const,
          theme: String(value)
        }),
        invalid: { kind: 'notes', value: 99 }
      }
    ]

    for (const fixture of fixtures) {
      const changeDirectory = join(directory, fixture.source, 'change')
      await mkdir(changeDirectory, { recursive: true })
      for (let value = 0; value < fixture.limit; value += 1) {
        await writeFile(
          join(
            changeDirectory,
            `2026-07-13T10-00-00-${String(value).padStart(3, '0')}.json`
          ),
          JSON.stringify(fixture.valid(value))
        )
      }
      const corruptName = '2026-07-13T11-00-00-000.json'
      const invalidName = '2026-07-13T11-00-00-001.json'
      await writeFile(join(changeDirectory, corruptName), '{broken')
      await writeFile(
        join(changeDirectory, invalidName),
        JSON.stringify(fixture.invalid)
      )

      await backups.recordChange(
        fixture.source,
        fixture.valid(fixture.limit)
      )

      const files = await readdir(changeDirectory)
      const validValues = await Promise.all(
        files.map(async (file) => {
          try {
            const parsed = JSON.parse(
              await readFile(join(changeDirectory, file), 'utf8')
            )
            return fixture.source === 'notes'
              ? validateNotes(parsed)
              : validateConfig(parsed)
          } catch {
            return null
          }
        })
      )
      expect(validValues.filter(Boolean)).toHaveLength(fixture.limit)
      expect(files).toContain(corruptName)
      expect(files).toContain(invalidName)
    }
  })

  it('handles many invalid change snapshots without deleting them', async () => {
    const changeDirectory = join(directory, 'notes', 'change')
    await mkdir(changeDirectory, { recursive: true })
    const invalidNames: string[] = []
    for (let index = 0; index < 500; index += 1) {
      const second = Math.floor(index / 1000)
      const millisecond = index % 1000
      const name = `2026-07-13T10-00-${String(second).padStart(
        2,
        '0'
      )}-${String(millisecond).padStart(3, '0')}.json`
      invalidNames.push(name)
      await writeFile(join(changeDirectory, name), '{broken')
    }

    const entry = await backups.recordChange('notes', {
      kind: 'notes',
      value: 42
    })

    expect(JSON.parse(await readFile(entry.path, 'utf8'))).toEqual({
      kind: 'notes',
      value: 42
    })
    const files = await readdir(changeDirectory)
    expect(files).toHaveLength(501)
    expect(invalidNames.every((name) => files.includes(name))).toBe(true)
  })

  it('does not recover config from a config daily directory', async () => {
    const changeDirectory = join(directory, 'config', 'change')
    const dailyDirectory = join(directory, 'config', 'daily')
    await mkdir(changeDirectory, { recursive: true })
    await mkdir(dailyDirectory, { recursive: true })
    await writeFile(
      join(changeDirectory, '2026-07-14T09-00-00-000.json'),
      JSON.stringify({ kind: 'config', theme: 'light' })
    )
    await writeFile(
      join(dailyDirectory, '2026-07-14T10-00-00-000.json'),
      JSON.stringify({ kind: 'config', theme: 'dark' })
    )

    const recovered = await backups.findNewestValid('config')

    expect(recovered?.value).toEqual({ kind: 'config', theme: 'light' })
    expect(recovered?.entry.kind).toBe('change')
  })

  it('ignores protected, temp, corrupt suffixes, illegal dates, and directories', async () => {
    const changeDirectory = join(directory, 'notes', 'change')
    const dailyDirectory = join(directory, 'notes', 'daily')
    const protectedDirectory = join(directory, 'notes', 'protected')
    await Promise.all([
      mkdir(changeDirectory, { recursive: true }),
      mkdir(dailyDirectory, { recursive: true }),
      mkdir(protectedDirectory, { recursive: true })
    ])
    await writeFile(
      join(changeDirectory, '2026-07-13T10-00-00-000.json'),
      JSON.stringify({ kind: 'notes', value: 4 })
    )
    await writeFile(
      join(dailyDirectory, '2026-07-14T11-00-00-000.json.tmp'),
      JSON.stringify({ kind: 'notes', value: 9 })
    )
    await writeFile(
      join(dailyDirectory, '2026-07-14T12-00-00-000.json.corrupt'),
      JSON.stringify({ kind: 'notes', value: 10 })
    )
    await writeFile(
      join(dailyDirectory, '2026-02-30T12-00-00-000.json'),
      JSON.stringify({ kind: 'notes', value: 11 })
    )
    await mkdir(join(dailyDirectory, '2026-07-14T13-00-00-000.json'))
    await writeFile(
      join(protectedDirectory, '2026-07-14T14-00-00-000.json'),
      JSON.stringify({ kind: 'notes', value: 12 })
    )

    const recovered = await backups.findNewestValid('notes')

    expect(recovered?.value).toEqual({ kind: 'notes', value: 4 })
    expect(basename(recovered?.entry.path ?? '')).toBe(
      '2026-07-13T10-00-00-000.json'
    )
  })

  it('serializes concurrent naming so every change filename is unique', async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, value) =>
        backups.recordChange('notes', { kind: 'notes', value })
      )
    )

    const files = await readdir(join(directory, 'notes', 'change'))
    expect(new Set(files).size).toBe(20)
  })

  it('advances one logical millisecond when a filename already exists', async () => {
    const changeDirectory = join(directory, 'notes', 'change')
    await mkdir(changeDirectory, { recursive: true })
    await writeFile(
      join(changeDirectory, '2026-07-14T10-00-00-000.json'),
      JSON.stringify({ kind: 'notes', value: 1 })
    )

    const entry = await backups.recordChange('notes', {
      kind: 'notes',
      value: 2
    })

    expect(basename(entry.path)).toBe('2026-07-14T10-00-00-001.json')
  })

  it('rejects a snapshot that fails the source validator', async () => {
    await expect(
      backups.recordProtected('notes', { kind: 'config', theme: 'dark' })
    ).rejects.toThrow('invalid notes')
  })

  it('lists valid notes backups with opaque ids and resolves them by re-enumeration', async () => {
    await backups.recordChange('notes', { kind: 'notes', value: 1 })
    await backups.recordProtected('notes', { kind: 'notes', value: 2 })

    const summaries = await backups.listNotesBackups()

    expect(summaries).toHaveLength(2)
    expect(summaries[0]).toEqual({
      id: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
      kind: expect.any(String),
      createdAt: expect.any(String),
      size: expect.any(Number)
    })
    expect(summaries[0]).not.toHaveProperty('path')

    const resolved = await backups.resolveValidNotesBackup(summaries[0].id)
    expect(resolved.summary).toEqual(summaries[0])
    expect(resolved.value).toMatchObject({ kind: 'notes' })
  })

  it('rejects forged and invalid backup ids', async () => {
    await backups.recordChange('notes', { kind: 'notes', value: 1 })

    await expect(backups.resolveValidNotesBackup('forged-id'))
      .rejects.toThrow(/backup|备份/i)
  })
})
