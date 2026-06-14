import { app, Menu, nativeImage, Tray } from 'electron'
import type { ConfigStore } from './ConfigStore'
import type { AutoLaunchService } from './AutoLaunchService'
import type { WindowService } from './WindowService'

const trayIcon = nativeImage.createFromDataURL(
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAQElEQVR42mNgGAXUBv8ZGBj+M8ABmJiY/zMwMPxnYGD4z8DA8J+BgeE/AwPDfwYGhv8MDAz/GZgY/gMZGBj+AwC5KQ8RUDDMpAAAAABJRU5ErkJggg=='
)

export class TrayService {
  private tray: Tray | null = null

  constructor(
    private readonly windows: WindowService,
    private readonly config: ConfigStore,
    private readonly autoLaunch: AutoLaunchService
  ) {}

  async create(): Promise<void> {
    this.tray = new Tray(trayIcon)
    this.tray.setToolTip('轻量便签')
    this.tray.on('click', () => this.windows.show())
    await this.refresh()
  }

  async refresh(): Promise<void> {
    if (!this.tray) return
    const config = await this.config.get()
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '显示面板', click: () => this.windows.show() },
        { label: '隐藏面板', click: () => this.windows.hide() },
        { type: 'separator' },
        { label: '新建笔记', click: () => this.windows.sendOpenEditor('note') },
        { label: '新建待办', click: () => this.windows.sendOpenEditor('todo') },
        { type: 'separator' },
        {
          label: '开机自启',
          type: 'checkbox',
          checked: config.autoLaunch,
          click: async (item) => {
            this.autoLaunch.setEnabled(item.checked)
            await this.config.update({ autoLaunch: item.checked })
            await this.refresh()
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            this.windows.quit()
            app.quit()
          }
        }
      ])
    )
  }
}

