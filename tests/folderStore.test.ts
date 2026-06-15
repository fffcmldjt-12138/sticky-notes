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

  it('moves notes and todos into a folder', async () => {
    const folder = await store.createFolder('项目')
    const note = await store.create('note')
    const todo = await store.create('todo')

    await store.moveItem(note.id, folder.id)
    await store.moveItem(todo.id, folder.id)

    expect(await store.list()).toEqual([
      expect.objectContaining({ id: todo.id, parentFolderId: folder.id }),
      expect.objectContaining({ id: note.id, parentFolderId: folder.id })
    ])
  })

  it('rejects moving a folder tree when descendants would exceed three levels', async () => {
    const destination = await store.createFolder('目标一级')
    const destinationChild = await store.createFolder('目标二级', destination.id)
    const moving = await store.createFolder('待移动一级')
    await store.createFolder('待移动二级', moving.id)

    await expect(
      store.updateFolder(moving.id, { parentFolderId: destinationChild.id })
    ).rejects.toThrow('文件夹最多嵌套 3 层')
  })
})
