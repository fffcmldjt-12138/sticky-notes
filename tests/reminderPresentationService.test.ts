import { describe, expect, it, vi } from 'vitest'
import { ReminderPresentationService } from '../src/main/services/ReminderPresentationService'

describe('ReminderPresentationService', () => {
  it('shows the hidden panel and opens the todo when the notification is clicked', () => {
    let click: (() => void) | undefined
    const notification = {
      on: vi.fn((_event: 'click', listener: () => void) => {
        click = listener
      }),
      show: vi.fn()
    }
    const windows = {
      show: vi.fn(),
      sendOpenItem: vi.fn()
    }
    const broadcast = vi.fn()
    const service = new ReminderPresentationService(
      () => notification,
      windows,
      broadcast,
      () => new Date('2026-07-12T08:00:00.000Z')
    )

    service.present('提交作业', '截止时间已到', {
      itemId: 'todo_1',
      taskId: 'task_1'
    })

    expect(windows.show).toHaveBeenCalledOnce()
    expect(notification.show).toHaveBeenCalledOnce()
    expect(broadcast).toHaveBeenCalledWith({
      itemId: 'todo_1',
      taskId: 'task_1',
      title: '提交作业',
      body: '截止时间已到',
      createdAt: '2026-07-12T08:00:00.000Z'
    })

    click?.()
    expect(windows.sendOpenItem).toHaveBeenCalledWith('todo_1')
  })
})
