import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  net,
  Notification,
  protocol,
  screen
} from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { registerConfigIpc } from './ipc/configIpc'
import { registerAssetIpc } from './ipc/assetIpc'
import { registerFolderIpc } from './ipc/folderIpc'
import { registerNoteIpc } from './ipc/noteIpc'
import { registerReminderIpc } from './ipc/reminderIpc'
import { registerRecycleIpc } from './ipc/recycleIpc'
import { registerWindowIpc } from './ipc/windowIpc'
import { ipcChannels } from '../shared/ipcChannels'
import { AutoLaunchService } from './services/AutoLaunchService'
import { AssetService } from './services/AssetService'
import { BackupService } from './services/BackupService'
import { ConfigStore } from './services/ConfigStore'
import {
  DetachedWindowService,
  type DetachedWindowHandle
} from './services/DetachedWindowService'
import {
  FolderWindowService,
  type FolderWindowHandle
} from './services/FolderWindowService'
import { NoteStore } from './services/NoteStore'
import { DragPreviewWindowService } from './services/DragPreviewWindowService'
import { ReminderService } from './services/ReminderService'
import { ReminderPresentationService } from './services/ReminderPresentationService'
import {
  ReminderWindowService,
  type ReminderWindowHandle
} from './services/ReminderWindowService'
import { RecycleService } from './services/RecycleService'
import { TrayService } from './services/TrayService'
import { WindowService } from './services/WindowService'
import { DataUnavailableError } from './services/storageErrors'
import {
  validateAppConfig,
  validateNotesFile
} from './services/storageValidators'

