import { describe, expect, it } from 'vitest'
import { migrateNotesFile } from '../src/main/services/noteMigration'

describe('migrateNotesFile', () => {
  it('migrates version 1 notes and todos to version 3 without data loss', () => {
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
      version: 3,
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
              remindAt: '2026-06-14T20:00:00.000Z',
              reminded: false
            }
          ]
        }
      ]
    })
  })

  it('migrates version 2 items to version 3 organization fields', () => {
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
      version: 3,
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
