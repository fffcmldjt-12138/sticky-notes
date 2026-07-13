import type {
  ReminderAlertPayload,
  ReminderWindowAction
} from '../../shared/electronApi'

export interface ReminderWindowHandle {
  show(): void
  focus(): void
  flashFrame(flag: boolean): void
  close(): void
  isDestroyed(): boolean
  on(event: 'closed', listener: () => void): void
}

interface ReminderWindowFactory {
  create(payload: ReminderAlertPayload): ReminderWindowHandle
}

type ReminderActionHandler = (
  payload: ReminderAlertPayload,
  action: ReminderWindowAction
) => void | Promise<void>

export class ReminderWindowService {
  private readonly queue: ReminderAlertPayload[] = []
  private active: {
    payload: ReminderAlertPayload
    window: ReminderWindowHandle
  } | null = null

  constructor(
    private readonly factory: ReminderWindowFactory,
    private readonly onAction: ReminderActionHandler
  ) {}

  enqueue(payload: ReminderAlertPayload): void {
    if (this.active) {
      this.queue.push(payload)
      return
    }
    this.present(payload)
  }

  async respond(action: ReminderWindowAction): Promise<void> {
    const current = this.active
    if (!current) return
    await this.onAction(current.payload, action)
    if (!current.window.isDestroyed()) {
      current.window.flashFrame(false)
      current.window.close()
    }
  }

  closeAll(): void {
    this.queue.length = 0
    const current = this.active
    this.active = null
    if (current && !current.window.isDestroyed()) current.window.close()
  }

  private present(payload: ReminderAlertPayload): void {
    const window = this.factory.create(payload)
    this.active = { payload, window }
    window.on('closed', () => {
      if (this.active?.window !== window) return
      this.active = null
      const next = this.queue.shift()
      if (next) this.present(next)
    })
    window.show()
    window.focus()
    window.flashFrame(true)
  }
}
