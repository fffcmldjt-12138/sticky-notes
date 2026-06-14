import { describe, expect, it } from 'vitest'
import { migrateNotesFile } from '../src/main/services/noteMigration'

describe('migrateNotesFile', () => {
  it('migrates version 1 notes and todos to version 2 without data loss', () => {
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
      version: 2,
      items: [
        {
          id: 'note_1',
          headerColor: '#f2c94c',
          detached: false,
          windowBounds: null
        },
        {
          id: 'todo_1',
          headerColor: '#5b8def',
          detached: false,
          windowBounds: null,
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
