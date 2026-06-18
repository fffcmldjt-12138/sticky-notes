import type { TodoSchedule } from '../../shared/models'
export { getScheduleDueAt } from '../../shared/taskSchedule'

export function advanceRecurringSchedule(
  schedule: TodoSchedule
): TodoSchedule | null {
  if (schedule.repeat === 'none') return null

  const start = new Date(schedule.startAt)
  const end = schedule.endAt ? new Date(schedule.endAt) : null
  advanceDate(start, schedule.repeat)
  if (end) advanceDate(end, schedule.repeat)

  return {
    ...schedule,
    startAt: start.toISOString(),
    endAt: end?.toISOString() ?? null,
    reminders: schedule.reminders.map((reminder) => ({
      ...reminder,
      remindedAt: null
    }))
  }
}

function advanceDate(
  date: Date,
  repeat: Exclude<TodoSchedule['repeat'], 'none'>
): void {
  if (repeat === 'weekly') {
    date.setDate(date.getDate() + 7)
    return
  }

  date.setDate(date.getDate() + 1)
  if (repeat === 'weekdays') {
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1)
    }
  }
}
