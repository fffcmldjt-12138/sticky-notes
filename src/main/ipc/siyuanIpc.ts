import { ipcMain } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import type { SiyuanSettingsPatch } from '../../shared/electronApi'
import type { SiyuanService } from '../services/SiyuanService'

export function registerSiyuanIpc(
  service: SiyuanService,
  events: { changed(item: Awaited<ReturnType<SiyuanService['sendNote']>>['item']): void }
): void {
  ipcMain.handle(ipcChannels.siyuanSettingsGet, () => service.getSettings())
  ipcMain.handle(
    ipcChannels.siyuanSettingsUpdate,
    (_event, patch: SiyuanSettingsPatch) => service.updateSettings(patch)
  )
  ipcMain.handle(ipcChannels.siyuanTestConnection, () => service.testConnection())
  ipcMain.handle(ipcChannels.siyuanSendNote, async (_event, noteId: string) => {
    const result = await service.sendNote(noteId)
    if (result.status === 'sent') events.changed(result.item)
    return result
  })
}
