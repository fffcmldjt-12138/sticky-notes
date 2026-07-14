import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: electron.exposeInMainWorld },
  ipcRenderer: {
    invoke: electron.invoke,
    send: vi.fn(),
    on: electron.on,
    removeListener: electron.removeListener
  }
}))

describe('preload data API', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    await import('../src/preload/index')
  })

  it('exposes explicit data methods without accepting filesystem paths', async () => {
    const api = electron.exposeInMainWorld.mock.calls[0][1]
    await api.data.restoreBackup('opaque-id')
    await api.data.cancelImport('inspection-id')

    expect(electron.invoke).toHaveBeenCalledWith('data:restore-backup', 'opaque-id')
    expect(electron.invoke).toHaveBeenCalledWith('data:cancel-import', 'inspection-id')
  })

  it('exposes typed SiYuan settings and send calls', async () => {
    const api = electron.exposeInMainWorld.mock.calls[0][1]
    await api.siyuan.updateSettings({ endpoint: 'http://localhost:6806' })
    await api.siyuan.testConnection()
    await api.siyuan.sendNote('note-1')

    expect(electron.invoke).toHaveBeenCalledWith(
      'siyuan:settings-update',
      { endpoint: 'http://localhost:6806' }
    )
    expect(electron.invoke).toHaveBeenCalledWith('siyuan:test-connection')
    expect(electron.invoke).toHaveBeenCalledWith('siyuan:send-note', 'note-1')
  })

  it('removes exactly the data reload listener on unsubscribe', () => {
    const api = electron.exposeInMainWorld.mock.calls[0][1]
    const callback = vi.fn()
    const unsubscribe = api.onDataReloaded(callback)
    const listenerCall = electron.on.mock.calls.find(
      ([channel]) => channel === 'data:reloaded'
    )
    expect(listenerCall).toBeDefined()
    const listener = listenerCall![1]

    listener({}, 'restore')
    unsubscribe()

    expect(callback).toHaveBeenCalledWith('restore')
    expect(electron.removeListener).toHaveBeenCalledWith('data:reloaded', listener)
  })
})
