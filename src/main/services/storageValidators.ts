import type {
  AppConfig,
  DeadlineReminder,
  FolderItem,
  NotesFile,
  StickyItem,
  TaskReminder,
  TodoSchedule,
  TodoSubtask,
  TodoTask,
  WindowBounds
} from '../../shared/models'
import { migrateNotesFile } from './noteMigration'

type JsonObject = Record<string, unknown>

export function validateNotesFile(value: unknown): NotesFile {
  const root = objectAt(value, 'notes')
  exactKeys(root, ['version', 'items', 'folders'], 'notes')
  if (root.version !== 5) fail('notes.version must be 5')
  const items = arrayAt(root.items, 'notes.items')
  const folders = arrayAt(root.folders, 'notes.folders')
  const ids = new Set<string>()

  const validatedFolders = folders.map((folder, index) =>
    validateFolder(folder, `notes.folders[${index}]`, ids)
  )
  const folderIds = new Set(validatedFolders.map((folder) => folder.id))
  const validatedItems = items.map((item, index) =>
    validateItem(item, `notes.items[${index}]`, ids)
  )

  for (const folder of validatedFolders) {
    validateFolderReference(folder.parentFolderId, folderIds, `folder ${folder.id}`)
  }
  for (const item of validatedItems) {
    validateFolderReference(item.parentFolderId, folderIds, `item ${item.id}`)
  }
  validateFolderCycles(validatedFolders)
  return value as NotesFile
}

export function migrateAndValidateRecoverableNotesFile(
  value: unknown
): NotesFile {
  const root = objectAt(value, 'notes recovery candidate')
  if (root.version === 5) return validateNotesFile(value)
  if (
    root.version === 1 ||
    root.version === 2 ||
    root.version === 3 ||
    root.version === 4
  ) {
    return validateNotesFile(migrateNotesFile(value))
  }
  fail(`notes recovery candidate version ${String(root.version)} is unsupported`)
}

export function validateAppConfig(value: unknown): AppConfig {
  const config = objectAt(value, 'config')
  exactKeys(
    config,
    [
      'version',
      'autoLaunch',
      'panelPosition',
      'alwaysOnTop',
      'recentHeaderColors'
    ],
    'config',
    ['recentHeaderColors']
  )
  if (config.version !== 1) fail('config.version must be 1')
  booleanAt(config.autoLaunch, 'config.autoLaunch')
  if (config.panelPosition !== 'right') {
    fail('config.panelPosition must be right')
  }
  booleanAt(config.alwaysOnTop, 'config.alwaysOnTop')
  if (config.recentHeaderColors !== undefined) {
    arrayAt(config.recentHeaderColors, 'config.recentHeaderColors').forEach(
      (color, index) => colorAt(color, `config.recentHeaderColors[${index}]`)
    )
  }
  return value as AppConfig
}

function validateFolder(
  value: unknown,
  path: string,
  ids: Set<string>
): FolderItem {
  const folder = objectAt(value, path)
  exactKeys(folder, [
    'id', 'revision', 'title', 'parentFolderId', 'order', 'collapsed',
    'detached', 'windowBounds', 'deletedAt', 'createdAt', 'updatedAt'
  ], path)
  const id = uniqueId(folder.id, `${path}.id`, ids)
  revisionAt(folder.revision, `${path}.revision`)
  stringAt(folder.title, `${path}.title`)
  nullableStringAt(folder.parentFolderId, `${path}.parentFolderId`)
  orderAt(folder.order, `${path}.order`)
  booleanAt(folder.collapsed, `${path}.collapsed`)
  booleanAt(folder.detached, `${path}.detached`)
  windowBoundsAt(folder.windowBounds, `${path}.windowBounds`)
  nullableDateAt(folder.deletedAt, `${path}.deletedAt`)
  dateAt(folder.createdAt, `${path}.createdAt`)
  dateAt(folder.updatedAt, `${path}.updatedAt`)
  return { ...folder, id } as unknown as FolderItem
}

function validateItem(
  value: unknown,
  path: string,
  ids: Set<string>
): StickyItem {
  const item = objectAt(value, path)
  const common = [
    'id', 'revision', 'type', 'title', 'headerColor', 'bodyTheme', 'pinned',
    'detached', 'windowBounds', 'parentFolderId', 'tags', 'order', 'deletedAt',
    'createdAt', 'updatedAt'
  ]
  const type = item.type
  if (type === 'note') {
    exactKeys(item, [...common, 'contentMarkdown', 'syncedToSiyuan'], path)
  } else if (type === 'todo') {
    exactKeys(item, [...common, 'tasks', 'panelExpanded'], path)
  } else {
    fail(`${path}.type must be note or todo`)
  }

  uniqueId(item.id, `${path}.id`, ids)
  revisionAt(item.revision, `${path}.revision`)
  stringAt(item.title, `${path}.title`)
  colorAt(item.headerColor, `${path}.headerColor`)
  enumAt(item.bodyTheme, ['light', 'dark'], `${path}.bodyTheme`)
  booleanAt(item.pinned, `${path}.pinned`)
  booleanAt(item.detached, `${path}.detached`)
  windowBoundsAt(item.windowBounds, `${path}.windowBounds`)
  nullableStringAt(item.parentFolderId, `${path}.parentFolderId`)
  stringArrayAt(item.tags, `${path}.tags`)
  orderAt(item.order, `${path}.order`)
  nullableDateAt(item.deletedAt, `${path}.deletedAt`)
  dateAt(item.createdAt, `${path}.createdAt`)
  dateAt(item.updatedAt, `${path}.updatedAt`)

  if (type === 'note') {
    stringAt(item.contentMarkdown, `${path}.contentMarkdown`)
    if (item.syncedToSiyuan !== false) {
      fail(`${path}.syncedToSiyuan must be false`)
    }
  } else {
    arrayAt(item.tasks, `${path}.tasks`).forEach((task, index) =>
      validateTask(task, `${path}.tasks[${index}]`, ids)
    )
    booleanAt(item.panelExpanded, `${path}.panelExpanded`)
  }
  return value as StickyItem
}

