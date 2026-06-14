import { app, Notification } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { registerConfigIpc } from './ipc/configIpc'
import { registerNoteIpc } from './ipc/noteIpc'
import { registerWindowIpc } from './ipc/windowIpc'
import { AutoLaunchService } from './services/AutoLaunchService'
import { ConfigStore } from './services/ConfigStore'
import { NoteStore } from './services/NoteStore'
import { ReminderService } from './services/ReminderService'
import { TrayService } from './services/TrayService'
import { WindowService } from './services/WindowService'

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  void app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.stickynotes.desktop')

    const userData = app.getPath('userData')
    const notes = new NoteStore(userData)
    const config = new ConfigStore(userData)
    const autoLaunch = new AutoLaunchService()
    const windows = new WindowService()
    const tray = new TrayService(windows, config, autoLaunch)
    const reminder = new ReminderService(notes, (title, body) => {
      new Notification({ title, body }).show()
    })

    const currentConfig = await config.get()
    autoLaunch.setEnabled(currentConfig.autoLaunch)
    windows.create()
    windows.setAlwaysOnTop(currentConfig.alwaysOnTop)
    await tray.create()

    registerNoteIpc(notes)
    registerWindowIpc(windows)
    registerConfigIpc(config, autoLaunch, windows, tray)
    reminder.start()

    app.on('second-instance', () => windows.show())
    app.on('before-quit', () => {
      reminder.stop()
      windows.quit()
    })
  })
}

app.on('window-all-closed', () => {
  // The tray owns application lifetime.
})
