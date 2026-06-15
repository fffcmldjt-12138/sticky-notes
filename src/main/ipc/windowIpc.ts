import { ipcMain, shell } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import { normalizeExternalUrl } from '../../shared/externalUrl'
import type { WindowService } from '../services/WindowService'
import type { DetachedWindowService } from '../services/DetachedWindowService'
import type { NoteStore } from '../services/NoteStore'

export function registerWindowIpc(
  windows: WindowService,
  detachedWindows: DetachedWindowService,
  notes: NoteStore
): void {
  ipcMain.on(ipcChannels.windowExpand, () => windows.expand())
  ipcMain.on(ipcChannels.windowScheduleCollapse, () => windows.scheduleCollapse())
  ipcMain.on(ipcChannels.windowCancelCollapse, () => windows.cancelCollapse())
  ipcMain.on(ipcChannels.windowHide, () => windows.hide())
  ipcMain.on(ipcChannels.windowSuspendAutoHide, (_event, value: boolean) =>
    windows.suspendAutoHide(value)
  )
  ipcMain.handle(ipcChannels.windowDetach, async (_event, itemId: string) => {
    const item = (await notes.list()).find((entry) => entry.id === itemId)
    if (item) await detachedWindows.detach(item)
  })
  ipcMain.handle(ipcChannels.windowAttach, (_event, itemId: string) =>
    detachedWindows.attach(itemId)
  )
  ipcMain.handle(ipcChannels.windowOpenExternal, async (_event, value: string) => {
    const url = normalizeExternalUrl(value)
    if (!url) return false
    await shell.openExternal(url)
    return true
  })
}
