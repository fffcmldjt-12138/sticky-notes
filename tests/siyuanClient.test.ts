import { describe, expect, it, vi } from 'vitest'
import { SiyuanClient } from '../src/main/services/SiyuanClient'

describe('SiyuanClient', () => {
  it('rejects cleartext HTTP endpoints outside the local machine', () => {
    expect(() => new SiyuanClient({
      endpoint: 'http://example.com:6806',
      token: 'secret'
    })).toThrow(/HTTPS|本机/)
  })

  it('sends the API token and reads version and notebooks', async () => {
    const fetchImpl = vi.fn(async (
      input: string | URL | Request,
      _init?: RequestInit
    ) => {
      const url = String(input)
      const data = url.endsWith('/api/system/version')
        ? '3.7.1'
        : { notebooks: [{ id: 'inbox', name: '00 收件箱', closed: false }] }
      return Response.json({ code: 0, msg: '', data })
    })
    const client = new SiyuanClient({
      endpoint: 'http://127.0.0.1:6806/',
      token: 'secret',
      fetchImpl
    })

    await expect(client.getVersion()).resolves.toBe('3.7.1')
    await expect(client.listNotebooks()).resolves.toEqual([
      { id: 'inbox', name: '00 收件箱', closed: false }
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    for (const [, init] of fetchImpl.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe('Token secret')
    }
  })

  it('uploads an image and returns the rewritten SiYuan asset path', async () => {
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(init?.body).toBeInstanceOf(FormData)
      const form = init?.body as FormData
      expect(form.get('assetsDirPath')).toBe('/assets/')
      const file = form.getAll('file[]')[0] as File
      expect(file.name).toBe('image.png')
      return Response.json({
        code: 0,
        msg: '',
        data: { errFiles: [], succMap: { 'image.png': 'assets/image-id.png' } }
      })
    })
    const client = new SiyuanClient({
      endpoint: 'http://127.0.0.1:6806',
      token: '',
      fetchImpl
    })

    await expect(
      client.uploadAsset('image.png', 'image/png', new Uint8Array([1, 2, 3]))
    ).resolves.toBe('assets/image-id.png')
  })
})
