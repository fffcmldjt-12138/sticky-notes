import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { ReminderService } from '../src/main/services/ReminderService'

const todo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: '作业',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  tasks: [{
    id: 'task_1',
    contentMarkdown: '提交作业',
    completed: false,
    tags: [],
    importance: 'important',
    urgency: 'urgent',
    children: [],
    schedule: {
      mode: 'point',
      startAt: '2026-06-20T12:00:00.000Z',
      endAt: null,
      repeat: 'none',
      reminders: [
        { id: 'one-day', offsetMinutes: 1440, remindedAt: null }
      ]
    }
  }],
  panelExpanded: false,
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

describe('ReminderService', () => {
  it('coalesces overlapping checks into one store scan', async () => {
    let release!: (items: TodoItem[]) => void
    const pendingItems = new Promise<TodoItem[]>((resolve) => {
      release = resolve
    })
    const list = vi.fn().mockReturnValue(pendingItems)
    const service = new ReminderService(
      {
        list,
        updateTodoTask: vi.fn(),
        updateTodoSubtask: vi.fn()
      },
      vi.fn()
    )

    const first = service.check()
    const second = service.check()
    expect(list).toHaveBeenCalledTimes(1)

    release([])
    await Promise.all([first, second])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('delivers each selected schedule reminder once', async () => {
    const updateTodoTask = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const service = new ReminderService(
      {
        list: vi.fn().mockResolvedValue([todo]),
        updateTodoTask,
        updateTodoSubtask: vi.fn()
      },
      notify,
      () => new Date('2026-06-19T12:00:00.000Z')
    )

    await service.check()

    expect(notify).toHaveBeenCalledWith(
      '提交作业',
      '强提醒：距离截止还有 1 天',
      { itemId: 'todo_1', taskId: 'task_1', reminderId: 'one-day' }
    )
    expect(updateTodoTask).toHaveBeenCalledWith('todo_1', 'task_1', {
      schedule: {
        ...todo.tasks[0].schedule,
        reminders: [{
          id: 'one-day',
          offsetMinutes: 1440,
          remindedAt: '2026-06-19T12:00:00.000Z',
          snoozedUntil: null
        }]
      }
    })
  })

  it('advances a completed recurring task and resets completion', async () => {
    const recurring = {
      ...todo,
      tasks: [{
        ...todo.tasks[0],
        completed: true,
        schedule: {
          ...todo.tasks[0].schedule!,
          repeat: 'daily' as const,
          reminders: [{
            id: 'at-time',
            offsetMinutes: 0,
            remindedAt: '2026-06-20T12:00:00.000Z'
          }]
        }
      }]
    }
    const updateTodoTask = vi.fn().mockResolvedValue(undefined)
    const service = new ReminderService(
      {
        list: vi.fn().mockResolvedValue([recurring]),
        updateTodoTask,
        updateTodoSubtask: vi.fn()
      },
      vi.fn(),
      () => new Date('2026-06-20T12:01:00.000Z')
    )

    await service.check()

    expect(updateTodoTask).toHaveBeenCalledWith('todo_1', 'task_1', {
      completed: false,
      schedule: expect.objectContaining({
        startAt: '2026-06-21T12:00:00.000Z',
        reminders: [expect.objectContaining({ remindedAt: null })]
      })
    })
  })

  it('delivers reminders for incomplete subtasks', async () => {
    const withChild: TodoItem = {
      ...todo,
      tasks: [{
        ...todo.tasks[0],
        schedule: null,
        children: [{
          id: 'subtask_1',
          contentMarkdown: '上传附件',
          completed: false,
          tags: [],
          importance: 'normal',
          urgency: 'urgent',
          schedule: {
            mode: 'point',
            startAt: '2026-06-19T12:00:00.000Z',
            endAt: null,
            repeat: 'none',
            reminders: [{
              id: 'at-time',
              offsetMinutes: 0,
              remindedAt: null
            }]
          }
        }]
      }]
    }
    const updateTodoSubtask = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const service = new ReminderService(
      {
        list: vi.fn().mockResolvedValue([withChild]),
        updateTodoTask: vi.fn(),
        updateTodoSubtask
      },
      notify,
      () => new Date('2026-06-19T12:00:00.000Z')
    )

    await service.check()

    expect(notify).toHaveBeenCalledWith(
      '上传附件',
      '强提醒：截止时间已到',
      {
        itemId: 'todo_1',
        taskId: 'task_1',
        subtaskId: 'subtask_1',
        reminderId: 'at-time'
      }
    )
    expect(updateTodoSubtask).toHaveBeenCalledWith(
      'todo_1',
      'task_1',
      'subtask_1',
      { schedule: expect.any(Object) }
    )
  })

  it('delivers a persisted snooze only when its absolute time arrives', async () => {
    const snoozed: TodoItem = {
      ...todo,
      tasks: [{
        ...todo.tasks[0],
        schedule: {
          ...todo.tasks[0].schedule!,
          reminders: [{
            id: 'one-day',
            offsetMinutes: 1440,
            remindedAt: null,
            snoozedUntil: '2026-06-19T12:10:00.000Z'
          }]
        }
      }]
    }
    const notify = vi.fn()
    const updateTodoTask = vi.fn().mockResolvedValue(undefined)
    const store = {
      list: vi.fn().mockResolvedValue([snoozed]),
      updateTodoTask,
      updateTodoSubtask: vi.fn()
    }
    const early = new ReminderService(
      store,
      notify,
      () => new Date('2026-06-19T12:09:00.000Z')
    )
    await early.check()
    expect(notify).not.toHaveBeenCalled()

    const due = new ReminderService(
      store,
      notify,
      () => new Date('2026-06-19T12:10:00.000Z')
    )
    await due.check()
    expect(notify).toHaveBeenCalledWith(
      '提交作业',
      '强提醒：距离截止还有 1 天',
      { itemId: 'todo_1', taskId: 'task_1', reminderId: 'one-day' }
    )
    expect(updateTodoTask).toHaveBeenLastCalledWith(
      'todo_1',
      'task_1',
      {
        schedule: expect.objectContaining({
          reminders: [expect.objectContaining({
            remindedAt: '2026-06-19T12:10:00.000Z',
            snoozedUntil: null
          })]
        })
      }
    )
  })

  it('does not advance a recurring schedule while a snoozed reminder is pending', async () => {
    const snoozedRecurring: TodoItem = {
      ...todo,
      tasks: [{
        ...todo.tasks[0],
        schedule: {
          ...todo.tasks[0].schedule!,
          repeat: 'daily',
          reminders: [{
            id: 'at-time',
            offsetMinutes: 0,
            remindedAt: null,
            snoozedUntil: '2026-06-20T12:10:00.000Z'
          }]
        }
      }]
    }
    const notify = vi.fn()
    const updateTodoTask = vi.fn().mockResolvedValue(undefined)
    const service = new ReminderService(
      {
        list: vi.fn().mockResolvedValue([snoozedRecurring]),
        updateTodoTask,
        updateTodoSubtask: vi.fn()
      },
      notify,
      () => new Date('2026-06-20T12:05:00.000Z')
    )

    await service.check()

    expect(notify).not.toHaveBeenCalled()
    expect(updateTodoTask).not.toHaveBeenCalled()
  })
})
