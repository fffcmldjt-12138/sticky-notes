import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SiyuanCredentialStore } from '../src/main/services/SiyuanCredentialStore'

describe('SiyuanCredentialStore', () => {
  it('persists only encrypted token bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-siyuan-secret-'))
    const store = new SiyuanCredentialStore(directory, {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${value}`),
      decryptString: (value) => value.toString().replace('encrypted:', '')
    })

    await store.setToken('plain-secret')

    await expect(store.getToken()).resolves.toBe('plain-secret')
    const persisted = await readFile(join(directory, 'siyuan-credentials.json'), 'utf8')
    expect(persisted).not.toContain('plain-secret')
    expect(await store.hasToken()).toBe(true)
  })
})
