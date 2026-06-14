import { mkdtemp, readFile } from 'node:fs/promises'
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

  it('creates an empty versioned file on first load', async () => {
    expect(await store.list()).toEqual([])
    expect(JSON.parse(await readFile(join(directory, 'notes.json'), 'utf8'))).toEqual({
      version: 1,
      items: []
    })
  })

  it('creates distinct Note and Todo records', async () => {
    const note = await store.create('note')
    const todo = await store.create('todo')

    expect(note.type).toBe('note')
    expect(todo).toMatchObject({
      type: 'todo',
      completed: false,
      remindAt: null,
      reminded: false
    })
  })

  it('resets reminded when a Todo reminder changes', async () => {
    const todo = await store.create('todo')
    await store.update(todo.id, {
      remindAt: '2026-06-14T20:00:00.000Z'
    })
    const reminded = await store.update(todo.id, { reminded: true })
    const changed = await store.update(todo.id, {
      remindAt: '2026-06-15T20:00:00.000Z'
    })

    expect(reminded?.type === 'todo' && reminded.reminded).toBe(true)
    expect(changed?.type === 'todo' && changed.reminded).toBe(false)
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
})
