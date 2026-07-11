import { mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { NoteStore } from '../src/main/services/NoteStore'
import { RecycleService } from '../src/main/services/RecycleService'
import { AssetService } from '../src/main/services/AssetService'

describe('RecycleService', () => {
  let store: NoteStore
  let recycle: RecycleService

  beforeEach(async () => {
    store = new NoteStore(await mkdtemp(join(tmpdir(), 'sticky-recycle-')))
    recycle = new RecycleService(
      store,
      () => new Date('2026-06-15T12:00:00.000Z')
    )
  })

  it('soft deletes an item and restores it', async () => {
    const note = await store.create('note', '可恢复笔记')

    expect(await store.delete(note.id)).toBe(true)
    expect(await store.list()).toEqual([])
    expect((await recycle.list()).items).toEqual([
      expect.objectContaining({ id: note.id, deletedAt: expect.any(String) })
    ])

    expect(await recycle.restoreItem(note.id)).toBe(true)
    expect(await store.list()).toEqual([
      expect.objectContaining({ id: note.id, deletedAt: null })
    ])
  })

  it('purges entries after seven days', async () => {
    const note = await store.create('note')
    await store.update(note.id, { deletedAt: '2026-06-08T11:59:59.000Z' })

    expect(await recycle.purgeExpired()).toBe(1)
    expect((await recycle.list()).items).toEqual([])
  })

  it('empties all recycled entries immediately', async () => {
    const note = await store.create('note')
    await store.delete(note.id)

    expect(await recycle.empty()).toBe(1)
    expect((await recycle.list()).items).toEqual([])
  })

  it('keeps images referenced by active or recycled notes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-recycle-assets-'))
    store = new NoteStore(directory)
    const assets = new AssetService(directory)
    recycle = new RecycleService(
      store,
      () => new Date('2026-06-15T12:00:00.000Z'),
      assets
    )
    const activeAsset = await assets.importBuffer(Buffer.from('a'), 'image/png')
    const recycledAsset = await assets.importBuffer(Buffer.from('b'), 'image/png')
    await assets.importBuffer(Buffer.from('c'), 'image/png')
    const active = await store.create('note')
    const recycled = await store.create('note')
    await store.update(active.id, { contentMarkdown: `![](${activeAsset.url})` })
    await store.update(recycled.id, {
      contentMarkdown: `![](${recycledAsset.url})`
    })
    await store.delete(recycled.id)

    expect(await recycle.cleanUnusedImages()).toBe(1)
    expect((await readdir(join(directory, 'assets'))).sort()).toEqual(
      [activeAsset.fileName, recycledAsset.fileName].sort()
    )
  })

  it('moves orphaned images to asset trash when the recycle bin is emptied', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-empty-assets-'))
    store = new NoteStore(directory)
    const assets = new AssetService(directory)
    recycle = new RecycleService(
      store,
      () => new Date('2026-06-15T12:00:00.000Z'),
      assets
    )
    const asset = await assets.importBuffer(Buffer.from('image'), 'image/png')
    const note = await store.create('note')
    await store.update(note.id, { contentMarkdown: `![](${asset.url})` })
    await store.delete(note.id)

    await recycle.empty()

    expect(await readdir(join(directory, 'assets'))).toEqual([])
    expect(await readdir(join(directory, 'assets-trash'))).toEqual([
      `${new Date('2026-06-15T12:00:00.000Z').getTime()}--${asset.fileName}`
    ])
  })

  it('keeps images referenced by todo subtasks', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sticky-subtask-assets-'))
    store = new NoteStore(directory)
    const assets = new AssetService(directory)
    recycle = new RecycleService(store, () => new Date(), assets)
    const asset = await assets.importBuffer(Buffer.from('child'), 'image/png')
    const todo = await store.create('todo')
    const task = todo.type === 'todo' ? todo.tasks[0] : null
    const child = await store.addTodoSubtask(
      todo.id,
      task!.id,
      `![](${asset.url})`
    )
    expect(child).not.toBeNull()

    expect(await recycle.cleanUnusedImages()).toBe(0)
    expect(await readdir(join(directory, 'assets'))).toEqual([asset.fileName])
  })
})
