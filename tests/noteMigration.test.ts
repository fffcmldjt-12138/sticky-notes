import { describe, expect, it } from 'vitest'
import { migrateNotesFile } from '../src/main/services/noteMigration'

describe('migrateNotesFile', () => {
  it('migrates version 6 notes to version 7 with delivery enabled', () => {
    const result = migrateNotesFile({
      version: 6,
      folders: [],
      items: [{
        id: 'note_6', revision: 1, type: 'note', title: 'Legacy current note',
        contentMarkdown: 'Body', siyuanDelivery: null,
        headerColor: '#f2c94c', bodyTheme: 'light', pinned: false,
        detached: false, windowBounds: null, parentFolderId: null, tags: [],
        order: 0, deletedAt: null,
        createdAt: '2026-07-14T09:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z'
      }]
    })

    expect(result).toMatchObject({
      version: 7,
      items: [{ id: 'note_6', siyuanDeliveryDisabled: false }]
    })
  })

  it('migrates version 5 note delivery placeholders to version 7 records', () => {
    const result = migrateNotesFile({
      version: 5,
      folders: [],
      items: [{
        id: 'note_5',
        revision: 3,
        type: 'note',
        title: 'Video notes',
        contentMarkdown: '## Key point',
        headerColor: '#f2c94c',
        bodyTheme: 'light',
        pinned: false,
        detached: false,
        windowBounds: null,
        parentFolderId: null,
        tags: [],
        order: 0,
        deletedAt: null,
        createdAt: '2026-07-14T09:00:00.000Z',
        updatedAt: '2026-07-14T10:00:00.000Z',
        syncedToSiyuan: false
      }]
    })

    expect(result.version).toBe(7)
    expect(result.items[0]).toMatchObject({
      id: 'note_5',
      revision: 3,
      siyuanDelivery: null,
      siyuanDeliveryDisabled: false
    })
    expect(result.items[0]).not.toHaveProperty('syncedToSiyuan')
  })

  it('migrates version 1 notes and todos to version 7 without data loss', () => {
    const result = migrateNotesFile({
      version: 1,
      items: [
        {
          id: 'note_1',
          type: 'note',
          title: 'Legacy note',
          contentMarkdown: '## Heading',
          headerColor: 'yellow',
          bodyTheme: 'light',
          pinned: false,
          syncedToSiyuan: false,
          createdAt: '2026-06-14T09:00:00.000Z',
          updatedAt: '2026-06-14T09:00:00.000Z'
        },
        {
          id: 'todo_1',
          type: 'todo',
          title: 'Legacy todo',
          contentMarkdown: '- [ ] legacy task',
          headerColor: 'blue',
          bodyTheme: 'dark',
          pinned: false,
          completed: false,
          remindAt: '2026-06-14T20:00:00.000Z',
          reminded: false,
          createdAt: '2026-06-14T10:00:00.000Z',
          updatedAt: '2026-06-14T10:00:00.000Z'
        }
      ]
    })

    expect(result).toMatchObject({
      version: 7,
      folders: [],
      items: [
        {
          id: 'note_1',
          revision: 1,
          siyuanDeliveryDisabled: false,
          headerColor: '#f2c94c',
          detached: false,
          windowBounds: null,
          parentFolderId: null,
          tags: [],
          order: 0,
          deletedAt: null
        },
        {
          id: 'todo_1',
          revision: 1,
          headerColor: '#5b8def',
          detached: false,
          windowBounds: null,
          parentFolderId: null,
          tags: [],
          order: 1,
          deletedAt: null,
          tasks: [
            {
              contentMarkdown: '- [ ] legacy task',
              completed: false,
              tags: [],
              importance: 'normal',
              urgency: 'normal',
              children: [],
              schedule: {
                mode: 'point',
                startAt: '2026-06-14T20:00:00.000Z',
                endAt: null,
                repeat: 'none',
                reminders: [{
                  offsetMinutes: 0,
                  remindedAt: null
                }]
              }
            }
          ]
        }
      ]
    })
  })

  it('preserves a valid revision while migrating version 1 items', () => {
    const result = migrateNotesFile({
      version: 1,
      items: [{
        id: 'note_1',
        revision: 7,
        type: 'note',
        title: 'Legacy note',
        contentMarkdown: 'Text',
        headerColor: 'yellow',
        bodyTheme: 'light',
        pinned: false,
        syncedToSiyuan: false,
        createdAt: '2026-06-14T09:00:00.000Z',
        updatedAt: '2026-06-14T09:00:00.000Z'
      }]
    })

    expect(result.items[0].revision).toBe(7)
  })

  it('migrates version 2 items to version 7 organization fields', () => {
    const result = migrateNotesFile({
      version: 2,
      items: [
        {
          id: 'note_2',
          type: 'note',
          title: 'Current note',
          contentMarkdown: 'Text',
          headerColor: '#5b8def',
          bodyTheme: 'dark',
          pinned: true,
          detached: true,
          windowBounds: { x: 1, y: 2, width: 300, height: 400 },
          syncedToSiyuan: false,
          createdAt: '2026-06-14T09:00:00.000Z',
          updatedAt: '2026-06-14T10:00:00.000Z'
        }
      ]
    })

    expect(result).toEqual({
      version: 7,
      folders: [],
      items: [
        expect.objectContaining({
          id: 'note_2',
          revision: 1,
          contentMarkdown: 'Text',
          parentFolderId: null,
          tags: [],
          order: 0,
          deletedAt: null
        })
      ]
    })
  })

  it('migrates existing version 3 todo tasks to unified schedule fields', () => {
    const result = migrateNotesFile({
      version: 3,
      folders: [],
      items: [{
        id: 'todo_3',
        type: 'todo',
        title: 'Todo',
        headerColor: '#5b8def',
        bodyTheme: 'light',
        pinned: false,
        detached: false,
        windowBounds: null,
        parentFolderId: null,
        tags: [],
        order: 0,
        deletedAt: null,
        tasks: [{
          id: 'task_1',
          contentMarkdown: 'Submit',
          completed: false,
          remindAt: '2026-06-19T12:00:00.000Z',
          reminded: true,
          deadlineAt: '2026-06-20T12:00:00.000Z',
          deadlineReminders: [{
            id: 'one-day',
            offsetMinutes: 1440,
            remindedAt: '2026-06-19T12:00:00.000Z'
          }]
        }],
        createdAt: '2026-06-14T09:00:00.000Z',
        updatedAt: '2026-06-14T09:00:00.000Z'
      }]
    })

    expect(result.items[0]).toMatchObject({
      type: 'todo',
      revision: 1,
      panelExpanded: false,
      tasks: [{
        tags: [],
        importance: 'normal',
        urgency: 'normal',
        children: [],
        schedule: {
          mode: 'point',
          startAt: '2026-06-20T12:00:00.000Z',
          endAt: null,
          repeat: 'none',
          reminders: [{
            id: 'one-day',
            offsetMinutes: 1440,
            remindedAt: '2026-06-19T12:00:00.000Z'
          }]
        }
      }]
    })
  })

  it('normalizes detached window fields while migrating version 3 folders', () => {
    const result = migrateNotesFile({
      version: 3,
      folders: [{
        id: 'folder_1',
        title: 'Folder',
        parentFolderId: null,
        order: 0,
        collapsed: false,
        deletedAt: null,
        createdAt: '2026-06-14T09:00:00.000Z',
        updatedAt: '2026-06-14T09:00:00.000Z'
      }],
      items: []
    })

    expect(result.folders[0]).toMatchObject({
      revision: 1,
      detached: false,
      windowBounds: null
    })
  })

  it('migrates version 4 entities to revisioned version 7', () => {
    const result = migrateNotesFile({
      version: 4,
      folders: [{
        id: 'folder_4',
        title: 'Folder',
        parentFolderId: null,
        order: 0,
        collapsed: false,
        detached: false,
        windowBounds: null,
        deletedAt: null,
        createdAt: '2026-07-14T09:00:00.000Z',
        updatedAt: '2026-07-14T09:00:00.000Z'
      }],
      items: [{
        id: 'note_4',
        type: 'note',
        title: 'Version 4 note',
        contentMarkdown: 'Text',
        headerColor: '#f2c94c',
        bodyTheme: 'light',
        pinned: false,
        detached: false,
        windowBounds: null,
        parentFolderId: null,
        tags: [],
        order: 0,
        deletedAt: null,
        createdAt: '2026-07-14T09:00:00.000Z',
        updatedAt: '2026-07-14T09:00:00.000Z',
        syncedToSiyuan: false
      }]
    })

    expect(result.version).toBe(7)
    expect(result.items[0].revision).toBe(1)
    expect(result.folders[0].revision).toBe(1)
  })

  it('preserves valid revisions and replaces invalid revisions', () => {
    const result = migrateNotesFile({
      version: 4,
      folders: [{
        id: 'folder_4',
        title: 'Folder',
        revision: 0,
        parentFolderId: null,
        order: 0,
        collapsed: false,
        detached: false,
        windowBounds: null,
        deletedAt: null,
        createdAt: '2026-07-14T09:00:00.000Z',
        updatedAt: '2026-07-14T09:00:00.000Z'
      }],
      items: [{
        id: 'note_4',
        type: 'note',
        title: 'Version 4 note',
        revision: 7,
        contentMarkdown: 'Text',
        headerColor: '#f2c94c',
        bodyTheme: 'light',
        pinned: false,
        detached: false,
        windowBounds: null,
        parentFolderId: null,
        tags: [],
        order: 0,
        deletedAt: null,
        createdAt: '2026-07-14T09:00:00.000Z',
        updatedAt: '2026-07-14T09:00:00.000Z',
        syncedToSiyuan: false
      }]
    })

    expect(result.items[0].revision).toBe(7)
    expect(result.folders[0].revision).toBe(1)
  })

  it.each([
    ['missing items', { version: 5, folders: [] }],
    ['null folders', { version: 5, items: [], folders: null }],
    ['non-array items', { version: 5, items: {}, folders: [] }]
  ])('rejects version 5 files with %s', (_label, value) => {
    expect(() => migrateNotesFile(value)).toThrow('Invalid notes file')
  })

  it.each([
    Number.MAX_SAFE_INTEGER + 1,
    1.5,
    '2'
  ])('normalizes unsafe revision %p to 1', (revision) => {
    const result = migrateNotesFile({
      version: 7,
      items: [{ type: 'note', revision }],
      folders: [{ revision }]
    })

    expect(result.items[0].revision).toBe(1)
    expect(result.folders[0].revision).toBe(1)
  })

  it('falls back to yellow for invalid legacy colors', () => {
    const result = migrateNotesFile({
      version: 1,
      items: [
        {
          id: 'note_1',
          type: 'note',
          title: 'Bad color',
          contentMarkdown: '',
          headerColor: 'chartreuse',
          bodyTheme: 'light',
          pinned: false,
          syncedToSiyuan: false,
          createdAt: '2026-06-14T09:00:00.000Z',
          updatedAt: '2026-06-14T09:00:00.000Z'
        }
      ]
    })

    expect(result.items[0].headerColor).toBe('#f2c94c')
  })
})
