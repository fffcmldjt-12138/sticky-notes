import type {
  StickyItem,
  TodoItem,
  TodoSchedule,
  TodoSubtaskPatch,
  TodoTaskPatch
} from '../../shared/models'
import {
  advanceRecurringSchedulePast,
  getScheduleDueAt
} from './taskSchedule'

export interface ReminderPayload {
  itemId: string
  taskId: string
  subtaskId?: string
  reminderId: string
}

type ReminderTarget = Omit<ReminderPayload, 'reminderId'>

interface ReminderStore {
  list(): Promise<StickyItem[]>
  updateTodoTask(
    todoId: string,
    taskId: string,
    patch: TodoTaskPatch
  ): Promise<TodoItem | null>
  updateTodoSubtask(
    todoId: string,
    taskId: string,
    subtaskId: string,
    patch: TodoSubtaskPatch
  ): Promise<TodoItem | null>
}

type ReminderNotify = (
  title: string,
  body: string,
  payload: ReminderPayload
) => void

export class ReminderService {
  private timer: NodeJS.Timeout | null = null
  private checkInFlight: Promise<void> | null = null

  constructor(
    private readonly store: ReminderStore,
    private readonly notify: ReminderNotify,
    private readonly now: () => Date = () => new Date()
  ) {}

  check(): Promise<void> {
    if (this.checkInFlight) return this.checkInFlight
    const check = this.runCheck().finally(() => {
      if (this.checkInFlight === check) this.checkInFlight = null
    })
    this.checkInFlight = check
    return check
  }

  private async runCheck(): Promise<void> {
    const current = this.now()
    const items = await this.store.list()

    for (const item of items) {
      if (item.type !== 'todo') continue
      for (const task of item.tasks) {
        const taskPatch = processSchedule(
          task.contentMarkdown || item.title || '待办提醒',
          task.completed,
          task.schedule,
          current,
          this.notify,
          { itemId: item.id, taskId: task.id }
        )
        if (taskPatch) {
          await this.store.updateTodoTask(item.id, task.id, taskPatch)
        }

        for (const child of task.children) {
          const childPatch = processSchedule(
            child.contentMarkdown || task.contentMarkdown || item.title,
            child.completed,
            child.schedule,
            current,
            this.notify,
            { itemId: item.id, taskId: task.id, subtaskId: child.id }
          )
          if (childPatch) {
            await this.store.updateTodoSubtask(
              item.id,
              task.id,
              child.id,
              childPatch
            )
          }
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

function processSchedule(
  title: string,
  completed: boolean,
  schedule: TodoSchedule | null,
  current: Date,
  notify: ReminderNotify,
  payload: ReminderTarget
): TodoTaskPatch | TodoSubtaskPatch | null {
  if (!schedule) return null

  const now = current.getTime()
  const nowIso = current.toISOString()
  const dueAt = new Date(getScheduleDueAt(schedule)).getTime()
  let changed = false
  const reminders = schedule.reminders.map((reminder) => {
    const triggerAt = reminder.snoozedUntil
      ? new Date(reminder.snoozedUntil).getTime()
      : dueAt - reminder.offsetMinutes * 60_000
    if (completed || reminder.remindedAt || triggerAt > now) return reminder

    changed = true
    notify(
      title,
      dueAt <= now
        ? '强提醒：截止时间已到'
        : `强提醒：距离截止还有 ${formatOffset(reminder.offsetMinutes)}`,
      { ...payload, reminderId: reminder.id }
    )
    return { ...reminder, remindedAt: nowIso, snoozedUntil: null }
  })

  const hasPendingSnooze = reminders.some((reminder) =>
    !reminder.remindedAt &&
    Boolean(reminder.snoozedUntil) &&
    new Date(reminder.snoozedUntil!).getTime() > now
  )

  if (dueAt <= now && !hasPendingSnooze) {
    const next = advanceRecurringSchedulePast(
      { ...schedule, reminders },
      current
    )
    if (next) return { completed: false, schedule: next }
  }

  return changed ? { schedule: { ...schedule, reminders } } : null
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return '0 分钟'
  if (minutes % 1440 === 0) return `${minutes / 1440} 天`
  if (minutes % 60 === 0) return `${minutes / 60} 小时`
  return `${minutes} 分钟`
}
