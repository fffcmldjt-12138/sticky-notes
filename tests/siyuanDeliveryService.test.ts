import { describe, expect, it, vi } from 'vitest'
import { SiyuanDeliveryService } from '../src/main/services/SiyuanDeliveryService'
import type { NoteItem, NotesFile, SiyuanDelivery } from '../src/shared/models'

describe('SiyuanDeliveryService', () => {
  it('uploads each local image once, rewrites Markdown, and records delivery', async () => {
    const note = makeNote(
      '![first](asset://local/image.png)\n![again](asset://local/image.png)\n[视频](https://example.com)'
    )
    const recorded: SiyuanDelivery[] = []
    const client = fakeClient()
    client.uploadAsset.mockResolvedValue('assets/image-id.png')
    client.createDocument.mockResolvedValue('doc-1')
    const service = new SiyuanDeliveryService({
      notes: noteRepository(note, recorded),
      assets: {
        readUrl: vi.fn(async () => ({
          fileName: 'image.png',
          mimeType: 'image/png',
          bytes: new Uint8Array([1, 2, 3])
        }))
      },
      client,
      now: () => new Date('2026-07-14T12:00:00.000Z')
    })

    const result = await service.send(note.id, 'inbox')

    expect(result.status).toBe('sent')
    expect(client.uploadAsset).toHaveBeenCalledTimes(1)
    expect(client.createDocument).toHaveBeenCalledWith(
      'inbox',
      '/Video notes',
      expect.stringContaining('![first](assets/image-id.png)')
    )
    expect(client.createDocument.mock.calls[0][2]).toContain('[视频](https://example.com)')
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({ documentId: 'doc-1', notebookId: 'inbox' })
  })

  it('does not send unchanged content twice', async () => {
    const note = makeNote('Body')
    const client = fakeClient()
    const service = new SiyuanDeliveryService({
      notes: noteRepository(note, []),
      assets: { readUrl: vi.fn() },
      client,
      now: () => new Date('2026-07-14T12:00:00.000Z')
    })
    note.siyuanDelivery = {
      notebookId: 'inbox',
      documentId: 'doc-old',
      sentAt: '2026-07-14T11:00:00.000Z',
      contentFingerprint: service.fingerprint(note)
    }

    await expect(service.send(note.id, 'inbox')).resolves.toMatchObject({
      status: 'already-sent',
      documentId: 'doc-old'
    })
    expect(client.createDocument).not.toHaveBeenCalled()
  })

  it('sends unchanged content when the target notebook has changed', async () => {
    const note = makeNote('Body')
    const client = fakeClient()
    const service = new SiyuanDeliveryService({
      notes: noteRepository(note, []),
      assets: { readUrl: vi.fn() },
      client,
      now: () => new Date('2026-07-14T12:00:00.000Z')
    })
    note.siyuanDelivery = {
      notebookId: 'old-inbox',
      documentId: 'doc-old',
      sentAt: '2026-07-14T11:00:00.000Z',
      contentFingerprint: service.fingerprint(note)
    }

    await expect(service.send(note.id, 'new-inbox')).resolves.toMatchObject({
      status: 'sent'
    })
    expect(client.createDocument).toHaveBeenCalledTimes(1)
  })

  it('chooses a new path instead of overwriting an existing SiYuan document', async () => {
    const note = makeNote('Changed body')
    const client = fakeClient()
    client.getIdsByHPath
      .mockResolvedValueOnce(['existing-original'])
      .mockResolvedValueOnce(['existing-resend'])
      .mockResolvedValueOnce([])
    const service = new SiyuanDeliveryService({
      notes: noteRepository(note, []),
      assets: { readUrl: vi.fn() },
      client,
      now: () => new Date('2026-07-14T12:00:00.000Z')
    })

    await service.send(note.id, 'inbox')

    expect(client.createDocument).toHaveBeenCalledWith(
      'inbox',
      '/Video notes（来自便签 2026-07-14 120000）-2',
      expect.any(String)
    )
  })

  it('coalesces concurrent sends of the same note', async () => {
    const note = makeNote('Body')
    let finish!: (value: string) => void
    const client = fakeClient()
    client.createDocument.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const service = new SiyuanDeliveryService({
      notes: noteRepository(note, []),
      assets: { readUrl: vi.fn() },
      client,
      now: () => new Date('2026-07-14T12:00:00.000Z')
    })

    const first = service.send(note.id, 'inbox')
    const second = service.send(note.id, 'inbox')
    finish('doc-1')
    await Promise.all([first, second])

    expect(client.createDocument).toHaveBeenCalledTimes(1)
  })
})

function makeNote(contentMarkdown: string): NoteItem {
  return {
    id: 'note-1', revision: 1, type: 'note', title: 'Video notes',
    contentMarkdown, siyuanDelivery: null, headerColor: '#f2c94c',
    bodyTheme: 'light', pinned: false, detached: false, windowBounds: null,
    parentFolderId: null, tags: [], order: 0, deletedAt: null,
    createdAt: '2026-07-14T09:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z'
  }
}

function noteRepository(note: NoteItem, recorded: SiyuanDelivery[]) {
  return {
    getSnapshot: vi.fn(async (): Promise<NotesFile> => ({
      version: 6,
      items: [note],
      folders: []
    })),
    recordSiyuanDelivery: vi.fn(async (_id: string, delivery: SiyuanDelivery) => {
      recorded.push(delivery)
      note.siyuanDelivery = delivery
      return { status: 'ok' as const, value: note }
    })
  }
}

function fakeClient() {
  return {
    getIdsByHPath: vi.fn(async (_notebook: string, _path: string) => [] as string[]),
    uploadAsset: vi.fn(async (_fileName: string, _mimeType: string, _bytes: Uint8Array) => 'assets/image.png'),
    createDocument: vi.fn(async (_notebook: string, _path: string, _markdown: string) => 'doc-1')
  }
}
