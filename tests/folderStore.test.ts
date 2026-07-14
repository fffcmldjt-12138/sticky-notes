import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { NoteStore } from '../src/main/services/NoteStore'

describe('folder storage', () => {
  let store: NoteStore

  beforeEach(async () => {
    store = new NoteStore(await mkdtemp(join(tmpdir(), 'sticky-folders-')))
  })

  it('allows three folder levels and rejects a fourth', async () => {
    const first = await store.createFolder('一级')
    const second = await store.createFolder('二级', first.id)
    const third = await store.createFolder('三级', second.id)

    await expect(store.createFolder('四级', third.id)).rejects.toThrow(
      '文件夹最多嵌套 3 层'
    )
    expect(await store.listFolders()).toHaveLength(3)
  })

  it('accepts the expected revision and rejects a stale folder patch', async () => {
    const folder = await store.createFolder('Folder')

    const first = await store.updateFolder(folder.id, 1, { title: 'first' })
    expect(first).toMatchObject({
      status: 'ok',
      value: { title: 'first', revision: 2 }
    })

    const stale = await store.updateFolder(folder.id, 1, { title: 'stale' })
    expect(stale).toMatchObject({
      status: 'conflict',
      current: { title: 'first', revision: 2 }
    })
  })

  it('moves notes and todos into a folder', async () => {
    const folder = await store.createFolder('项目')
    const note = await store.create('note')
    const todo = await store.create('todo')

    await store.moveItem(note.id, folder.id)
    await store.moveItem(todo.id, folder.id)

    expect(await store.list()).toEqual([
      expect.objectContaining({ id: todo.id, parentFolderId: folder.id, revision: 2 }),
      expect.objectContaining({ id: note.id, parentFolderId: folder.id, revision: 2 })
    ])
  })

  it('creates notes and todos directly inside a folder', async () => {
    const folder = await store.createFolder('项目')
    const note = await store.create('note', undefined, folder.id)
    const todo = await store.create('todo', undefined, folder.id)

    expect(note).toMatchObject({ parentFolderId: folder.id, order: 0 })
    expect(todo).toMatchObject({ parentFolderId: folder.id, order: 1 })
  })

  it('moves a nested item and folder out to their parent level', async () => {
    const parent = await store.createFolder('上一级')
    const child = await store.createFolder('当前', parent.id)
    const note = await store.create('note', undefined, child.id)
    const nested = await store.createFolder('子文件夹', child.id)

    await store.reorderChildren(parent.id, [
      { kind: 'folder', id: child.id },
      { kind: 'item', id: note.id },
      { kind: 'folder', id: nested.id }
    ])

    expect((await store.list()).find((item) => item.id === note.id)).toMatchObject({
      parentFolderId: parent.id,
      order: 1
    })
    expect((await store.listFolders()).find((folder) => folder.id === nested.id))
      .toMatchObject({ parentFolderId: parent.id, order: 2 })
  })

  it('rejects moving a folder tree when descendants would exceed three levels', async () => {
    const destination = await store.createFolder('目标一级')
    const destinationChild = await store.createFolder('目标二级', destination.id)
    const moving = await store.createFolder('待移动一级')
    await store.createFolder('待移动二级', moving.id)

    await expect(
      store.updateFolder(moving.id, moving.revision, {
        parentFolderId: destinationChild.id
      })
    ).rejects.toThrow('文件夹最多嵌套 3 层')
  })

  it('stores notes, todos, and folders in one shared sibling order', async () => {
    const note = await store.create('note')
    const folder = await store.createFolder('Mixed')
    const todo = await store.create('todo')

    await store.reorderChildren(null, [
      { kind: 'item', id: note.id },
      { kind: 'item', id: todo.id },
      { kind: 'folder', id: folder.id }
    ])

    const items = await store.list()
    const folders = await store.listFolders()
    expect(items.find((item) => item.id === note.id)).toMatchObject({
      parentFolderId: null,
      order: 0
    })
    expect(items.find((item) => item.id === todo.id)).toMatchObject({
      parentFolderId: null,
      order: 1
    })
    expect(folders.find((entry) => entry.id === folder.id)).toMatchObject({
      parentFolderId: null,
      order: 2
    })
  })

  it('moves an item to a parent and normalizes both sibling lists', async () => {
    const folder = await store.createFolder('Destination')
    const first = await store.create('note')
    const moved = await store.create('todo')

    await store.reorderChildren(folder.id, [{ kind: 'item', id: moved.id }])

    expect(await store.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, parentFolderId: null, order: 1 }),
        expect.objectContaining({ id: moved.id, parentFolderId: folder.id, order: 0 })
      ])
    )
  })

  it('promotes direct children when deleting a folder', async () => {
    const before = await store.create('note')
    const folder = await store.createFolder('Delete me')
    const childNote = await store.create('note')
    const childFolder = await store.createFolder('Child', folder.id)
    await store.reorderChildren(folder.id, [
      { kind: 'item', id: childNote.id },
      { kind: 'folder', id: childFolder.id }
    ])

    expect(await store.deleteFolder(folder.id)).toBe(true)

    const items = await store.list()
    const folders = await store.listFolders()
    expect(items.find((item) => item.id === before.id)?.order).toBe(0)
    expect(items.find((item) => item.id === childNote.id)).toMatchObject({
      parentFolderId: null,
      order: 1
    })
    expect(folders.find((entry) => entry.id === childFolder.id)).toMatchObject({
      parentFolderId: null,
      order: 2
    })
    expect(folders.some((entry) => entry.id === folder.id)).toBe(false)
  })

  it('persists detached folder bounds', async () => {
    const folder = await store.createFolder('Window')
    const bounds = { x: 120, y: 80, width: 380, height: 520 }

    const updated = await store.updateFolder(folder.id, folder.revision, {
      detached: true,
      windowBounds: bounds
    })

    expect(updated).toMatchObject({
      status: 'ok',
      value: { detached: true, windowBounds: bounds, revision: 2 }
    })
    expect(await store.listFolders()).toContainEqual(
      expect.objectContaining({ id: folder.id, detached: true, windowBounds: bounds })
    )
  })
})
