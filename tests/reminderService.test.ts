import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { ReminderService } from '../src/main/services/ReminderService'

const dueTodo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: 'Submit assignment',
  contentMarkdown: '',
  headerColor: 'blue',
  bodyTheme: 'light',
  pinned: false,
  completed: false,
  remindAt: '2026-06-14T10:00:00.000Z',
  reminded: false,
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

describe('ReminderService', () => {
  it('notifies and marks an overdue incomplete Todo once', async () => {
    const list = vi.fn().mockResolvedValue([dueTodo])
    const update = vi.fn().mockResolvedValue(undefined)
    const notify = vi.fn()
    const service = new ReminderService(
      { list, update },
      notify,
      () => new Date('2026-06-14T10:01:00.000Z')
    )

    await service.check()

    expect(notify).toHaveBeenCalledWith('Submit assignment', '待办提醒')
    expect(update).toHaveBeenCalledWith('todo_1', { reminded: true })
  })
})
