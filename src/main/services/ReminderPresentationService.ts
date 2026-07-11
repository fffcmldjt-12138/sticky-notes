import type { ReminderAlertPayload } from '../../shared/electronApi'
import type { ReminderPayload } from './ReminderService'

interface ReminderNotification {
  on(event: 'click', listener: () => void): void
  show(): void
}

interface ReminderWindowController {
  show(): void
  sendOpenItem(itemId: string): void
}

type NotificationFactory = (title: string, body: string) => ReminderNotification

export class ReminderPresentationService {
  constructor(
    private readonly createNotification: NotificationFactory,
    private readonly windows: ReminderWindowController,
    private readonly broadcast: (payload: ReminderAlertPayload) => void,
    private readonly now: () => Date = () => new Date()
  ) {}

  present(title: string, body: string, payload: ReminderPayload): void {
    const alert = {
      ...payload,
      title,
      body,
      createdAt: this.now().toISOString()
    }
    const notification = this.createNotification(title, body)
    notification.on('click', () => this.windows.sendOpenItem(payload.itemId))
    this.windows.show()
    this.broadcast(alert)
    notification.show()
  }
}
