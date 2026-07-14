import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotesFile } from '../src/shared/models'
import { BackupService } from '../src/main/services/BackupService'
import { NoteStore } from '../src/main/services/NoteStore'
import { UnsupportedDataVersionError } from '../src/main/services/storageErrors'
import {
  validateAppConfig,
  validateNotesFile
} from '../src/main/services/storageValidators'

describe('NoteStore', () => {
  let directory: string
  let store: NoteStore

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'sticky-notes-'))
    store = new NoteStore(directory)
  })

  it('creates an empty version 6 file on first load', async () => {
    expect(await store.list()).toEqual([])
    expect(JSON.parse(await readFile(join(directory, 'notes.json'), 'utf8'))).toEqual({
      version: 6,
      items: [],
      folders: []
    })
  })

  it('creates distinct Note and Todo records', async () => {
    const note = await store.create('note')
    const todo = await store.create('todo')

    expect(note.type).toBe('note')
    expect(note).toMatchObject({
      revision: 1,
      siyuanDelivery: null,
      parentFolderId: null,
      tags: [],
      order: 0,
      deletedAt: null
    })
    expect(todo).toMatchObject({
      type: 'todo',
      revision: 1,
      tasks: [
        expect.objectContaining({
          contentMarkdown: '',
          completed: false,
          importance: 'normal',
          urgency: 'normal',
          children: [],
          schedule: null
        })
      ],
      parentFolderId: null,
      tags: [],
      order: 1,
      deletedAt: null
    })
  })

  it('records a SiYuan delivery without overwriting a newer note edit', async () => {
    const created = await store.create('note')
    await store.update(created.id, created.revision, {
      title: 'Edited while sending',
      contentMarkdown: 'newer body'
    })

    const delivered = await (store as unknown as {
      recordSiyuanDelivery(
        id: string,
        delivery: {
          notebookId: string
          documentId: string
          sentAt: string
          contentFingerprint: string
        }
      ): Promise<unknown>
    }).recordSiyuanDelivery(created.id, {
      notebookId: 'inbox',
      documentId: 'doc-1',
      sentAt: '2026-07-14T12:00:00.000Z',
      contentFingerprint: 'sent-copy'
    })

    expect(delivered).toMatchObject({
      status: 'ok',
      value: {
        title: 'Edited while sending',
        contentMarkdown: 'newer body',
        siyuanDelivery: {
          documentId: 'doc-1',
          contentFingerprint: 'sent-copy'
        }
      }
    })
  })

  it('creates folders with an initial revision', async () => {
    const folder = await store.createFolder('Folder')

    expect(folder.revision).toBe(1)
  })

  it('accepts the expected revision and rejects a stale item patch', async () => {
    const note = await store.create('note')

    const first = await store.update(note.id, 1, { title: 'first' })
    expect(first).toMatchObject({
      status: 'ok',
      value: { title: 'first', revision: 2 }
    })

    const stale = await store.update(note.id, 1, { title: 'stale' })
    expect(stale).toMatchObject({
      status: 'conflict',
      current: { title: 'first', revision: 2 }
    })
    expect((await store.list())[0]).toMatchObject({ title: 'first', revision: 2 })
  })

  it('uses the containing todo revision for task text patches', async () => {
    const todo = await store.create('todo')
    const task = todo.type === 'todo' ? todo.tasks[0] : null

    const first = await store.updateTodoTask(todo.id, task!.id, 1, {
      contentMarkdown: 'first'
    })
    expect(first).toMatchObject({
      status: 'ok',
      value: { revision: 2 }
    })

    const stale = await store.updateTodoTask(todo.id, task!.id, 1, {
      contentMarkdown: 'stale'
    })
    expect(stale).toMatchObject({
      status: 'conflict',
      current: { revision: 2 }
    })
  })

  it('increments the entity revision for a discrete todo command', async () => {
    const todo = await store.create('todo')
    const task = todo.type === 'todo' ? todo.tasks[0] : null

    const result = await store.updateTodoTask(todo.id, task!.id, null, {
      completed: true
    })

    expect(result).toMatchObject({ status: 'ok', value: { revision: 2 } })
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
      null,
      { importance: 'important', completed: true }
    )
    expect(updated.status === 'ok' && updated.value.tasks[0].children[0]).toMatchObject({
      importance: 'important',
      completed: true
    })

    const deleted = await store.deleteTodoSubtask(todo.id, task!.id, child!.id)
    expect(deleted.status === 'ok' && deleted.value.tasks[0].children).toEqual([])
  })

  it('completes a parent only when every subtask is complete', async () => {
    const todo = await store.create('todo')
    const task = todo.type === 'todo' ? todo.tasks[0] : null
    const first = await store.addTodoSubtask(todo.id, task!.id, 'First')
    const second = await store.addTodoSubtask(todo.id, task!.id, 'Second')

    const partlyDone = await store.updateTodoSubtask(
      todo.id,
      task!.id,
      first!.id,
      null,
      { completed: true }
    )
    expect(partlyDone.status === 'ok' && partlyDone.value.tasks[0].completed).toBe(false)

    const allDone = await store.updateTodoSubtask(
      todo.id,
      task!.id,
      second!.id,
      null,
      { completed: true }
    )
    expect(allDone.status === 'ok' && allDone.value.tasks[0].completed).toBe(true)

    const reopened = await store.updateTodoSubtask(
      todo.id,
      task!.id,
      first!.id,
      null,
      { completed: false }
    )
    expect(reopened.status === 'ok' && reopened.value.tasks[0].completed).toBe(false)
  })

  it('applies a parent completion toggle to all subtasks', async () => {
    const todo = await store.create('todo')
    const task = todo.type === 'todo' ? todo.tasks[0] : null
    await store.addTodoSubtask(todo.id, task!.id, 'First')
    await store.addTodoSubtask(todo.id, task!.id, 'Second')

    const completed = await store.updateTodoTask(todo.id, task!.id, null, {
      completed: true
    })
    expect(completed.status === 'ok' && completed.value.tasks[0].children.every((child) => child.completed)).toBe(true)

    const reopened = await store.updateTodoTask(todo.id, task!.id, null, {
      completed: false
    })
    expect(reopened.status === 'ok' && reopened.value.tasks[0].children.every((child) => !child.completed)).toBe(true)
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
    await store.updateTodoTask(todo.id, task!.id, null, { schedule: baseSchedule })
    const deliveredAt = '2026-06-19T12:00:00.000Z'
    const delivered = await store.updateTodoTask(todo.id, task!.id, null, {
      schedule: {
        ...baseSchedule,
        reminders: [{ ...baseSchedule.reminders[0], remindedAt: deliveredAt }]
      }
    })
    expect(delivered.status === 'ok' && delivered.value.tasks[0].schedule?.reminders[0].remindedAt).toBe(
      deliveredAt
    )

    const changed = await store.updateTodoTask(todo.id, task!.id, null, {
      schedule: {
        ...baseSchedule,
        startAt: '2026-06-21T12:00:00.000Z',
        reminders: [{ ...baseSchedule.reminders[0], remindedAt: deliveredAt }]
      }
    })
    expect(changed.status === 'ok' && changed.value.tasks[0].schedule?.reminders[0].remindedAt).toBeNull()
  })

  it('persists snooze on the exact task reminder', async () => {
    const todo = await store.create('todo')
    const task = todo.type === 'todo' ? todo.tasks[0] : null
    await store.updateTodoTask(todo.id, task!.id, null, {
      schedule: {
        mode: 'point',
        startAt: '2026-07-13T12:00:00.000Z',
        endAt: null,
        repeat: 'none',
        reminders: [{
          id: 'at-time',
          offsetMinutes: 0,
          remindedAt: '2026-07-13T09:00:00.000Z'
        }]
      }
    })

    const updated = await store.snoozeReminder(
      { itemId: todo.id, taskId: task!.id, reminderId: 'at-time' },
      new Date('2026-07-13T10:10:00.000Z')
    )

    expect(updated.status === 'ok' && updated.value.tasks[0].schedule?.reminders[0]).toMatchObject({
      id: 'at-time',
      remindedAt: null,
      snoozedUntil: '2026-07-13T10:10:00.000Z'
    })
  })

  it('serializes concurrent updates without losing either change', async () => {
    const first = await store.create('note')
    const second = await store.create('note')

    await Promise.all([
      store.update(first.id, first.revision, { title: 'First changed' }),
      store.update(second.id, second.revision, { title: 'Second changed' })
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

  it('backs up a version 4 notes file before migrating to version 6', async () => {
    const original = JSON.stringify({ version: 4, items: [], folders: [] })
    await writeFile(
      join(directory, 'notes.json'),
      original,
      'utf8'
    )

    await store.list()

    const files = await readdir(directory)
    const backup = files.find((file) => file.startsWith('notes.json.backup-'))
    expect(backup).toBeDefined()
    expect(await readFile(join(directory, backup!), 'utf8')).toBe(original)
    expect(JSON.parse(await readFile(join(directory, 'notes.json'), 'utf8')).version)
      .toBe(6)
  })

  it('does not back up an already migrated version 6 file on startup', async () => {
    const original = JSON.stringify({ version: 6, items: [], folders: [] })
    await writeFile(
      join(directory, 'notes.json'),
      original,
      'utf8'
    )

    await store.list()
    await new NoteStore(directory).list()

    const files = await readdir(directory)
    expect(files.some((file) => file.startsWith('notes.json.backup-'))).toBe(false)
    expect(await readFile(join(directory, 'notes.json'), 'utf8')).toBe(original)
  })

  it('does not replace malformed notes with an empty version 6 file', async () => {
    await writeFile(join(directory, 'notes.json'), '{broken json', 'utf8')

    await expect(store.list()).rejects.toMatchObject({ code: 'DATA_UNAVAILABLE' })
    expect(await readFile(join(directory, 'notes.json'), 'utf8')).toBe('{broken json')
    const files = await readdir(directory)
    const backup = files.find((file) => file.startsWith('notes.json.corrupt-'))
    expect(backup).toBeDefined()
    expect(await readFile(join(directory, backup!), 'utf8')).toBe('{broken json')
  })

  it('does not overwrite a valid notes file from a future schema version', async () => {
    const future = JSON.stringify({ version: 99, items: [{ id: 'future' }] })
    await writeFile(join(directory, 'notes.json'), future, 'utf8')

    await expect(store.list()).rejects.toBeInstanceOf(UnsupportedDataVersionError)
    expect(await readFile(join(directory, 'notes.json'), 'utf8')).toBe(future)
  })

  it('returns a detached snapshot after earlier mutations', async () => {
    const pendingNote = store.create('note', 'Queued')
    const pendingSnapshot = store.getSnapshot()
    const [note, snapshot] = await Promise.all([pendingNote, pendingSnapshot])
    snapshot.items[0].title = 'Mutated outside the store'

    expect(snapshot.items[0].id).toBe(note.id)
    expect((await store.getSnapshot()).items[0].title).toBe('Queued')
  })

  it('clones replacement input before queueing and does not deadlock', async () => {
    await store.create('note', 'Original')
    const replacement: NotesFile = { version: 6, items: [], folders: [] }

    const pending = store.replaceSnapshot(replacement, 'restore')
    replacement.items.push((await store.getSnapshot()).items[0])

    await expect(pending).resolves.toBeUndefined()
    expect(await store.getSnapshot()).toEqual({
      version: 6,
      items: [],
      folders: []
    })
  })

  it('rejects an invalid replacement without writing', async () => {
    await store.create('note', 'Keep me')
    const before = await readFile(join(directory, 'notes.json'), 'utf8')

    await expect(
      store.replaceSnapshot(
        { version: 6, items: [{ id: 'broken' }], folders: [] } as never,
        'import'
      )
    ).rejects.toThrow()

    expect(await readFile(join(directory, 'notes.json'), 'utf8')).toBe(before)
  })

  it('fails closed when a protected replacement backup cannot be created', async () => {
    const backups = new BackupService(join(directory, 'backups'), {
      notes: validateNotesFile,
      config: validateAppConfig
    })
    const protectedStore = new NoteStore(directory, backups)
    await protectedStore.create('note', 'Keep me')
    const before = await readFile(join(directory, 'notes.json'), 'utf8')
    vi.spyOn(backups, 'recordProtected').mockRejectedValueOnce(
      new Error('protected backup failed')
    )

    await expect(
      protectedStore.replaceSnapshot(
        { version: 6, items: [], folders: [] },
        'restore'
      )
    ).rejects.toThrow('protected backup failed')
    expect(await readFile(join(directory, 'notes.json'), 'utf8')).toBe(before)
  })
})
