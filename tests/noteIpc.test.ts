import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle } }))

import { registerNoteIpc } from '../src/main/ipc/noteIpc'
import { ipcChannels } from '../src/shared/ipcChannels'

describe('note IPC revisions', () => {
  beforeEach(() => handle.mockReset())

  it('forwards expectedRevision and broadcasts only successful updates', async () => {
    const current = { id: 'note_1', revision: 4, title: 'current' }
    const store = {
      list: vi.fn(), create: vi.fn(), update: vi.fn()
        .mockResolvedValueOnce({ status: 'ok', value: current })
        .mockResolvedValueOnce({ status: 'conflict', current }),
      delete: vi.fn(), addTodoTask: vi.fn(), updateTodoTask: vi.fn(),
      deleteTodoTask: vi.fn(), reorderTodoTasks: vi.fn(),
      addTodoSubtask: vi.fn(), updateTodoSubtask: vi.fn(),
      deleteTodoSubtask: vi.fn()
    }
    const changed = vi.fn()
    registerNoteIpc(store as never, { changed, deleted: vi.fn() })
    const update = handle.mock.calls.find(
      ([channel]) => channel === ipcChannels.notesUpdate
    )?.[1]

    await expect(update({}, 'note_1', 3, { title: 'new' })).resolves.toEqual({
      status: 'ok', value: current
    })
    expect(store.update).toHaveBeenCalledWith('note_1', 3, { title: 'new' })
    expect(changed).toHaveBeenCalledTimes(1)

    await expect(update({}, 'note_1', 2, { title: 'stale' })).resolves.toEqual({
      status: 'conflict', current
    })
    expect(changed).toHaveBeenCalledTimes(1)
  })
})