function validateTask(value: unknown, path: string, ids: Set<string>): TodoTask {
  const task = objectAt(value, path)
  exactKeys(
    task,
    [
      'id', 'contentMarkdown', 'completed', 'tags', 'importance', 'urgency',
      'children', 'schedule', 'remindAt', 'reminded', 'deadlineAt',
      'deadlineReminders'
    ],
    path,
    ['remindAt', 'reminded', 'deadlineAt', 'deadlineReminders']
  )
  uniqueId(task.id, `${path}.id`, ids)
  stringAt(task.contentMarkdown, `${path}.contentMarkdown`)
  booleanAt(task.completed, `${path}.completed`)
  stringArrayAt(task.tags, `${path}.tags`)
  enumAt(task.importance, ['important', 'normal'], `${path}.importance`)
  enumAt(task.urgency, ['urgent', 'normal'], `${path}.urgency`)
  arrayAt(task.children, `${path}.children`).forEach((child, index) =>
    validateSubtask(child, `${path}.children[${index}]`, ids)
  )
  scheduleAt(task.schedule, `${path}.schedule`)
  if (task.remindAt !== undefined) nullableDateAt(task.remindAt, `${path}.remindAt`)
  if (task.reminded !== undefined) booleanAt(task.reminded, `${path}.reminded`)
  if (task.deadlineAt !== undefined) nullableDateAt(task.deadlineAt, `${path}.deadlineAt`)
  if (task.deadlineReminders !== undefined) {
    const reminderIds = new Set<string>()
    arrayAt(task.deadlineReminders, `${path}.deadlineReminders`).forEach(
      (reminder, index) =>
        validateDeadlineReminder(
          reminder,
          `${path}.deadlineReminders[${index}]`,
          reminderIds
        )
    )
  }
  return value as TodoTask
}

function validateSubtask(
  value: unknown,
  path: string,
  ids: Set<string>
): TodoSubtask {
  const child = objectAt(value, path)
  exactKeys(child, [
    'id', 'contentMarkdown', 'completed', 'importance', 'urgency', 'tags',
    'schedule'
  ], path)
  uniqueId(child.id, `${path}.id`, ids)
  stringAt(child.contentMarkdown, `${path}.contentMarkdown`)
  booleanAt(child.completed, `${path}.completed`)
  enumAt(child.importance, ['important', 'normal'], `${path}.importance`)
  enumAt(child.urgency, ['urgent', 'normal'], `${path}.urgency`)
  stringArrayAt(child.tags, `${path}.tags`)
  scheduleAt(child.schedule, `${path}.schedule`)
  return value as TodoSubtask
}

function scheduleAt(
  value: unknown,
  path: string
): TodoSchedule | null {
  if (value === null) return null
  const schedule = objectAt(value, path)
  exactKeys(schedule, ['mode', 'startAt', 'endAt', 'reminders', 'repeat'], path)
  const mode = enumAt(schedule.mode, ['point', 'range'], `${path}.mode`)
  dateAt(schedule.startAt, `${path}.startAt`)
  if (mode === 'point') {
    if (schedule.endAt !== null) fail(`${path}.endAt must be null for point mode`)
  } else {
    dateAt(schedule.endAt, `${path}.endAt`)
    if (Date.parse(schedule.endAt as string) < Date.parse(schedule.startAt as string)) {
      fail(`${path}.endAt must not precede startAt`)
    }
  }
  enumAt(schedule.repeat, ['none', 'daily', 'weekly', 'weekdays'], `${path}.repeat`)
  const reminderIds = new Set<string>()
  arrayAt(schedule.reminders, `${path}.reminders`).forEach(
    (reminder, index) =>
      validateReminder(reminder, `${path}.reminders[${index}]`, reminderIds)
  )
  return value as TodoSchedule
}

