import { describe, expect, it, vi } from 'vitest'
import { DragPreviewWindowService } from '../src/main/services/DragPreviewWindowService'

class FakePreviewWindow {
  loadURL = vi.fn()
  setBounds = vi.fn()
  setIgnoreMouseEvents = vi.fn()
  setAlwaysOnTop = vi.fn()
  showInactive = vi.fn()
  close = vi.fn()
  destroyed = false

  isDestroyed(): boolean {
    return this.destroyed
  }
}

describe('DragPreviewWindowService', () => {
  it('shows a transparent click-through preview near the cursor and closes it', async () => {
    const created: FakePreviewWindow[] = []
    const setInterval = vi.fn((callback: () => void) => {
      callback()
      return 12
    })
    const clearInterval = vi.fn()
    const service = new DragPreviewWindowService(
      {
        create: (options) => {
          expect(options).toMatchObject({
            frame: false,
            transparent: true,
            focusable: false,
            alwaysOnTop: true,
            skipTaskbar: true
          })
          const window = new FakePreviewWindow()
          created.push(window)
          return window
        }
      },
      () => ({ x: 320, y: 180 }),
      setInterval,
      clearInterval
    )

    service.start({
      kind: 'item',
      itemType: 'note',
      title: '视觉预览',
      headerColor: '#f2c94c',
      bodyTheme: 'light'
    })

    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 33)
    expect(created).toHaveLength(1)
    expect(created[0].setIgnoreMouseEvents).toHaveBeenCalledWith(true)
    expect(created[0].setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver')
    await Promise.resolve()
    expect(created[0].showInactive).toHaveBeenCalled()
    expect(created[0].setBounds).toHaveBeenCalledWith({
      x: 336,
      y: 196,
      width: 260,
      height: 112
    })
    expect(created[0].setBounds).toHaveBeenCalledTimes(1)
    expect(created[0].loadURL.mock.calls[0][0]).toContain('data:text/html')
    expect(decodeURIComponent(created[0].loadURL.mock.calls[0][0]))
      .toContain('视觉预览')

    service.stop()

    expect(clearInterval).toHaveBeenCalledWith(12)
    expect(created[0].close).toHaveBeenCalled()
  })

  it('waits for the preview HTML to load before showing the window', async () => {
    let resolveLoad!: () => void
    const window = new FakePreviewWindow()
    window.loadURL.mockReturnValue(new Promise<void>((resolve) => {
      resolveLoad = resolve
    }))
    const service = new DragPreviewWindowService(
      { create: () => window },
      () => ({ x: 10, y: 20 }),
      vi.fn(() => 1),
      vi.fn()
    )

    service.start({
      kind: 'folder',
      title: '备忘录'
    })

    expect(window.showInactive).not.toHaveBeenCalled()

    resolveLoad()
    await Promise.resolve()

    expect(window.showInactive).toHaveBeenCalled()
  })
})
