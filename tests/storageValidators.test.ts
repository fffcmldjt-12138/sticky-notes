import { describe, expect, it } from 'vitest'
import {
  validateAppConfig,
  validateNotesFile
} from '../src/main/services/storageValidators'

const note = {
  id: 'note_1',
  revision: 1,
  type: 'note',
  title: 'Note',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: { x: 0, y: 1, width: 320, height: 400 },
  parentFolderId: null,
  tags: ['tag'],
  order: 0,
  deletedAt: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z',
  contentMarkdown: 'text',
  syncedToSiyuan: false
}

const todo = {
  ...note,
  id: 'todo_1',
  type: 'todo',
  tasks: [{
    id: 'task_1',
    contentMarkdown: 'task',
    completed: false,
    tags: [],
    importance: 'important',
    urgency: 'urgent',
    children: [{
      id: 'subtask_1',
      contentMarkdown: 'child',
      completed: false,
      tags: [],
      importance: 'normal',
      urgency: 'normal',
      schedule: null
    }],
    schedule: {
      mode: 'range',
      startAt: '2026-07-14T08:00:00.000Z',
      endAt: '2026-07-14T09:00:00.000Z',
      repeat: 'weekdays',
      reminders: [{
        id: 'reminder_1',
        offsetMinutes: 15,
        remindedAt: null,
        snoozedUntil: '2026-07-14T08:10:00.000Z'
      }]
    }
  }],
  panelExpanded: true
}
delete (todo as Partial<typeof note>).contentMarkdown
delete (todo as Partial<typeof note>).syncedToSiyuan

function folder(id: string, parentFolderId: string | null) {
  return {
    id,
    revision: 1,
    title: id,
    parentFolderId,
    order: 0,
    collapsed: false,
    detached: false,
    windowBounds: null,
    deletedAt: null,
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z'
  }
}

describe('storage validators', () => {
  it('validates and returns a complete notes v5 tree without rewriting it', () => {
    const value = { version: 5, items: [note, todo], folders: [] }
    expect(validateNotesFile(value)).toBe(value)
  })

  it.each([
    ['duplicate IDs', { version: 5, items: [note, { ...note }], folders: [] }],
    ['unsafe revision', { version: 5, items: [{ ...note, revision: 0 }], folders: [] }],
    ['invalid enum', { version: 5, items: [{ ...note, bodyTheme: 'sepia' }], folders: [] }],
    ['invalid date', { version: 5, items: [{ ...note, createdAt: 'soon' }], folders: [] }],
    ['invalid window', { version: 5, items: [{ ...note, windowBounds: { x: 0, y: 0, width: -1, height: 20 } }], folders: [] }],
    ['invalid task schedule', { version: 5, items: [{ ...todo, tasks: [{ ...todo.tasks[0], schedule: { ...todo.tasks[0].schedule, mode: 'later' } }] }], folders: [] }]
  ])('rejects %s', (_name, value) => {
    expect(() => validateNotesFile(value)).toThrow()
  })

  it('rejects unknown fields instead of silently stripping them', () => {
    expect(() => validateNotesFile({
      version: 5,
      items: [{ ...note, surprise: true }],
      folders: []
    })).toThrow('surprise')
  })

  it('allows reminder preset IDs to repeat in separate schedules', () => {
    const secondTask = {
      ...todo.tasks[0],
      id: 'task_2',
      children: [],
      schedule: {
        ...todo.tasks[0].schedule,
        reminders: [{
          id: 'reminder_1',
          offsetMinutes: 0,
          remindedAt: null
        }]
      }
    }
    expect(() => validateNotesFile({
      version: 5,
      items: [{ ...todo, tasks: [todo.tasks[0], secondTask] }],
      folders: []
    })).not.toThrow()
  })

  it.each([
    {
      ...todo,
      tasks: [{
        ...todo.tasks[0],
        schedule: {
          ...todo.tasks[0].schedule,
          reminders: [{
            ...todo.tasks[0].schedule.reminders[0],
            offsetMinutes: -1
          }]
        }
      }]
    },
    {
      ...todo,
      tasks: [{
        ...todo.tasks[0],
        deadlineReminders: [{
          id: 'legacy-negative',
          offsetMinutes: -1,
          remindedAt: null
        }]
      }]
    }
  ])('rejects negative reminder offsets', (item) => {
    expect(() => validateNotesFile({
      version: 5,
      items: [item],
      folders: []
    })).toThrow('offsetMinutes')
  })

  it('rejects a persisted folder tree deeper than three levels', () => {
    expect(() => validateNotesFile({
      version: 5,
      items: [],
      folders: [
        folder('folder_1', null),
        folder('folder_2', 'folder_1'),
        folder('folder_3', 'folder_2'),
        folder('folder_4', 'folder_3')
      ]
    })).toThrow('three levels')
  })

  it('fully validates config', () => {
    const value = {
      version: 1,
      autoLaunch: false,
      panelPosition: 'right',
      alwaysOnTop: true,
      recentHeaderColors: ['#f2c94c']
    }
    expect(validateAppConfig(value)).toBe(value)
    expect(() => validateAppConfig({ ...value, alwaysOnTop: 'yes' })).toThrow()
    expect(() => validateAppConfig({ ...value, extra: true })).toThrow('extra')
  })
})
