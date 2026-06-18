import { describe, expect, it } from 'vitest'
import { migrateNotesFile } from '../src/main/services/noteMigration'

describe('migrateNotesFile', () => {
  it('migrates version 1 notes and todos to version 4 without data loss', () => {
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
      version: 4,
      folders: [],
      items: [
        {
          id: 'note_1',
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

  it('migrates version 2 items to version 4 organization fields', () => {
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
      version: 4,
      folders: [],
      items: [
        expect.objectContaining({
          id: 'note_2',
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
      detached: false,
      windowBounds: null
    })
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
