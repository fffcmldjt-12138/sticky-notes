import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('Electron preload compatibility', () => {
  it('keeps ESM preload windows unsandboxed so Electron can execute index.mjs', async () => {
    const sources = await Promise.all([
      readFile('src/main/services/WindowService.ts', 'utf8'),
      readFile('src/main/main.ts', 'utf8')
    ])

    const source = sources.join('\n')
    const esmPreloads = source.match(/preload: join\(__dirname, '\.\.\/preload\/index\.mjs'\)/g) ?? []
    const unsandboxedWindows = source.match(/sandbox: false/g) ?? []

    expect(source).not.toContain('sandbox: true')
    expect(esmPreloads.length).toBeGreaterThan(0)
    expect(unsandboxedWindows).toHaveLength(esmPreloads.length)
  })

  it('terminates the process when the top-level startup chain rejects', async () => {
    const source = await readFile('src/main/main.ts', 'utf8')

    expect(source).toMatch(
      /app\.whenReady\(\)[\s\S]*\.catch\(\(error\) => \{[\s\S]*console\.error\([\s\S]*app\.exit\(1\)/
    )
  })
})