function validateReminder(
  value: unknown,
  path: string,
  ids: Set<string>
): TaskReminder {
  const reminder = objectAt(value, path)
  exactKeys(
    reminder,
    ['id', 'offsetMinutes', 'remindedAt', 'snoozedUntil'],
    path,
    ['snoozedUntil']
  )
  uniqueId(reminder.id, `${path}.id`, ids)
  nonNegativeSafeIntegerAt(reminder.offsetMinutes, `${path}.offsetMinutes`)
  nullableDateAt(reminder.remindedAt, `${path}.remindedAt`)
  if (reminder.snoozedUntil !== undefined) {
    nullableDateAt(reminder.snoozedUntil, `${path}.snoozedUntil`)
  }
  return value as TaskReminder
}

function validateDeadlineReminder(
  value: unknown,
  path: string,
  ids: Set<string>
): DeadlineReminder {
  const reminder = objectAt(value, path)
  exactKeys(reminder, ['id', 'offsetMinutes', 'remindedAt'], path)
  uniqueId(reminder.id, `${path}.id`, ids)
  nonNegativeSafeIntegerAt(reminder.offsetMinutes, `${path}.offsetMinutes`)
  nullableDateAt(reminder.remindedAt, `${path}.remindedAt`)
  return value as DeadlineReminder
}

function validateFolderReference(
  id: string | null,
  folderIds: Set<string>,
  owner: string
): void {
  if (id !== null && !folderIds.has(id)) {
    fail(`${owner} references missing folder ${id}`)
  }
}

function validateFolderCycles(folders: FolderItem[]): void {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  for (const folder of folders) {
    const seen = new Set<string>()
    let current: FolderItem | undefined = folder
    let depth = 0
    while (current) {
      if (seen.has(current.id)) fail(`folder cycle includes ${current.id}`)
      seen.add(current.id)
      depth += 1
      if (depth > 3) fail(`folder ${folder.id} exceeds three levels`)
      current = current.parentFolderId
        ? byId.get(current.parentFolderId)
        : undefined
    }
  }
}

function windowBoundsAt(value: unknown, path: string): WindowBounds | null {
  if (value === null) return null
  const bounds = objectAt(value, path)
  exactKeys(bounds, ['x', 'y', 'width', 'height'], path)
  finiteNumberAt(bounds.x, `${path}.x`)
  finiteNumberAt(bounds.y, `${path}.y`)
  positiveNumberAt(bounds.width, `${path}.width`)
  positiveNumberAt(bounds.height, `${path}.height`)
  return value as WindowBounds
}

function exactKeys(
  value: JsonObject,
  allowed: string[],
  path: string,
  optional: string[] = []
): void {
  const allowedSet = new Set(allowed)
  const unknown = Object.keys(value).find((key) => !allowedSet.has(key))
  if (unknown) fail(`${path} contains unknown field ${unknown}`)
  const optionalSet = new Set(optional)
  const missing = allowed.find(
    (key) => !optionalSet.has(key) && !Object.hasOwn(value, key)
  )
  if (missing) fail(`${path}.${missing} is required`)
}

function objectAt(value: unknown, path: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`)
  }
  return value as JsonObject
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`)
  return value
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(`${path} must be a string`)
  return value
}

function nullableStringAt(value: unknown, path: string): string | null {
  if (value === null) return null
  return stringAt(value, path)
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(`${path} must be a boolean`)
  return value
}

function finiteNumberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${path} must be a finite number`)
  }
  return value
}

function positiveNumberAt(value: unknown, path: string): number {
  const number = finiteNumberAt(value, path)
  if (number <= 0) fail(`${path} must be positive`)
  return number
}

function safeIntegerAt(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value)) fail(`${path} must be a safe integer`)
  return value as number
}

function nonNegativeSafeIntegerAt(value: unknown, path: string): number {
  const integer = safeIntegerAt(value, path)
  if (integer < 0) fail(`${path} must not be negative`)
  return integer
}

function revisionAt(value: unknown, path: string): number {
  const revision = safeIntegerAt(value, path)
  if (revision <= 0) fail(`${path} must be positive`)
  return revision
}

function orderAt(value: unknown, path: string): number {
  const order = safeIntegerAt(value, path)
  if (order < 0) fail(`${path} must not be negative`)
  return order
}

function colorAt(value: unknown, path: string): string {
  const color = stringAt(value, path)
  if (!/^#[0-9a-f]{6}$/i.test(color)) fail(`${path} must be a six-digit hex color`)
  return color
}

function dateAt(value: unknown, path: string): string {
  const date = stringAt(value, path)
  const epoch = Date.parse(date)
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== date) {
    fail(`${path} must be an ISO date`)
  }
  return date
}

function nullableDateAt(value: unknown, path: string): string | null {
  if (value === null) return null
  return dateAt(value, path)
}

function stringArrayAt(value: unknown, path: string): string[] {
  const entries = arrayAt(value, path)
  entries.forEach((entry, index) => stringAt(entry, `${path}[${index}]`))
  return entries as string[]
}

function enumAt<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`${path} must be one of ${allowed.join(', ')}`)
  }
  return value as T
}

function uniqueId(value: unknown, path: string, ids: Set<string>): string {
  const id = stringAt(value, path)
  if (!id) fail(`${path} must not be empty`)
  if (ids.has(id)) fail(`${path} duplicates ID ${id}`)
  ids.add(id)
  return id
}

function fail(message: string): never {
  throw new Error(`Invalid persisted data: ${message}`)
}
