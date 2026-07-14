import { describe, expect, it, vi } from 'vitest'
import { SiyuanService } from '../src/main/services/SiyuanService'

describe('SiyuanService', () => {
  it('detects and persists the open 00 inbox notebook', async () => {
    const config = {
      get: vi.fn(async () => ({
        version: 1, autoLaunch: false, panelPosition: 'right', alwaysOnTop: true,
        siyuan: { endpoint: 'http://127.0.0.1:6806', inboxNotebookId: null }
      })),
      update: vi.fn(async (patch) => ({
        version: 1, autoLaunch: false, panelPosition: 'right', alwaysOnTop: true,
        ...patch
      }))
    }
    const client = {
      getVersion: vi.fn(async () => '3.7.1'),
      listNotebooks: vi.fn(async () => [
        { id: 'inbox', name: '00 收件箱', closed: false }
      ]),
      getIdsByHPath: vi.fn(), uploadAsset: vi.fn(), createDocument: vi.fn()
    }
    const service = new SiyuanService({
      config: config as never,
      credentials: {
        getToken: vi.fn(async () => ''),
        setToken: vi.fn(),
        hasToken: vi.fn(async () => false)
      },
      notes: {} as never,
      assets: {} as never,
      clientFactory: vi.fn(() => client as never)
    })

    await expect(service.testConnection()).resolves.toEqual({
      version: '3.7.1',
      notebookId: 'inbox',
      notebookName: '00 收件箱'
    })
    expect(config.update).toHaveBeenCalledWith({
      siyuan: {
        endpoint: 'http://127.0.0.1:6806',
        inboxNotebookId: 'inbox'
      }
    })
  })

  it('revalidates a cached inbox before every delivery', async () => {
    let storedConfig = {
      version: 1 as const,
      autoLaunch: false,
      panelPosition: 'right' as const,
      alwaysOnTop: true,
      siyuan: {
        endpoint: 'http://127.0.0.1:6806',
        inboxNotebookId: 'renamed-inbox' as string | null
      }
    }
    const config = {
      get: vi.fn(async () => structuredClone(storedConfig)),
      update: vi.fn(async (patch) => {
        storedConfig = { ...storedConfig, ...patch }
        return structuredClone(storedConfig)
      })
    }
    const note = {
      id: 'note-1', revision: 1, type: 'note' as const, title: 'Video',
      contentMarkdown: 'Body', siyuanDelivery: null, headerColor: '#f2c94c' as const,
      bodyTheme: 'light' as const, pinned: false, detached: false,
      windowBounds: null, parentFolderId: null, tags: [], order: 0,
      deletedAt: null, createdAt: '2026-07-14T09:00:00.000Z',
      updatedAt: '2026-07-14T09:00:00.000Z'
    }
    const client = {
      getVersion: vi.fn(async () => '3.7.1'),
      listNotebooks: vi.fn(async () => [
        { id: 'renamed-inbox', name: '旧名称', closed: false },
        { id: 'actual-inbox', name: '00 收件箱', closed: false }
      ]),
      getIdsByHPath: vi.fn(async () => []),
      uploadAsset: vi.fn(),
      createDocument: vi.fn(async () => 'doc-1')
    }
    const notes = {
      getSnapshot: vi.fn(async () => ({ version: 6 as const, items: [note], folders: [] })),
      recordSiyuanDelivery: vi.fn(async (_id, delivery) => ({
        status: 'ok' as const,
        value: { ...note, siyuanDelivery: delivery }
      }))
    }
    const service = new SiyuanService({
      config: config as never,
      credentials: {
        getToken: vi.fn(async () => ''),
        setToken: vi.fn(),
        hasToken: vi.fn(async () => false)
      },
      notes: notes as never,
      assets: {} as never,
      clientFactory: vi.fn(() => client as never)
    })

    await service.sendNote(note.id)

    expect(client.listNotebooks).toHaveBeenCalled()
    expect(client.createDocument).toHaveBeenCalledWith(
      'actual-inbox',
      expect.any(String),
      expect.any(String)
    )
    expect(storedConfig.siyuan.inboxNotebookId).toBe('actual-inbox')
  })

  it('serializes different notes so equal titles cannot claim the same path', async () => {
    const config = {
      get: vi.fn(async () => ({
        version: 1, autoLaunch: false, panelPosition: 'right', alwaysOnTop: true,
        siyuan: { endpoint: 'http://127.0.0.1:6806', inboxNotebookId: 'inbox' }
      })),
      update: vi.fn()
    }
    const notesById = new Map([
      ['note-1', makeNote('note-1')],
      ['note-2', makeNote('note-2')]
    ])
    const createdPaths = new Set<string>()
    const requestedPaths: string[] = []
    const client = {
      getVersion: vi.fn(async () => '3.7.1'),
      listNotebooks: vi.fn(async () => [
        { id: 'inbox', name: '00 收件箱', closed: false }
      ]),
      getIdsByHPath: vi.fn(async (_notebook, path: string) =>
        createdPaths.has(path) ? ['existing'] : []
      ),
      uploadAsset: vi.fn(),
      createDocument: vi.fn(async (_notebook, path: string) => {
        requestedPaths.push(path)
        createdPaths.add(path)
        return `doc-${requestedPaths.length}`
      })
    }
    const notes = {
      getSnapshot: vi.fn(async () => ({
        version: 6 as const,
        items: [...notesById.values()],
        folders: []
      })),
      recordSiyuanDelivery: vi.fn(async (id: string, delivery) => ({
        status: 'ok' as const,
        value: { ...notesById.get(id)!, siyuanDelivery: delivery }
      }))
    }
    const service = new SiyuanService({
      config: config as never,
      credentials: {
        getToken: vi.fn(async () => ''), setToken: vi.fn(),
        hasToken: vi.fn(async () => false)
      },
      notes: notes as never,
      assets: {} as never,
      clientFactory: vi.fn(() => client as never),
      now: () => new Date('2026-07-14T12:00:00.000Z')
    })

    await Promise.all([service.sendNote('note-1'), service.sendNote('note-2')])

    expect(new Set(requestedPaths).size).toBe(2)
  })
})

function makeNote(id: string) {
  return {
    id, revision: 1, type: 'note' as const, title: 'Same title',
    contentMarkdown: id, siyuanDelivery: null, headerColor: '#f2c94c' as const,
    bodyTheme: 'light' as const, pinned: false, detached: false,
    windowBounds: null, parentFolderId: null, tags: [], order: 0,
    deletedAt: null, createdAt: '2026-07-14T09:00:00.000Z',
    updatedAt: '2026-07-14T09:00:00.000Z'
  }
}
