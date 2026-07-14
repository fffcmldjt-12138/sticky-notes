import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigStore } from '../src/main/services/ConfigStore'
import { UnsupportedDataVersionError } from '../src/main/services/storageErrors'

describe('ConfigStore', () => {
  it('uses the approved defaults and persists updates', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-config-'))
    const store = new ConfigStore(directory)

    expect(await store.get()).toEqual({
      version: 1,
      autoLaunch: false,
      panelPosition: 'right',
      alwaysOnTop: true
    })

    expect(await store.update({ autoLaunch: true })).toMatchObject({
      autoLaunch: true,
      alwaysOnTop: true
    })
  })

  it('serializes concurrent patches without losing fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-config-'))
    const store = new ConfigStore(directory)

    await Promise.all([
      store.update({ autoLaunch: true }),
      store.update({ alwaysOnTop: false })
    ])

    expect(await store.get()).toMatchObject({
      autoLaunch: true,
      alwaysOnTop: false
    })
  })

  it('continues processing after a queued update fails validation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-config-'))
    const store = new ConfigStore(directory)

    const invalid = store.update({ panelPosition: 'left' as 'right' })
    const valid = store.update({ autoLaunch: true })

    await expect(invalid).rejects.toThrow('panelPosition')
    await expect(valid).resolves.toMatchObject({ autoLaunch: true })
  })

  it('does not overwrite a config from a future schema version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-config-'))
    const configPath = join(directory, 'config.json')
    const future = JSON.stringify({
      version: 2,
      autoLaunch: false,
      panelPosition: 'right',
      alwaysOnTop: true
    })
    await writeFile(configPath, future, 'utf8')

    const store = new ConfigStore(directory)
    await expect(store.get()).rejects.toBeInstanceOf(UnsupportedDataVersionError)
    expect(await readFile(configPath, 'utf8')).toBe(future)
  })
})
