import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Windows installer configuration', () => {
  it('keeps Electron on the default local application drive', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8'))

    expect(packageJson.build.nsis.allowToChangeInstallationDirectory).toBe(false)
  })

  it('builds release artifacts without electron-builder publishing them', async () => {
    const workflow = await readFile('.github/workflows/release.yml', 'utf8')

    expect(workflow).toContain('npm run dist -- --publish never')
  })
})
