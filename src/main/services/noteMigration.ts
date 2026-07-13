import { randomUUID } from 'node:crypto'
import type {
  BodyTheme,
  DeadlineReminder,
  HeaderColor,
  NotesFile,
  StickyItem,
  TaskReminder,
  TodoSchedule
} from '../../shared/models'

const DEFAULT_HEADER_COLOR: HeaderColor = '#f2c94c'
const legacyColors: Record<string, HeaderColor> = {
  yellow: '#f2c94c',
  blue: '#5b8def',
  green: '#55b985',
  pink: '#e783a8'
}

function normalizeColor(value: unknown): HeaderColor {
  if (typeof value !== 'string') return DEFAULT_HEADER_COLOR
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase() as HeaderColor
  return legacyColors[value] ?? DEFAULT_HEADER_COLOR
}

function normalizeBodyTheme(value: unknown): BodyTheme {
  return value === 'dark' ? 'dark' : 'light'
}

export function migrateNotesFile(value: unknown): NotesFile {
  if (!value || typeof value !== 'object') throw new Error('Invalid notes file')
  const source = value as { version?: number; items?: unknown[]; folders?: unknown[] }
  if (source.version === 4) return normalizeVersion4(source)
  if (source.version === 3) return migrateVersion3(source)
  if (source.version === 2) return migrateVersion2(source)
  if (source.version !== 1) throw new Error(`Unsupported notes version: ${source.version}`)

  return {
    version: 4,
    folders: [],
    items: (source.items ?? []).map(migrateVersion1Item)
  }
}

function organizationFields(index: number) {
  return {
    parentFolderId: null,
    tags: [],
    order: index,
    deletedAt: null
  }
}

function migrateVersion1Item(value: unknown, index: number): StickyItem {
  const item = value as Record<string, unknown>
  const base = {
    id: String(item.id),
    title: String(item.title ?? ''),
    headerColor: normalizeColor(item.headerColor),
    bodyTheme: normalizeBodyTheme(item.bodyTheme),
    pinned: Boolean(item.pinned),
    detached: false,
    windowBounds: null,
    ...organizationFields(index),
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt)
  }

  if (item.type === 'todo') {
    const contentMarkdown = String(item.contentMarkdown ?? '')
    return {
      ...base,
      type: 'todo',
      panelExpanded: false,
      tasks: contentMarkdown || item.remindAt
        ? [{
            id: `task_${randomUUID()}`,
            contentMarkdown,
            completed: Boolean(item.completed),
            tags: [],
            importance: 'normal',
            urgency: 'normal',
            children: [],
            schedule: legacySchedule({
              remindAt: typeof item.remindAt === 'string' ? item.remindAt : null,
              reminded: Boolean(item.reminded)
            })
          }]
        : []
    }
  }

  return {
    ...base,
    type: 'note',
    contentMarkdown: String(item.contentMarkdown ?? ''),
    syncedToSiyuan: false
  }
}

function migrateVersion2(source: { items?: unknown[] }): NotesFile {
  return {
    version: 4,
    folders: [],
    items: (source.items ?? []).map((value, index) => {
      const item = value as StickyItem
      const normalized = {
        ...item,
        headerColor: normalizeColor(item.headerColor),
        bodyTheme: normalizeBodyTheme(item.bodyTheme),
        detached: Boolean(item.detached),
        windowBounds: item.windowBounds ?? null,
        ...organizationFields(index)
      }
      return normalizeTodoTasks(normalized)
    })
  }
}

function migrateVersion3(
  source: { items?: unknown[]; folders?: unknown[] }
): NotesFile {
  return normalizeVersion4(source)
}

