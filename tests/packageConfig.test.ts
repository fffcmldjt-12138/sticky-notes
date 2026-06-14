import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Windows installer configuration', () => {
  it('keeps Electron on the default local application drive', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'))

    expect(packageJson.build.nsis.allowToChangeInstallationDirectory).toBe(false)
  })
})
