import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FolderItem, WindowBounds } from '../src/shared/models'
import {
  FolderWindowService,
  type FolderWindowHandle
} from '../src/main/services/FolderWindowService'

const folder: FolderItem = {
  revision: 1,
  id: 'folder_1',
  title: 'Project',
  parentFolderId: null,
  order: 0,
  collapsed: false,
  detached: false,
  windowBounds: null,
  deletedAt: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

function fakeWindow(): FolderWindowHandle & {
  emit(event: 'close' | 'move' | 'resize'): void
} {
  const listeners = new Map<string, () => void>()
  return {
    focus: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 380, height: 520 }),
    on: vi.fn((event, listener) => listeners.set(event, listener)),
    emit: (event) => listeners.get(event)?.()
  }
}

function createService(window = fakeWindow()) {
  const store = {
    updateFolder: vi.fn().mockImplementation(
      async (_id: string, patch: Partial<FolderItem>) => ({ ...folder, ...patch })
    )
  }
  const factory = { create: vi.fn().mockReturnValue(window) }
  const onChanged = vi.fn()
  const service = new FolderWindowService(
    store,
    factory,
    () => [{ x: 0, y: 0, width: 1920, height: 1040 }],
    onChanged
  )
  return { service, store, factory, window, onChanged }
}

afterEach(() => vi.useRealTimers())

describe('FolderWindowService', () => {
  it('creates one window and focuses it on repeated detach', async () => {
    const { service, store, factory, window } = createService()

    await service.detach(folder)
    await service.detach({ ...folder, detached: true })

    expect(factory.create).toHaveBeenCalledTimes(1)
    expect(window.focus).toHaveBeenCalledOnce()
    expect(store.updateFolder).toHaveBeenCalledWith(folder.id, {
      detached: true,
      windowBounds: expect.any(Object)
    })
  })

  it('persists moved bounds after a debounce', async () => {
    vi.useFakeTimers()
    const { service, store, window } = createService()
    await service.detach(folder)
    store.updateFolder.mockClear()

    window.emit('move')
    await vi.advanceTimersByTimeAsync(250)

    expect(store.updateFolder).toHaveBeenCalledWith(folder.id, {
      windowBounds: window.getBounds()
    })
  })

  it('marks the folder attached when closed by the user', async () => {
    const { service, store, window } = createService()
    await service.detach(folder)
    store.updateFolder.mockClear()

    window.emit('close')
    await Promise.resolve()

    expect(store.updateFolder).toHaveBeenCalledWith(folder.id, {
      detached: false,
      windowBounds: window.getBounds()
    })
  })

  it('preserves detached state during application shutdown', async () => {
    const { service, store, window } = createService()
    await service.detach(folder)
    store.updateFolder.mockClear()

    service.beginShutdown()
    window.emit('close')
    await Promise.resolve()

    expect(store.updateFolder).not.toHaveBeenCalled()
  })

  it('restores every active detached folder', async () => {
    const { service, factory } = createService()

    await service.restore([
      { ...folder, detached: true },
      { ...folder, id: 'folder_2', detached: false }
    ])

    expect(factory.create).toHaveBeenCalledOnce()
  })

  it('clamps saved bounds to a visible display', async () => {
    const { service, factory } = createService()
    const bounds: WindowBounds = { x: 5000, y: 5000, width: 380, height: 520 }

    await service.detach({ ...folder, windowBounds: bounds })

    expect(factory.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: folder.id }),
      { x: 1540, y: 520, width: 380, height: 520 }
    )
  })

  it('places a dragged-out folder near the drop point', async () => {
    const { service, store, factory } = createService()

    await service.detach(
      { ...folder, windowBounds: { x: 10, y: 10, width: 380, height: 520 } },
      { x: 900, y: 520 }
    )

    expect(factory.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: folder.id }),
      { x: 860, y: 480, width: 380, height: 520 }
    )
    expect(store.updateFolder).toHaveBeenCalledWith(folder.id, {
      detached: true,
      windowBounds: { x: 860, y: 480, width: 380, height: 520 }
    })
  })

  it('publishes detached and attached folder state changes', async () => {
    const { service, window, onChanged } = createService()

    await service.detach(folder)
    expect(onChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: folder.id, detached: true })
    )

    window.emit('close')
    await Promise.resolve()
    await Promise.resolve()
    expect(onChanged).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: folder.id, detached: false })
    )
  })

  it('cancels stale bounds writes and reconciles without persisting close state', async () => {
    vi.useFakeTimers()
    const oldWindow = fakeWindow()
    const newWindow = fakeWindow()
    const store = { updateFolder: vi.fn().mockResolvedValue(folder) }
    const factory = {
      create: vi.fn()
        .mockReturnValueOnce(oldWindow)
        .mockReturnValueOnce(newWindow)
    }
    const service = new FolderWindowService(
      store,
      factory,
      () => [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )
    await service.detach(folder)
    store.updateFolder.mockClear()
    oldWindow.emit('resize')

    service.freezeForDataReplacement()
    oldWindow.emit('close')
    await vi.advanceTimersByTimeAsync(300)
    await service.reconcile([{ ...folder, detached: true }])

    expect(store.updateFolder).not.toHaveBeenCalled()
    expect(oldWindow.close).toHaveBeenCalledOnce()
    expect(factory.create).toHaveBeenCalledTimes(2)
  })
})
