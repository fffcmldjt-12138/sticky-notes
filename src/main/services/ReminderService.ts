import type { StickyItem, TodoItem, TodoTaskPatch } from '../../shared/models'

interface ReminderStore {
  list(): Promise<StickyItem[]>
  updateTodoTask(
    todoId: string,
    taskId: string,
    patch: TodoTaskPatch
  ): Promise<TodoItem | null>
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

    for (const item of items) {
      if (item.type !== 'todo') continue
      for (const task of item.tasks) {
        if (
          task.completed ||
          task.reminded ||
          task.remindAt === null ||
          new Date(task.remindAt).getTime() > now
        ) {
          continue
        }
        this.notify(task.contentMarkdown || item.title || '待办提醒', '待办提醒')
        await this.store.updateTodoTask(item.id, task.id, { reminded: true })
      }
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
