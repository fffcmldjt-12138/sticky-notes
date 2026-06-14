import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigStore } from '../src/main/services/ConfigStore'

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
})
