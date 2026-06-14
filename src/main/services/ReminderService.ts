import type { StickyItem, StickyItemPatch } from '../../shared/models'

interface ReminderStore {
  list(): Promise<StickyItem[]>
  update(id: string, patch: StickyItemPatch): Promise<unknown>
}

export class ReminderService {
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly store: ReminderStore,
    private readonly notify: (title: string, body: string) => void,
    private readonly now: () => Date = () => new Date()
  ) {}

  async check(): Promise<void> {
    const now = this.now().getTime()
    const items = await this.store.list()
    const due = items.filter(
      (item) =>
        item.type === 'todo' &&
        !item.completed &&
        !item.reminded &&
        item.remindAt !== null &&
        new Date(item.remindAt).getTime() <= now
    )

    for (const item of due) {
      this.notify(item.title || '待办提醒', '待办提醒')
      await this.store.update(item.id, { reminded: true })
    }
  }

  start(intervalMs = 30_000): void {
    void this.check()
    this.timer = setInterval(() => void this.check(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

