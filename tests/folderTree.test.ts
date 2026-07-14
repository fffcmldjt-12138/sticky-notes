import { describe, expect, it } from 'vitest'
import type { FolderItem, NoteItem, TodoItem } from '../src/shared/models'
import { buildFolderTree } from '../src/renderer/src/lib/folderTree'

const baseFolder = {
  revision: 1,
  order: 0,
  collapsed: false,
  detached: false,
  windowBounds: null,
  deletedAt: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

const folders: FolderItem[] = [
  { ...baseFolder, id: 'f1', title: '一级', parentFolderId: null },
  { ...baseFolder, id: 'f2', title: '二级', parentFolderId: 'f1' },
  { ...baseFolder, id: 'f3', title: '三级', parentFolderId: 'f2' }
]

const note: NoteItem = {
  revision: 1,
  id: 'note_1',
  type: 'note',
  title: 'Nested note',
  contentMarkdown: 'Hidden content',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: 'f3',
  tags: [],
  order: 0,
  deletedAt: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

describe('buildFolderTree', () => {
  it('builds three levels and counts descendant items', () => {
    const tree = buildFolderTree(folders, [note])

    expect(tree.folders[0].children[0].children[0].items).toEqual([note])
    expect(tree.folders[0].descendantItemCount).toBe(1)
    expect(tree.rootItems).toEqual([])
  })

  it('exposes items and folders in one mixed order', () => {
    const rootNote = { ...note, id: 'root-note', parentFolderId: null, order: 0 }
    const rootFolder = { ...folders[0], order: 1 }
    const laterNote = { ...note, id: 'later-note', parentFolderId: null, order: 2 }

    const tree = buildFolderTree([rootFolder], [laterNote, rootNote])

    expect(tree.entries.map((entry) => `${entry.kind}:${entry.id}`)).toEqual([
      'item:root-note',
      'folder:f1',
      'item:later-note'
    ])
  })

  it('places pinned items before every unpinned sibling', () => {
    const pinned = {
      ...note,
      id: 'pinned',
      parentFolderId: null,
      order: 3,
      pinned: true
    }
    const rootFolder = { ...folders[0], order: 0 }

    const tree = buildFolderTree([rootFolder], [pinned])

    expect(tree.entries.map((entry) => entry.id)).toEqual(['pinned', 'f1'])
  })

  it('places important urgent todo cards before ordinary siblings', () => {
    const rootNote = { ...note, parentFolderId: null, order: 0 }
    const todo: TodoItem = {
      ...note,
      id: 'todo_1',
      type: 'todo',
      title: 'Urgent',
      parentFolderId: null,
      order: 2,
      panelExpanded: false,
      tasks: [{
        id: 'task_1',
        contentMarkdown: 'Now',
        completed: false,
        tags: [],
        importance: 'important',
        urgency: 'urgent',
        children: [],
        schedule: null
      }]
    }

    const tree = buildFolderTree([], [rootNote, todo])

    expect(tree.entries.map((entry) => entry.id)).toEqual(['todo_1', 'note_1'])
  })
})
