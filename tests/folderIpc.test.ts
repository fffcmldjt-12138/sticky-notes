import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))

import { ipcChannels } from '../src/shared/ipcChannels'
import { registerFolderIpc } from '../src/main/ipc/folderIpc'

describe('folder IPC events', () => {
  beforeEach(() => handle.mockReset())

  it('publishes folders changed from any renderer window', async () => {
    const folder = { id: 'folder_1', title: 'Updated' }
    const store = {
      listFolders: vi.fn(),
      createFolder: vi.fn().mockResolvedValue(folder),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn(),
      moveItem: vi.fn(),
      reorderChildren: vi.fn()
    }
    const changed = vi.fn()
    registerFolderIpc(store as never, {
      beforeDelete: vi.fn(),
      changed,
      deleted: vi.fn()
    })
    const create = handle.mock.calls.find(
      ([channel]) => channel === ipcChannels.foldersCreate
    )?.[1]

    expect(await create({}, 'Updated', null)).toBe(folder)
    expect(changed).toHaveBeenCalledWith(folder)
  })

  it('publishes folder deletion after the store succeeds', async () => {
    const store = {
      listFolders: vi.fn(),
      createFolder: vi.fn(),
      updateFolder: vi.fn(),
      deleteFolder: vi.fn().mockResolvedValue(true),
      moveItem: vi.fn(),
      reorderChildren: vi.fn()
    }
    const deleted = vi.fn()
    registerFolderIpc(store as never, {
      beforeDelete: vi.fn(),
      changed: vi.fn(),
      deleted
    })
    const remove = handle.mock.calls.find(
      ([channel]) => channel === ipcChannels.foldersDelete
    )?.[1]

    expect(await remove({}, 'folder_1')).toBe(true)
    expect(deleted).toHaveBeenCalledWith('folder_1')
  })
})
