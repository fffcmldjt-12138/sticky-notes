import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Electron window security', () => {
  it('sandboxes the panel and detached renderer windows', async () => {
    const sources = await Promise.all([
      readFile('src/main/services/WindowService.ts', 'utf8'),
      readFile('src/main/main.ts', 'utf8')
    ])

    expect(sources.join('\n')).not.toContain('sandbox: false')
    expect(sources.join('\n').match(/sandbox: true/g)).toHaveLength(3)
  })
})
