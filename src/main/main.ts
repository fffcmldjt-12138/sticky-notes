import { join } from 'node:path'
import { app, BrowserWindow, Notification, screen } from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { registerConfigIpc } from './ipc/configIpc'
import { registerNoteIpc } from './ipc/noteIpc'
import { registerWindowIpc } from './ipc/windowIpc'
import { AutoLaunchService } from './services/AutoLaunchService'
import { ConfigStore } from './services/ConfigStore'
import {
  DetachedWindowService,
  type DetachedWindowHandle
} from './services/DetachedWindowService'
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
    const broadcast = (channel: string, value: unknown): void => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send(channel, value)
      }
    }
    const detachedWindows = new DetachedWindowService(
      notes,
      {
        create: (item, bounds): DetachedWindowHandle => {
          const window = new BrowserWindow({
            ...bounds,
            minWidth: 280,
            minHeight: 300,
            frame: false,
            resizable: true,
            show: false,
            alwaysOnTop: true,
            backgroundColor: item.bodyTheme === 'dark' ? '#20242b' : '#ffffff',
            webPreferences: {
              preload: join(__dirname, '../preload/index.mjs'),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: false
            }
          })
          const query = `mode=detached&id=${encodeURIComponent(item.id)}`
          if (is.dev && process.env.ELECTRON_RENDERER_URL) {
            void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${query}`)
          } else {
            void window.loadFile(join(__dirname, '../renderer/index.html'), {
              query: { mode: 'detached', id: item.id }
            })
          }
          window.once('ready-to-show', () => window.show())
          return window
        }
      },
      () => screen.getAllDisplays().map((display) => display.workArea),
      (item) => broadcast('notes:item-changed', item)
    )
    const tray = new TrayService(windows, config, autoLaunch)
    const reminder = new ReminderService(notes, (title, body) => {
      new Notification({ title, body }).show()
    })

    const currentConfig = await config.get()
    autoLaunch.setEnabled(currentConfig.autoLaunch)
    windows.create()
    windows.setAlwaysOnTop(currentConfig.alwaysOnTop)
    await tray.create()

    registerNoteIpc(notes, {
      changed: (item) => broadcast('notes:item-changed', item),
      deleted: (itemId) => {
        detachedWindows.closeForDelete(itemId)
        broadcast('notes:item-deleted', itemId)
      }
    })
    registerWindowIpc(windows, detachedWindows, notes)
    registerConfigIpc(config, autoLaunch, windows, tray)
    reminder.start()
    await detachedWindows.restore(await notes.list())

    app.on('second-instance', () => windows.show())
    app.on('before-quit', () => {
      reminder.stop()
      detachedWindows.beginShutdown()
      windows.quit()
    })
  })
}

app.on('window-all-closed', () => {
  // The tray owns application lifetime.
})
