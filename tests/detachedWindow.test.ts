import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoteItem, WindowBounds } from '../src/shared/models'
import {
  DetachedWindowService,
  windowBoundsFromDropPoint,
  ensureVisibleBounds,
  type DetachedWindowHandle
} from '../src/main/services/DetachedWindowService'

const item: NoteItem = {
  revision: 1,
  id: 'note_1',
  type: 'note',
  title: 'Detached',
  contentMarkdown: 'Text',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

function fakeWindow(): DetachedWindowHandle & {
  emit(event: 'close' | 'move' | 'resize'): void
} {
  const listeners = new Map<string, () => void>()
  return {
    focus: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    destroy: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 320, height: 420 }),
    on: vi.fn((event, listener) => listeners.set(event, listener)),
    emit: (event) => listeners.get(event)?.()
  }
}

describe('DetachedWindowService', () => {
  afterEach(() => vi.useRealTimers())
  it('creates one window and focuses it on repeated detach', async () => {
    const window = fakeWindow()
    const factory = { create: vi.fn().mockReturnValue(window) }
    const store = { update: vi.fn().mockResolvedValue(item) }
    const service = new DetachedWindowService(
      store,
      factory,
      () => [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )

    await service.detach(item)
    await service.detach({ ...item, detached: true })

    expect(factory.create).toHaveBeenCalledTimes(1)
    expect(window.focus).toHaveBeenCalledOnce()
    expect(store.update).toHaveBeenCalledWith('note_1', {
      detached: true,
      windowBounds: expect.any(Object)
    })
  })

  it('marks an item attached when its window is closed by the user', async () => {
    const window = fakeWindow()
    const store = { update: vi.fn().mockResolvedValue(item) }
    const service = new DetachedWindowService(
      store,
      { create: vi.fn().mockReturnValue(window) },
      () => [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )

    await service.detach(item)
    window.emit('close')
    await Promise.resolve()

    expect(store.update).toHaveBeenLastCalledWith('note_1', {
      detached: false,
      windowBounds: expect.any(Object)
    })
  })

  it('clamps off-screen bounds into a visible display', () => {
    const result = ensureVisibleBounds(
      { x: 5000, y: 5000, width: 320, height: 420 },
      [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )

    expect(result).toEqual({ x: 1600, y: 620, width: 320, height: 420 })
  })

  it('places a dragged-out note near the drop point', async () => {
    const window = fakeWindow()
    const factory = { create: vi.fn().mockReturnValue(window) }
    const store = { update: vi.fn().mockResolvedValue(item) }
    const service = new DetachedWindowService(
      store,
      factory,
      () => [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )

    await service.detach(
      { ...item, windowBounds: { x: 20, y: 20, width: 340, height: 440 } },
      { x: 900, y: 520 }
    )

    expect(factory.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: item.id }),
      { x: 860, y: 480, width: 340, height: 440 }
    )
    expect(store.update).toHaveBeenCalledWith(item.id, {
      detached: true,
      windowBounds: { x: 860, y: 480, width: 340, height: 440 }
    })
  })

  it('clamps dragged-out bounds when the drop point is near the display edge', () => {
    expect(windowBoundsFromDropPoint(
      { x: 1900, y: 1020 },
      340,
      440,
      [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )).toEqual({ x: 1580, y: 600, width: 340, height: 440 })
  })

  it('preserves detached state when application shutdown closes windows', async () => {
    const window = fakeWindow()
    const store = { update: vi.fn().mockResolvedValue(item) }
    const service = new DetachedWindowService(
      store,
      { create: vi.fn().mockReturnValue(window) },
      () => [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )

    await service.detach(item)
    store.update.mockClear()
    service.beginShutdown()
    window.emit('close')
    await Promise.resolve()

    expect(store.update).not.toHaveBeenCalledWith(
      'note_1',
      expect.objectContaining({ detached: false })
    )
  })

  it('cancels stale bounds writes and reconciles without persisting close state', async () => {
    vi.useFakeTimers()
    const oldWindow = fakeWindow()
    const newWindow = fakeWindow()
    const store = { update: vi.fn().mockResolvedValue(item) }
    const factory = {
      create: vi.fn()
        .mockReturnValueOnce(oldWindow)
        .mockReturnValueOnce(newWindow)
    }
    const service = new DetachedWindowService(
      store,
      factory,
      () => [{ x: 0, y: 0, width: 1920, height: 1040 }]
    )
    await service.detach(item)
    store.update.mockClear()
    oldWindow.emit('move')

    service.freezeForDataReplacement()
    oldWindow.emit('close')
    await vi.advanceTimersByTimeAsync(300)
    await service.reconcile([{ ...item, detached: true }])

    expect(store.update).not.toHaveBeenCalled()
    expect(oldWindow.close).toHaveBeenCalledOnce()
    expect(factory.create).toHaveBeenCalledTimes(2)
  })
})
