import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { ReminderService } from '../src/main/services/ReminderService'

const dueTodo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: 'Submit assignment',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  tasks: [
    {
      id: 'task_1',
      contentMarkdown: 'Submit assignment',
      completed: false,
      remindAt: '2026-06-14T10:00:00.000Z',
    reminded: false,
    tags: [],
    importance: 'normal',
    urgency: 'normal',
    children: [],
    schedule: null,
    deadlineAt: null,
      deadlineReminders: []
    }
  ],
  panelExpanded: false,
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

describe('ReminderService', () => {
  it('notifies and marks an overdue incomplete Todo once', async () => {
    const list = vi.fn().mockResolvedValue([dueTodo])
    const updateTodoTask = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const service = new ReminderService(
      { list, updateTodoTask },
      notify,
      () => new Date('2026-06-14T10:01:00.000Z')
    )

    await service.check()

    expect(notify).toHaveBeenCalledWith('Submit assignment', '待办提醒')
    expect(updateTodoTask).toHaveBeenCalledWith('todo_1', 'task_1', { reminded: true })
  })

  it('delivers each selected deadline reminder independently', async () => {
    const deadlineTodo: TodoItem = {
      ...dueTodo,
      tasks: [{
        ...dueTodo.tasks[0],
        remindAt: null,
        deadlineAt: '2026-06-20T12:00:00.000Z',
        deadlineReminders: [
          {
            id: 'three-days',
            offsetMinutes: 4320,
            remindedAt: '2026-06-17T12:00:00.000Z'
          },
          { id: 'one-day', offsetMinutes: 1440, remindedAt: null },
          { id: 'six-hours', offsetMinutes: 360, remindedAt: null }
        ]
      }]
    }
    const updateTodoTask = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const service = new ReminderService(
      {
        list: vi.fn().mockResolvedValue([deadlineTodo]),
        updateTodoTask
      },
      notify,
      () => new Date('2026-06-19T12:00:00.000Z')
    )

    await service.check()

    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith(
      'Submit assignment',
      'DDL 提醒：距离截止还有 1 天'
    )
    expect(updateTodoTask).toHaveBeenCalledWith('todo_1', 'task_1', {
      deadlineReminders: [
        deadlineTodo.tasks[0].deadlineReminders![0],
        {
          id: 'one-day',
          offsetMinutes: 1440,
          remindedAt: '2026-06-19T12:00:00.000Z'
        },
        deadlineTodo.tasks[0].deadlineReminders![2]
      ]
    })
  })

  it('does not deliver deadline reminders for completed tasks', async () => {
    const notify = vi.fn()
    const updateTodoTask = vi.fn()
    const service = new ReminderService(
      {
        list: vi.fn().mockResolvedValue([{
          ...dueTodo,
          tasks: [{
            ...dueTodo.tasks[0],
            completed: true,
            deadlineAt: '2026-06-20T12:00:00.000Z',
            deadlineReminders: [
              { id: 'one-day', offsetMinutes: 1440, remindedAt: null }
            ]
          }]
        }]),
        updateTodoTask
      },
      notify,
      () => new Date('2026-06-19T12:00:00.000Z')
    )

    await service.check()

    expect(notify).not.toHaveBeenCalled()
    expect(updateTodoTask).not.toHaveBeenCalled()
  })
})
