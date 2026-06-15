import { ipcMain } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import type { RecycleService } from '../services/RecycleService'

export function registerRecycleIpc(service: RecycleService): void {
  ipcMain.handle(ipcChannels.recycleList, () => service.list())
  ipcMain.handle(ipcChannels.recycleRestoreItem, (_event, id: string) =>
    service.restoreItem(id)
  )
  ipcMain.handle(ipcChannels.recycleRestoreFolder, (_event, id: string) =>
    service.restoreFolder(id)
  )
  ipcMain.handle(ipcChannels.recycleEmpty, () => service.empty())
  ipcMain.handle(ipcChannels.recycleCleanUnusedImages, () =>
    service.cleanUnusedImages()
  )
}
