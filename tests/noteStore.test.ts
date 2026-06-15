import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { NoteStore } from '../src/main/services/NoteStore'

describe('NoteStore', () => {
  let directory: string
  let store: NoteStore

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-notes-'))
    store = new NoteStore(directory)
  })

  it('creates an empty version 3 file on first load', async () => {
    expect(await store.list()).toEqual([])
    expect(JSON.parse(await readFile(join(directory, 'notes.json'), 'utf8'))).toEqual({
      version: 3,
      items: [],
      folders: []
    })
  })

  it('creates distinct Note and Todo records', async () => {
    const note = await store.create('note')
    const todo = await store.create('todo')

    expect(note.type).toBe('note')
    expect(note).toMatchObject({
      parentFolderId: null,
      tags: [],
      order: 0,
      deletedAt: null
    })
    expect(todo).toMatchObject({
      type: 'todo',
      tasks: [],
      parentFolderId: null,
      tags: [],
      order: 1,
      deletedAt: null
    })
  })

  it('manages independent Todo tasks and resets only the changed reminder', async () => {
    const todo = await store.create('todo')
    const first = await store.addTodoTask(todo.id, 'First')
    const second = await store.addTodoTask(todo.id, 'Second')
    await store.updateTodoTask(todo.id, first!.id, {
      remindAt: '2026-06-14T20:00:00.000Z'
    })
    await store.updateTodoTask(todo.id, first!.id, { reminded: true })
    await store.updateTodoTask(todo.id, second!.id, { reminded: true })
    await store.updateTodoTask(todo.id, first!.id, {
      remindAt: '2026-06-15T20:00:00.000Z'
    })

    const changed = (await store.list()).find((item) => item.id === todo.id)
    expect(changed?.type).toBe('todo')
    if (changed?.type !== 'todo') throw new Error('Expected Todo')
    expect(changed.tasks.find((task) => task.id === first!.id)?.reminded).toBe(false)
    expect(changed.tasks.find((task) => task.id === second!.id)?.reminded).toBe(true)
  })

  it('resets deadline delivery state when the deadline changes', async () => {
    const todo = await store.create('todo')
    const task = await store.addTodoTask(todo.id, 'Deadline task')
    await store.updateTodoTask(todo.id, task!.id, {
      deadlineAt: '2026-06-20T12:00:00.000Z',
      deadlineReminders: [{
        id: 'one-day',
        offsetMinutes: 1440,
        remindedAt: '2026-06-19T12:00:00.000Z'
      }]
    })
    await store.updateTodoTask(todo.id, task!.id, {
      deadlineAt: '2026-06-21T12:00:00.000Z'
    })

    const changed = (await store.list()).find((item) => item.id === todo.id)
    if (changed?.type !== 'todo') throw new Error('Expected Todo')
    expect(changed.tasks[0].deadlineReminders[0].remindedAt).toBeNull()
  })

  it('serializes concurrent updates without losing either change', async () => {
    const first = await store.create('note')
    const second = await store.create('note')

    await Promise.all([
      store.update(first.id, { title: 'First changed' }),
      store.update(second.id, { title: 'Second changed' })
    ])

    const items = await store.list()
    expect(items.find((item) => item.id === first.id)?.title).toBe('First changed')
    expect(items.find((item) => item.id === second.id)?.title).toBe('Second changed')
  })

  it('backs up and migrates a version 1 notes file on load', async () => {
    await writeFile(
      join(directory, 'notes.json'),
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'note_legacy',
            type: 'note',
            title: 'Legacy',
            contentMarkdown: 'content',
            headerColor: 'green',
            bodyTheme: 'light',
            pinned: false,
            syncedToSiyuan: false,
            createdAt: '2026-06-14T09:00:00.000Z',
            updatedAt: '2026-06-14T09:00:00.000Z'
          }
        ]
      }),
      'utf8'
    )

    const migrated = await store.list()
    const files = await import('node:fs/promises').then(({ readdir }) => readdir(directory))

    expect(migrated[0]).toMatchObject({ headerColor: '#55b985', detached: false })
    expect(files.some((file) => file.startsWith('notes.json.backup-'))).toBe(true)
  })
})
