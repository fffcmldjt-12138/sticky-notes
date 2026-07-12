import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Electron preload compatibility', () => {
  it('keeps ESM preload windows unsandboxed so Electron can execute index.mjs', async () => {
    const sources = await Promise.all([
      readFile('src/main/services/WindowService.ts', 'utf8'),
      readFile('src/main/main.ts', 'utf8')
    ])

    expect(sources.join('\n')).not.toContain('sandbox: true')
    expect(sources.join('\n').match(/sandbox: false/g)).toHaveLength(3)
  })
})
