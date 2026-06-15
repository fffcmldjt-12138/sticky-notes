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
    const current = this.now()
    const now = current.getTime()
    const nowIso = current.toISOString()
    const items = await this.store.list()

    for (const item of items) {
      if (item.type !== 'todo') continue
      for (const task of item.tasks) {
        if (task.completed) continue

        const patch: TodoTaskPatch = {}
        if (
          !task.reminded &&
          task.remindAt !== null &&
          new Date(task.remindAt).getTime() <= now
        ) {
          this.notify(task.contentMarkdown || item.title || '待办提醒', '待办提醒')
          patch.reminded = true
        }

        if (task.deadlineAt) {
          const deadline = new Date(task.deadlineAt).getTime()
          let changed = false
          const deadlineReminders = task.deadlineReminders.map((reminder) => {
            const triggerAt = deadline - reminder.offsetMinutes * 60_000
            if (reminder.remindedAt || triggerAt > now) return reminder
            changed = true
            this.notify(
              task.contentMarkdown || item.title || '待办提醒',
              deadline <= now
                ? 'DDL 已到期'
                : `DDL 提醒：距离截止还有 ${formatOffset(reminder.offsetMinutes)}`
            )
            return { ...reminder, remindedAt: nowIso }
          })
          if (changed) patch.deadlineReminders = deadlineReminders
        }

        if (Object.keys(patch).length) {
          await this.store.updateTodoTask(item.id, task.id, patch)
        }
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

function formatOffset(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} 天`
  if (minutes % 60 === 0) return `${minutes / 60} 小时`
  return `${minutes} 分钟`
}
