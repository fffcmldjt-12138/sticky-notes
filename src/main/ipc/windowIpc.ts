import { ipcMain } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
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
}
