import { describe, expect, it, vi } from 'vitest'
import type { ReminderAlertPayload } from '../src/shared/electronApi'
import {
  ReminderWindowService,
  type ReminderWindowHandle
} from '../src/main/services/ReminderWindowService'

function alert(id: string): ReminderAlertPayload {
  return {
    itemId: `todo_${id}`,
    taskId: `task_${id}`,
    reminderId: `reminder_${id}`,
    title: `Task ${id}`,
    body: '截止时间已到',
    createdAt: '2026-07-13T10:00:00.000Z'
  }
}

function fakeWindow(): ReminderWindowHandle & { emitClosed(): void } {
  let closed: (() => void) | undefined
  return {
    show: vi.fn(),
    focus: vi.fn(),
    flashFrame: vi.fn(),
    close: vi.fn(() => closed?.()),
    isDestroyed: vi.fn().mockReturnValue(false),
    on: vi.fn((_event, listener) => {
      closed = listener
    }),
    emitClosed: () => closed?.()
  }
}

describe('ReminderWindowService', () => {
  it('queues reminders and presents one strong window at a time', async () => {
    const firstWindow = fakeWindow()
    const secondWindow = fakeWindow()
    const create = vi.fn()
      .mockReturnValueOnce(firstWindow)
      .mockReturnValueOnce(secondWindow)
    const service = new ReminderWindowService({ create }, vi.fn())

    service.enqueue(alert('1'))
    service.enqueue(alert('2'))
    expect(create).toHaveBeenCalledTimes(1)
    expect(firstWindow.show).toHaveBeenCalledOnce()
    expect(firstWindow.flashFrame).toHaveBeenCalledWith(true)

    await service.respond({ type: 'acknowledge' })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenLastCalledWith(alert('2'))
  })

  it.each([5, 10, 30] as const)('persists a %s minute snooze action', async (minutes) => {
    const window = fakeWindow()
    const onAction = vi.fn()
    const service = new ReminderWindowService(
      { create: vi.fn().mockReturnValue(window) },
      onAction
    )
    const payload = alert('1')
    service.enqueue(payload)

    await service.respond({ type: 'snooze', minutes })

    expect(onAction).toHaveBeenCalledWith(payload, { type: 'snooze', minutes })
    expect(window.close).toHaveBeenCalledOnce()
  })

  it('opens the related todo before dismissing the reminder', async () => {
    const window = fakeWindow()
    const onAction = vi.fn()
    const service = new ReminderWindowService(
      { create: vi.fn().mockReturnValue(window) },
      onAction
    )
    const payload = alert('1')
    service.enqueue(payload)

    await service.respond({ type: 'open' })

    expect(onAction).toHaveBeenCalledWith(payload, { type: 'open' })
  })
})
