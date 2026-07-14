import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))

import { registerSiyuanIpc } from '../src/main/ipc/siyuanIpc'
import { ipcChannels } from '../src/shared/ipcChannels'

describe('SiYuan IPC', () => {
  beforeEach(() => handle.mockReset())

  it('exposes settings, connection testing, and note delivery', async () => {
    const item = { id: 'note-1' }
    const service = {
      getSettings: vi.fn(async () => ({ endpoint: 'http://127.0.0.1:6806' })),
      updateSettings: vi.fn(async () => ({ endpoint: 'http://localhost:6806' })),
      testConnection: vi.fn(async () => ({ version: '3.7.1', notebookId: 'inbox' })),
      sendNote: vi.fn(async () => ({ status: 'sent', documentId: 'doc-1', item }))
    }
    const changed = vi.fn()
    registerSiyuanIpc(service as never, { changed })

    const invoke = (channel: string) => handle.mock.calls.find(([name]) => name === channel)?.[1]
    await expect(invoke(ipcChannels.siyuanSettingsGet)({})).resolves.toMatchObject({
      endpoint: 'http://127.0.0.1:6806'
    })
    await invoke(ipcChannels.siyuanSettingsUpdate)({}, { endpoint: 'http://localhost:6806' })
    await invoke(ipcChannels.siyuanTestConnection)({})
    await invoke(ipcChannels.siyuanSendNote)({}, 'note-1')

    expect(service.sendNote).toHaveBeenCalledWith('note-1')
    expect(changed).toHaveBeenCalledWith(item)
  })
})
