import type {
  FolderItem,
  FolderPatch,
  WindowBounds
} from '../../shared/models'
import {
  ensureVisibleBounds,
  windowBoundsFromDropPoint,
  type WindowDropPoint
} from './DetachedWindowService'

export interface FolderWindowHandle {
  focus(): void
  show(): void
  close(): void
  destroy(): void
  getBounds(): WindowBounds
  on(event: 'close' | 'move' | 'resize', listener: () => void): void
}

interface FolderWindowStore {
  updateFolder(id: string, patch: FolderPatch): Promise<FolderItem | null>
}

interface FolderWindowFactory {
  create(folder: FolderItem, bounds: WindowBounds): FolderWindowHandle
}

const DEFAULT_WIDTH = 380
const DEFAULT_HEIGHT = 520

export class FolderWindowService {
  private readonly windows = new Map<string, FolderWindowHandle>()
  private readonly boundsTimers = new Map<string, NodeJS.Timeout>()
  private readonly nonPersistingWindows = new WeakSet<FolderWindowHandle>()
  private shuttingDown = false

  constructor(
    private readonly store: FolderWindowStore,
    private readonly factory: FolderWindowFactory,
    private readonly getWorkAreas: () => WindowBounds[],
    private readonly onChanged: (folder: FolderItem) => void = () => undefined
  ) {}

  async detach(folder: FolderItem, dropPoint?: WindowDropPoint): Promise<void> {
    const existing = this.windows.get(folder.id)
    if (existing) {
      existing.show()
      existing.focus()
      return
    }

    const workAreas = this.getWorkAreas()
    const first = workAreas[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const bounds = dropPoint
      ? windowBoundsFromDropPoint(
          dropPoint,
          folder.windowBounds?.width ?? DEFAULT_WIDTH,
          folder.windowBounds?.height ?? DEFAULT_HEIGHT,
          workAreas
        )
      : ensureVisibleBounds(
          folder.windowBounds ?? {
            x: first.x + first.width - DEFAULT_WIDTH - 32,
            y: first.y + 64,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT
          },
          workAreas
        )
    this.openWindow(folder, bounds)
    const updated = await this.store.updateFolder(folder.id, {
      detached: true,
      windowBounds: bounds
    })
    if (updated) this.onChanged(updated)
  }

  async attach(folderId: string): Promise<void> {
    const window = this.windows.get(folderId)
    if (window) {
      this.windows.delete(folderId)
      window.close()
    }
    const updated = await this.store.updateFolder(folderId, { detached: false })
    if (updated) this.onChanged(updated)
  }

  async restore(folders: FolderItem[]): Promise<void> {
    for (const folder of folders) {
      if (folder.detached) this.openSnapshotWindow(folder)
    }
  }

  freezeForDataReplacement(): void {
    for (const timer of this.boundsTimers.values()) clearTimeout(timer)
    this.boundsTimers.clear()
    for (const [folderId, window] of this.windows) {
      this.windows.delete(folderId)
      this.nonPersistingWindows.add(window)
      window.close()
    }
  }

  async reconcile(folders: FolderItem[]): Promise<void> {
    this.freezeForDataReplacement()
    await this.restore(folders)
  }

  closeForDelete(folderId: string): void {
    const window = this.windows.get(folderId)
    this.windows.delete(folderId)
    window?.destroy()
  }

  beginShutdown(): void {
    this.shuttingDown = true
    for (const timer of this.boundsTimers.values()) clearTimeout(timer)
    this.boundsTimers.clear()
  }

  private bindWindow(folderId: string, window: FolderWindowHandle): void {
    const scheduleBoundsSave = (): void => {
      const previous = this.boundsTimers.get(folderId)
      if (previous) clearTimeout(previous)
      this.boundsTimers.set(
        folderId,
        setTimeout(() => {
          this.boundsTimers.delete(folderId)
          void this.store
            .updateFolder(folderId, { windowBounds: window.getBounds() })
            .then((folder) => {
              if (folder) this.onChanged(folder)
            })
        }, 250)
      )
    }

    window.on('move', scheduleBoundsSave)
    window.on('resize', scheduleBoundsSave)
    window.on('close', () => {
      this.windows.delete(folderId)
      const timer = this.boundsTimers.get(folderId)
      if (timer) clearTimeout(timer)
      this.boundsTimers.delete(folderId)
      if (!this.shuttingDown && !this.nonPersistingWindows.has(window)) {
        void this.store
          .updateFolder(folderId, {
            detached: false,
            windowBounds: window.getBounds()
          })
          .then((folder) => {
            if (folder) this.onChanged(folder)
          })
      }
    })
  }

  private openSnapshotWindow(folder: FolderItem): void {
    if (this.windows.has(folder.id)) return
    const workAreas = this.getWorkAreas()
    const first = workAreas[0] ?? { x: 0, y: 0, width: 1920, height: 1080 }
    const bounds = ensureVisibleBounds(
      folder.windowBounds ?? {
        x: first.x + first.width - DEFAULT_WIDTH - 32,
        y: first.y + 64,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT
      },
      workAreas
    )
    this.openWindow(folder, bounds)
  }

  private openWindow(folder: FolderItem, bounds: WindowBounds): void {
    const window = this.factory.create(folder, bounds)
    this.windows.set(folder.id, window)
    this.bindWindow(folder.id, window)
  }
}