const hasLock = app.requestSingleInstanceLock()
protocol.registerSchemesAsPrivileged([{
  scheme: 'asset',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true
  }
}])
if (!hasLock) {
  app.quit()
} else {
  void app.whenReady().then(async () => {
    electronApp.setAppUserModelId('com.stickynotes.desktop')

    const userData = app.getPath('userData')
    const backups = new BackupService(join(userData, 'backups'), {
      notes: validateNotesFile,
      config: validateAppConfig
    })
    const notes = new NoteStore(userData, backups)
    const assets = new AssetService(userData)
    const config = new ConfigStore(userData, backups)
    const autoLaunch = new AutoLaunchService()
    const windows = new WindowService()
    const dragPreview = new DragPreviewWindowService(
      {
        create: (options) => new BrowserWindow(options)
      },
      () => screen.getCursorScreenPoint()
    )
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
    const folderWindows = new FolderWindowService(
      notes,
      {
        create: (folder, bounds): FolderWindowHandle => {
          const window = new BrowserWindow({
            ...bounds,
            minWidth: 320,
            minHeight: 360,
            frame: false,
            resizable: true,
            show: false,
            alwaysOnTop: true,
            backgroundColor: '#f3f5f8',
            webPreferences: {
              preload: join(__dirname, '../preload/index.mjs'),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: false
            }
          })
          const query = `mode=folder&id=${encodeURIComponent(folder.id)}`
          if (is.dev && process.env.ELECTRON_RENDERER_URL) {
            void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${query}`)
          } else {
            void window.loadFile(join(__dirname, '../renderer/index.html'), {
              query: { mode: 'folder', id: folder.id }
            })
          }
          window.once('ready-to-show', () => window.show())
          return window
        }
      },
      () => screen.getAllDisplays().map((display) => display.workArea),
      (folder) => broadcast(ipcChannels.folderChanged, folder)
    )
    const tray = new TrayService(windows, config, autoLaunch)
    const reminderWindows = new ReminderWindowService(
      {
        create: (payload): ReminderWindowHandle => {
          const window = new BrowserWindow({
            width: 460,
            height: 320,
            minWidth: 420,
            minHeight: 300,
            frame: false,
            resizable: false,
            show: false,
            alwaysOnTop: true,
            skipTaskbar: false,
            backgroundColor: '#ffffff',
            webPreferences: {
              preload: join(__dirname, '../preload/index.mjs'),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: false
            }
          })
          const payloadJson = JSON.stringify(payload)
          if (is.dev && process.env.ELECTRON_RENDERER_URL) {
            const query = new URLSearchParams({
              mode: 'reminder',
              payload: payloadJson
            })
            void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?${query}`)
          } else {
            void window.loadFile(join(__dirname, '../renderer/index.html'), {
              query: { mode: 'reminder', payload: payloadJson }
            })
          }
          window.center()
          window.setAlwaysOnTop(true, 'screen-saver')
          let ready = false
          const whenReady = (operation: () => void): void => {
            if (ready) {
              operation()
              return
            }
            window.once('ready-to-show', () => {
              ready = true
              operation()
            })
          }
          return {
            show: () => whenReady(() => window.show()),
            focus: () => whenReady(() => window.focus()),
            flashFrame: (flag) => whenReady(() => window.flashFrame(flag)),
            close: () => window.close(),
            isDestroyed: () => window.isDestroyed(),
            on: (_event, listener) => window.on('closed', listener)
          }
        }
      },
      async (payload, action) => {
        if (action.type === 'open' && payload.itemId) {
          windows.sendOpenItem(payload.itemId)
          return
        }
        if (
          action.type === 'snooze' &&
          payload.itemId &&
          payload.taskId &&
          payload.reminderId
        ) {
          const updated = await notes.snoozeReminder(
            {
              itemId: payload.itemId,
              taskId: payload.taskId,
              subtaskId: payload.subtaskId,
              reminderId: payload.reminderId
            },
            new Date(Date.now() + action.minutes * 60_000)
          )
          if (updated) broadcast(ipcChannels.itemChanged, updated)
        }
      }
    )
    const reminderPresentation = new ReminderPresentationService(
      (title, body) => new Notification({ title, body }),
      windows,
      (payload) => broadcast(ipcChannels.reminderFired, payload),
      () => new Date(),
      reminderWindows
    )
    const reminder = new ReminderService(notes, (title, body, payload) =>
      reminderPresentation.present(title, body, payload)
    )
    const recycle = new RecycleService(notes, () => new Date(), assets)

    let currentConfig
    try {
      const warmed = await Promise.all([notes.getSnapshot(), config.get()])
      currentConfig = warmed[1]
    } catch (error) {
      if (error instanceof DataUnavailableError) {
        console.error(
          `Startup blocked because ${error.source} data is unavailable`,
          error
        )
      }
      throw error
    }
    await recycle.purgeExpired()
    protocol.handle('asset', (request) => {
      const filePath = assets.resolveUrl(request.url)
      return filePath
        ? net.fetch(pathToFileURL(filePath).toString())
        : new Response('Asset not found', { status: 404 })
    })
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
    registerAssetIpc(assets)
    registerFolderIpc(notes, {
      beforeDelete: (folderId) => folderWindows.closeForDelete(folderId),
      changed: (folder) => broadcast(ipcChannels.folderChanged, folder),
      deleted: (folderId) => broadcast(ipcChannels.folderDeleted, folderId)
    })
    registerRecycleIpc(recycle)
    registerReminderIpc(reminderWindows)
    registerWindowIpc(windows, detachedWindows, folderWindows, notes, dragPreview)
    registerConfigIpc(config, autoLaunch, windows, tray)
    reminder.start()
    await detachedWindows.restore(await notes.list())
    await folderWindows.restore(await notes.listFolders())

    if (process.env.STICKY_NOTES_SMOKE_QUIT === '1') {
      setTimeout(() => app.quit(), 500)
    }

    app.on('second-instance', () => windows.show())
    app.on('before-quit', () => {
      reminder.stop()
      reminderWindows.closeAll()
      dragPreview.stop()
      detachedWindows.beginShutdown()
      folderWindows.beginShutdown()
      windows.quit()
    })
  }).catch((error) => {
    console.error('Fatal startup failure', error)
    app.exit(1)
  })
}

app.on('window-all-closed', () => {
  // The tray owns application lifetime.
})
