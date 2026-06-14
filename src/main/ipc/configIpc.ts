import { ipcMain } from 'electron'
import type { AppConfig } from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { AutoLaunchService } from '../services/AutoLaunchService'
import type { ConfigStore } from '../services/ConfigStore'
import type { TrayService } from '../services/TrayService'
import type { WindowService } from '../services/WindowService'

export function registerConfigIpc(
  store: ConfigStore,
  autoLaunch: AutoLaunchService,
  windows: WindowService,
  tray: TrayService
): void {
  ipcMain.handle(ipcChannels.configGet, () => store.get())
  ipcMain.handle(
    ipcChannels.configUpdate,
    async (_event, patch: Partial<Omit<AppConfig, 'version'>>) => {
      if (patch.autoLaunch !== undefined) autoLaunch.setEnabled(patch.autoLaunch)
      if (patch.alwaysOnTop !== undefined) windows.setAlwaysOnTop(patch.alwaysOnTop)
      const config = await store.update(patch)
      await tray.refresh()
      return config
    }
  )
}

