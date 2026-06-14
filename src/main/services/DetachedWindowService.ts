import type {
  StickyItem,
  StickyItemPatch,
  WindowBounds
} from '../../shared/models'

export interface DetachedWindowHandle {
  focus(): void
  show(): void
  close(): void
  destroy(): void
  getBounds(): WindowBounds
  on(event: 'close' | 'move' | 'resize', listener: () => void): void
}

interface DetachedWindowStore {
  update(id: string, patch: StickyItemPatch): Promise<StickyItem | null>
}

interface DetachedWindowFactory {
  create(item: StickyItem, bounds: WindowBounds): DetachedWindowHandle
}

const DEFAULT_WIDTH = 340
const DEFAULT_HEIGHT = 440

export function ensureVisibleBounds(
  bounds: WindowBounds,
  workAreas: WindowBounds[]
): WindowBounds {
  const workArea = workAreas.find((area) => intersects(bounds, area)) ?? workAreas[0]
  if (!workArea) return bounds
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  return {
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height
  }
}

function intersects(a: WindowBounds, b: WindowBounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

export class DetachedWindowService {
  private readonly windows = new Map<string, DetachedWindowHandle>()
  private readonly boundsTimers = new Map<string, NodeJS.Timeout>()
  private shuttingDown = false

  constructor(
    private readonly store: DetachedWindowStore,
    private readonly factory: DetachedWindowFactory,
    private readonly getWorkAreas: () => WindowBounds[],
    private readonly onChanged: (item: StickyItem) => void = () => undefined
  ) {}

  async detach(item: StickyItem): Promise<void> {
    const existing = this.windows.get(item.id)
    if (existing) {
      existing.show()
      existing.focus()
      return
    }

    const workAreas = this.getWorkAreas()
    const first = workAreas[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const bounds = ensureVisibleBounds(
      item.windowBounds ?? {
        x: first.x + first.width - DEFAULT_WIDTH - 24,
        y: first.y + 48,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT
      },
      workAreas
    )
    const window = this.factory.create(item, bounds)
    this.windows.set(item.id, window)
    this.bindWindow(item.id, window)
    const updated = await this.store.update(item.id, {
      detached: true,
      windowBounds: bounds
    })
    if (updated) this.onChanged(updated)
  }

  async attach(itemId: string): Promise<void> {
    const window = this.windows.get(itemId)
    if (window) {
      this.windows.delete(itemId)
      window.close()
    }
    const updated = await this.store.update(itemId, { detached: false })
    if (updated) this.onChanged(updated)
  }

  async restore(items: StickyItem[]): Promise<void> {
    for (const item of items) {
      if (item.detached) await this.detach(item)
    }
  }

  closeForDelete(itemId: string): void {
    const window = this.windows.get(itemId)
    this.windows.delete(itemId)
    window?.destroy()
  }

  getWindow(itemId: string): DetachedWindowHandle | undefined {
    return this.windows.get(itemId)
  }

  beginShutdown(): void {
    this.shuttingDown = true
    for (const timer of this.boundsTimers.values()) clearTimeout(timer)
    this.boundsTimers.clear()
  }

  private bindWindow(itemId: string, window: DetachedWindowHandle): void {
    const scheduleBoundsSave = (): void => {
      const previous = this.boundsTimers.get(itemId)
      if (previous) clearTimeout(previous)
      this.boundsTimers.set(
        itemId,
        setTimeout(() => {
          this.boundsTimers.delete(itemId)
          void this.store
            .update(itemId, { windowBounds: window.getBounds() })
            .then((item) => {
              if (item) this.onChanged(item)
            })
        }, 250)
      )
    }
    window.on('move', scheduleBoundsSave)
    window.on('resize', scheduleBoundsSave)
    window.on('close', () => {
      this.windows.delete(itemId)
      const timer = this.boundsTimers.get(itemId)
      if (timer) clearTimeout(timer)
      this.boundsTimers.delete(itemId)
      if (!this.shuttingDown) {
        void this.store
          .update(itemId, {
            detached: false,
            windowBounds: window.getBounds()
          })
          .then((item) => {
            if (item) this.onChanged(item)
          })
      }
    })
  }
}