function normalizeVersion4(
  source: { items?: unknown[]; folders?: unknown[] }
): NotesFile {
  return {
    version: 4,
    folders: (source.folders ?? []).map((value, index) => {
      const folder = value as NotesFile['folders'][number]
      return {
        ...folder,
        parentFolderId: folder.parentFolderId ?? null,
        order: Number.isFinite(folder.order) ? folder.order : index,
        collapsed: Boolean(folder.collapsed),
        detached: Boolean(folder.detached),
        windowBounds: folder.windowBounds ?? null,
        deletedAt: folder.deletedAt ?? null
      }
    }),
    items: (source.items ?? []).map((value, index) => {
      const item = value as StickyItem
      const normalized = {
        ...item,
        headerColor: normalizeColor(item.headerColor),
        bodyTheme: normalizeBodyTheme(item.bodyTheme),
        detached: Boolean(item.detached),
        windowBounds: item.windowBounds ?? null,
        parentFolderId: item.parentFolderId ?? null,
        tags: Array.isArray(item.tags) ? item.tags : [],
        order: Number.isFinite(item.order) ? item.order : index,
        deletedAt: item.deletedAt ?? null
      }
      return normalizeTodoTasks(normalized)
    })
  }
}

function normalizeTodoTasks(item: StickyItem): StickyItem {
  if (item.type !== 'todo') return item
  return {
    ...item,
    panelExpanded: Boolean(item.panelExpanded),
    tasks: item.tasks.map((task) => ({
      id: task.id,
      contentMarkdown: task.contentMarkdown,
      completed: Boolean(task.completed),
      tags: Array.isArray(task.tags) ? task.tags : [],
      importance: task.importance === 'important' ? 'important' : 'normal',
      urgency: task.urgency === 'urgent' ? 'urgent' : 'normal',
      children: Array.isArray(task.children)
        ? task.children.map((child) => ({
            id: child.id,
            contentMarkdown: child.contentMarkdown,
            completed: Boolean(child.completed),
            tags: Array.isArray(child.tags) ? child.tags : [],
            importance:
              child.importance === 'important' ? 'important' : 'normal',
            urgency: child.urgency === 'urgent' ? 'urgent' : 'normal',
            schedule: normalizeSchedule(child.schedule)
          }))
        : [],
      schedule:
        normalizeSchedule(task.schedule) ??
        legacySchedule({
          remindAt: task.remindAt,
          reminded: task.reminded,
          deadlineAt: task.deadlineAt,
          deadlineReminders: task.deadlineReminders
        })
    }))
  }
}

function normalizeSchedule(value: unknown): TodoSchedule | null {
  if (!value || typeof value !== 'object') return null
  const schedule = value as Partial<TodoSchedule>
  if (typeof schedule.startAt !== 'string') return null
  return {
    mode: schedule.mode === 'range' ? 'range' : 'point',
    startAt: schedule.startAt,
    endAt:
      schedule.mode === 'range' && typeof schedule.endAt === 'string'
        ? schedule.endAt
        : null,
    repeat:
      schedule.repeat === 'daily' ||
      schedule.repeat === 'weekly' ||
      schedule.repeat === 'weekdays'
        ? schedule.repeat
        : 'none',
    reminders: Array.isArray(schedule.reminders)
      ? schedule.reminders.map(normalizeReminder)
      : []
  }
}

function normalizeReminder(value: unknown): TaskReminder {
  const reminder = value as Partial<TaskReminder>
  return {
    id: typeof reminder.id === 'string' ? reminder.id : `reminder_${randomUUID()}`,
    offsetMinutes: Number.isFinite(reminder.offsetMinutes)
      ? Number(reminder.offsetMinutes)
      : 0,
    remindedAt:
      typeof reminder.remindedAt === 'string' ? reminder.remindedAt : null,
    snoozedUntil:
      typeof reminder.snoozedUntil === 'string' ? reminder.snoozedUntil : null
  }
}

function legacySchedule({
  remindAt,
  reminded,
  deadlineAt,
  deadlineReminders
}: {
  remindAt?: string | null
  reminded?: boolean
  deadlineAt?: string | null
  deadlineReminders?: DeadlineReminder[]
}): TodoSchedule | null {
  if (deadlineAt) {
    return {
      mode: 'point',
      startAt: deadlineAt,
      endAt: null,
      repeat: 'none',
      reminders: Array.isArray(deadlineReminders)
        ? deadlineReminders.map(normalizeReminder)
        : []
    }
  }
  if (!remindAt) return null
  return {
    mode: 'point',
    startAt: remindAt,
    endAt: null,
    repeat: 'none',
    reminders: [{
      id: `reminder_${randomUUID()}`,
      offsetMinutes: 0,
      remindedAt: reminded ? remindAt : null
    }]
  }
}
