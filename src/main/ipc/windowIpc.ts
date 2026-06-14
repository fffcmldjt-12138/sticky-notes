import { ipcMain } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import type { WindowService } from '../services/WindowService'

export function registerWindowIpc(windows: WindowService): void {
  ipcMain.on(ipcChannels.windowExpand, () => windows.expand())
  ipcMain.on(ipcChannels.windowScheduleCollapse, () => windows.scheduleCollapse())
  ipcMain.on(ipcChannels.windowCancelCollapse, () => windows.cancelCollapse())
  ipcMain.on(ipcChannels.windowHide, () => windows.hide())
  ipcMain.on(ipcChannels.windowSuspendAutoHide, (_event, value: boolean) =>
    windows.suspendAutoHide(value)
  )
}

