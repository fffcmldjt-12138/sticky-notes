import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { AssetService } from '../src/main/services/AssetService'

describe('AssetService', () => {
  let directory: string
  let service: AssetService

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-assets-'))
    service = new AssetService(directory)
  })

  it('stores supported image bytes under a generated stable asset URL', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])
    const asset = await service.importBuffer(bytes, 'image/png')

    expect(asset.url).toMatch(/^asset:\/\/local\/[a-z0-9-]+\.png$/)
    const files = await readdir(join(directory, 'assets'))
    expect(files).toEqual([asset.fileName])
    expect(await readFile(join(directory, 'assets', asset.fileName))).toEqual(bytes)
  })

  it('rejects unsupported clipboard data', async () => {
    await expect(
      service.importBuffer(Buffer.from('text'), 'text/plain')
    ).rejects.toThrow('Unsupported image type')
  })
})
