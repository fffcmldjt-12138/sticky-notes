import type { TodoSchedule } from './models'

export function getScheduleDueAt(schedule: TodoSchedule): string {
  return schedule.mode === 'range' && schedule.endAt
    ? schedule.endAt
    : schedule.startAt
}
