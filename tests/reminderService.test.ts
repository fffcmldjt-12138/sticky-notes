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
      reminded: false
    }
  ],
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
})
