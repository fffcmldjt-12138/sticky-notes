import type { BrowserWindowConstructorOptions, Rectangle } from 'electron'
import type { DragPreviewPayload } from '../../shared/electronApi'

interface PreviewWindow {
  loadURL(url: string): Promise<void> | void
  setBounds(bounds: Rectangle): void
  setIgnoreMouseEvents(ignore: boolean): void
  setAlwaysOnTop?(flag: boolean, level?: string): void
  showInactive(): void
  close(): void
  isDestroyed(): boolean
}

interface PreviewWindowFactory {
  create(options: BrowserWindowConstructorOptions): PreviewWindow
}

type CursorPoint = { x: number; y: number }
type TimerHandle = NodeJS.Timeout | number
const FOLLOW_INTERVAL_MS = 33

export class DragPreviewWindowService {
  private window: PreviewWindow | null = null
  private timer: TimerHandle | null = null
  private lastBounds: Rectangle | null = null

  constructor(
    private readonly factory: PreviewWindowFactory,
    private readonly getCursorPoint: () => CursorPoint,
    private readonly startTimer: (
      callback: () => void,
      intervalMs: number
    ) => TimerHandle = setInterval,
    private readonly stopTimer: (timer: TimerHandle) => void =
      (timer) => clearInterval(timer as NodeJS.Timeout)
  ) {}

  start(payload: DragPreviewPayload): void {
    this.stop()
    const size = previewSize(payload)
    this.window = this.factory.create({
      width: size.width,
      height: size.height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      hasShadow: false,
      paintWhenInitiallyHidden: true,
      backgroundColor: '#00000000',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    this.window.setIgnoreMouseEvents(true)
    this.window.setAlwaysOnTop?.(true, 'screen-saver')
    const activeWindow = this.window
    const loaded = Promise.resolve(activeWindow.loadURL(renderPreviewUrl(payload)))
    this.move()
    this.timer = this.startTimer(() => this.move(), FOLLOW_INTERVAL_MS)
    void loaded.then(() => {
      if (this.window === activeWindow && !activeWindow.isDestroyed()) {
        this.move()
        activeWindow.showInactive()
      }
    })
  }

  stop(): void {
    if (this.timer) {
      this.stopTimer(this.timer)
      this.timer = null
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.close()
    }
    this.window = null
    this.lastBounds = null
  }

  private move(): void {
    if (!this.window || this.window.isDestroyed()) return
    const point = this.getCursorPoint()
    const nextBounds = {
      x: point.x + 16,
      y: point.y + 16,
      ...this.windowBounds()
    }
    if (this.sameBounds(nextBounds, this.lastBounds)) return
    this.lastBounds = nextBounds
    this.window.setBounds(nextBounds)
  }

  private windowBounds(): Pick<Rectangle, 'width' | 'height'> {
    return { width: 260, height: 112 }
  }

  private sameBounds(a: Rectangle, b: Rectangle | null): boolean {
    return Boolean(
      b &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height
    )
  }
}

function previewSize(_payload: DragPreviewPayload): Pick<Rectangle, 'width' | 'height'> {
  return { width: 260, height: 112 }
}

function renderPreviewUrl(payload: DragPreviewPayload): string {
  const safeTitle = escapeHtml(payload.title || '无标题')
  const badge = payload.kind === 'folder'
    ? '文件夹'
    : payload.itemType === 'todo'
      ? '待办'
      : '笔记'
  const headerColor = payload.headerColor ?? '#e6eaf0'
  const dark = payload.bodyTheme === 'dark'
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
html,body{margin:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;overflow:hidden}
.preview{box-sizing:border-box;width:260px;height:112px;border:1px solid rgba(31,38,51,.18);border-radius:16px;overflow:hidden;background:${dark ? '#20252d' : '#fff'};color:${dark ? '#edf0f5' : '#303744'};box-shadow:0 18px 46px rgba(24,31,43,.28);opacity:.96}
.header{height:48px;padding:0 13px;display:flex;align-items:center;gap:8px;background:${headerColor}}
.grip{font-size:18px;color:rgba(31,38,51,.58)}
.badge{padding:3px 7px;border-radius:7px;background:rgba(255,255,255,.52);font-size:11px;font-weight:800}
.title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:800}
.body{padding:12px 14px;color:${dark ? '#aeb7c4' : '#6f7885'};font-size:12px}
</style>
</head>
<body>
  <div class="preview">
    <div class="header"><span class="grip">⠿</span><span class="badge">${badge}</span><span class="title">${safeTitle}</span></div>
    <div class="body">松开后拖出为小窗</div>
  </div>
</body>
</html>`
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
