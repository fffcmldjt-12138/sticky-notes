import { ipcMain, screen, shell } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import { normalizeExternalUrl } from '../../shared/externalUrl'
import type { WindowService } from '../services/WindowService'
import type { DetachedWindowService } from '../services/DetachedWindowService'
import type { FolderWindowService } from '../services/FolderWindowService'
import type { NoteStore } from '../services/NoteStore'
import type { DragPreviewWindowService } from '../services/DragPreviewWindowService'
import type {
  DetachWindowOptions,
  DragPreviewPayload
} from '../../shared/electronApi'

export function registerWindowIpc(
  windows: WindowService,
  detachedWindows: DetachedWindowService,
  folderWindows: FolderWindowService,
  notes: NoteStore,
  dragPreview?: DragPreviewWindowService
): void {
  ipcMain.on(ipcChannels.windowExpand, () => windows.expand())
  ipcMain.on(ipcChannels.windowScheduleCollapse, () => windows.scheduleCollapse())
  ipcMain.on(ipcChannels.windowCancelCollapse, () => windows.cancelCollapse())
  ipcMain.on(ipcChannels.windowHide, () => windows.hide())
  ipcMain.on(ipcChannels.windowSuspendAutoHide, (_event, value: boolean) =>
    windows.suspendAutoHide(value)
  )
  ipcMain.handle(
    ipcChannels.windowDetach,
    async (_event, itemId: string, options?: DetachWindowOptions) => {
    const item = (await notes.list()).find((entry) => entry.id === itemId)
    if (item) {
      await detachedWindows.detach(
        item,
        options?.atCursor ? screen.getCursorScreenPoint() : undefined
      )
    }
  })
  ipcMain.handle(ipcChannels.windowAttach, (_event, itemId: string) =>
    detachedWindows.attach(itemId)
  )
  ipcMain.handle(
    ipcChannels.windowDetachFolder,
    async (_event, folderId: string, options?: DetachWindowOptions) => {
    const folder = (await notes.listFolders()).find((entry) => entry.id === folderId)
    if (folder) {
      await folderWindows.detach(
        folder,
        options?.atCursor ? screen.getCursorScreenPoint() : undefined
      )
    }
  })
  ipcMain.handle(ipcChannels.windowAttachFolder, (_event, folderId: string) =>
    folderWindows.attach(folderId)
  )
  ipcMain.handle(ipcChannels.windowOpenExternal, async (_event, value: string) => {
    const url = normalizeExternalUrl(value)
    if (!url) return false
    await shell.openExternal(url)
    return true
  })
  ipcMain.on(
    ipcChannels.windowDragPreviewStart,
    (_event, payload: DragPreviewPayload) => dragPreview?.start(payload)
  )
  ipcMain.on(ipcChannels.windowDragPreviewStop, () => dragPreview?.stop())
}
