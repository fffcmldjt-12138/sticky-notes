import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'
import { getCollapsedBounds, getExpandedBounds } from './windowGeometry'
import { WindowLifecycle } from './WindowLifecycle'
import { PanelVisibilityState } from './PanelVisibilityState'

const PANEL_WIDTH = 360
const HOT_EDGE_WIDTH = 8
const COLLAPSE_DELAY = 500

export class WindowService {
  private window: BrowserWindow | null = null
  private collapseTimer: NodeJS.Timeout | null = null
  private autoHideSuspended = false
  private readonly visibility = new PanelVisibilityState(Date.now())
  private readonly lifecycle = new WindowLifecycle()

  create(): BrowserWindow {
    const workArea = screen.getPrimaryDisplay().workArea
    this.window = new BrowserWindow({
      ...getExpandedBounds(workArea, PANEL_WIDTH),
      minWidth: PANEL_WIDTH,
      maxWidth: PANEL_WIDTH,
      frame: false,
      transparent: false,
      resizable: false,
      show: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#f3f5f8',
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    this.window.on('close', (event) => {
      if (this.lifecycle.shouldHideOnClose()) {
        event.preventDefault()
        this.window?.hide()
      }
    })

    this.window.once('ready-to-show', () => this.window?.show())

    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      void this.window.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      void this.window.loadFile(join(__dirname, '../renderer/index.html'))
    }
    return this.window
  }

  show(): void {
    this.cancelCollapse()
    this.expand()
    this.window?.show()
    this.window?.focus()
  }

  hide(): void {
    this.window?.hide()
  }

  expand(): void {
    const window = this.window
    if (!window || !this.visibility.requestExpand(Date.now())) return
    const workArea = screen.getDisplayMatching(window.getBounds()).workArea
    window.setBounds(getExpandedBounds(workArea, PANEL_WIDTH), false)
  }

  scheduleCollapse(): void {
    this.cancelCollapse()
    if (this.autoHideSuspended) return
    const delay = this.visibility.collapseDelay(Date.now(), COLLAPSE_DELAY)
    if (delay === null) return
    this.collapseTimer = setTimeout(() => {
      const window = this.window
      if (!window || this.autoHideSuspended) return
      if (!this.visibility.markCollapsed()) return
      const workArea = screen.getDisplayMatching(window.getBounds()).workArea
      window.setBounds(
        getCollapsedBounds(workArea, PANEL_WIDTH, HOT_EDGE_WIDTH),
        false
      )
    }, delay)
  }

  cancelCollapse(): void {
    if (this.collapseTimer) clearTimeout(this.collapseTimer)
    this.collapseTimer = null
  }

  suspendAutoHide(suspended: boolean): void {
    this.autoHideSuspended = suspended
    this.visibility.setSuspended(suspended)
    if (suspended) this.cancelCollapse()
  }

  setAlwaysOnTop(value: boolean): void {
    this.window?.setAlwaysOnTop(value)
  }

  sendOpenEditor(type: 'note' | 'todo'): void {
    this.show()
    this.window?.webContents.send('app:open-editor', type)
  }

  sendOpenItem(itemId: string): void {
    this.show()
    this.window?.webContents.send('app:open-item', itemId)
  }

  quit(): void {
    if (!this.lifecycle.beginShutdown()) return
    this.cancelCollapse()
  }
}
