import { app } from 'electron'

export class AutoLaunchService {
  setEnabled(enabled: boolean): void {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath
    })
  }
}

