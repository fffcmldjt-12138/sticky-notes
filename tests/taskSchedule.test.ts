import { describe, expect, it } from 'vitest'
import type { TodoSchedule } from '../src/shared/models'
import {
  advanceRecurringSchedule,
  getScheduleDueAt
} from '../src/main/services/taskSchedule'

function schedule(
  repeat: TodoSchedule['repeat'],
  startAt: string,
  endAt: string | null = null
): TodoSchedule {
  return {
    mode: endAt ? 'range' : 'point',
    startAt,
    endAt,
    repeat,
    reminders: [{
      id: 'at-time',
      offsetMinutes: 0,
      remindedAt: '2026-06-18T00:00:00.000Z'
    }]
  }
}

describe('task schedules', () => {
  it('uses the range end as the effective due time', () => {
    expect(getScheduleDueAt(schedule(
      'none',
      '2026-06-18T01:00:00.000Z',
      '2026-06-18T09:00:00.000Z'
    ))).toBe('2026-06-18T09:00:00.000Z')
  })

  it('advances daily ranges and preserves their duration', () => {
    const next = advanceRecurringSchedule(schedule(
      'daily',
      '2026-06-18T01:00:00.000Z',
      '2026-06-18T09:00:00.000Z'
    ))

    expect(next?.startAt).toBe('2026-06-19T01:00:00.000Z')
    expect(next?.endAt).toBe('2026-06-19T09:00:00.000Z')
    expect(next?.reminders[0].remindedAt).toBeNull()
  })

  it('advances weekly schedules by seven days', () => {
    expect(advanceRecurringSchedule(
      schedule('weekly', '2026-06-18T09:00:00.000Z')
    )?.startAt).toBe('2026-06-25T09:00:00.000Z')
  })

  it('skips weekends for weekday recurrence', () => {
    expect(advanceRecurringSchedule(
      schedule('weekdays', '2026-06-19T09:00:00.000Z')
    )?.startAt).toBe('2026-06-22T09:00:00.000Z')
  })

  it('does not advance non-recurring schedules', () => {
    expect(advanceRecurringSchedule(
      schedule('none', '2026-06-18T09:00:00.000Z')
    )).toBeNull()
  })
})
