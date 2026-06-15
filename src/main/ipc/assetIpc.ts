import { BrowserWindow, dialog, ipcMain } from 'electron'
import { ipcChannels } from '../../shared/ipcChannels'
import type { AssetService } from '../services/AssetService'

export function registerAssetIpc(assets: AssetService): void {
  ipcMain.handle(ipcChannels.assetSelect, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      filters: [{
        name: '图片',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp']
      }]
    }
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return null
    return assets.importFile(result.filePaths[0])
  })

  ipcMain.handle(
    ipcChannels.assetImportData,
    (_event, bytes: Uint8Array, mimeType: string) =>
      assets.importBuffer(bytes, mimeType)
  )
}
