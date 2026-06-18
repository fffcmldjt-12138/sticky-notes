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

  it('creates an empty version 4 file on first load', async () => {
    expect(await store.list()).toEqual([])
    expect(JSON.parse(await readFile(join(directory, 'notes.json'), 'utf8'))).toEqual({
      version: 4,
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

  it('creates todo tasks with advanced defaults', async () => {
    const todo = await store.create('todo')
    const task = await store.addTodoTask(todo.id, 'First')

    expect(task).toMatchObject({
      contentMarkdown: 'First',
      completed: false,
      importance: 'normal',
      urgency: 'normal',
      children: [],
      schedule: null
    })
  })

  it('adds updates and deletes one-level subtasks', async () => {
    const todo = await store.create('todo')
    const task = await store.addTodoTask(todo.id, 'Parent')
    const child = await store.addTodoSubtask(todo.id, task!.id, 'Child')

    expect(child).toMatchObject({
      contentMarkdown: 'Child',
      completed: false,
      importance: 'normal',
      urgency: 'normal',
      schedule: null
    })

    const updated = await store.updateTodoSubtask(
      todo.id,
      task!.id,
      child!.id,
      { importance: 'important', completed: true }
    )
    expect(updated?.tasks[0].children[0]).toMatchObject({
      importance: 'important',
      completed: true
    })

    const deleted = await store.deleteTodoSubtask(todo.id, task!.id, child!.id)
    expect(deleted?.tasks[0].children).toEqual([])
  })

  it('keeps delivered reminder state but resets it when schedule rules change', async () => {
    const todo = await store.create('todo')
    const task = await store.addTodoTask(todo.id, 'Scheduled')
    const baseSchedule = {
      mode: 'point' as const,
      startAt: '2026-06-20T12:00:00.000Z',
      endAt: null,
      repeat: 'none' as const,
      reminders: [{
        id: 'one-day',
        offsetMinutes: 1440,
        remindedAt: null
      }]
    }
    await store.updateTodoTask(todo.id, task!.id, { schedule: baseSchedule })
    const deliveredAt = '2026-06-19T12:00:00.000Z'
    const delivered = await store.updateTodoTask(todo.id, task!.id, {
      schedule: {
        ...baseSchedule,
        reminders: [{ ...baseSchedule.reminders[0], remindedAt: deliveredAt }]
      }
    })
    expect(delivered?.tasks[0].schedule?.reminders[0].remindedAt).toBe(
      deliveredAt
    )

    const changed = await store.updateTodoTask(todo.id, task!.id, {
      schedule: {
        ...baseSchedule,
        startAt: '2026-06-21T12:00:00.000Z',
        reminders: [{ ...baseSchedule.reminders[0], remindedAt: deliveredAt }]
      }
    })
    expect(changed?.tasks[0].schedule?.reminders[0].remindedAt).toBeNull()
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
