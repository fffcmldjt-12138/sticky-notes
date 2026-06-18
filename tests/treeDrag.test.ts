import { describe, expect, it } from 'vitest'
import type { OrderedNodeRef } from '../src/shared/models'
import {
  pointOutsideViewport,
  resolveTreeDrop
} from '../src/renderer/src/lib/treeDrag'

const siblings: OrderedNodeRef[] = [
  { kind: 'item', id: 'note_1' },
  { kind: 'folder', id: 'folder_1' },
  { kind: 'item', id: 'todo_1' }
]

describe('resolveTreeDrop', () => {
  it('inserts a node between siblings', () => {
    expect(resolveTreeDrop(
      { kind: 'item', id: 'todo_1' },
      { parentFolderId: null, index: 1 },
      siblings
    )).toEqual({
      parentFolderId: null,
      orderedNodes: [
        { kind: 'item', id: 'note_1' },
        { kind: 'item', id: 'todo_1' },
        { kind: 'folder', id: 'folder_1' }
      ]
    })
  })

  it('appends a node when moving into a folder', () => {
    expect(resolveTreeDrop(
      { kind: 'item', id: 'note_1' },
      { parentFolderId: 'folder_1', index: 2 },
      [
        { kind: 'item', id: 'inside_1' },
        { kind: 'item', id: 'inside_2' }
      ]
    )).toEqual({
      parentFolderId: 'folder_1',
      orderedNodes: [
        { kind: 'item', id: 'inside_1' },
        { kind: 'item', id: 'inside_2' },
        { kind: 'item', id: 'note_1' }
      ]
    })
  })

  it('returns null when dropping at the existing position', () => {
    expect(resolveTreeDrop(
      { kind: 'folder', id: 'folder_1' },
      { parentFolderId: null, index: 1 },
      siblings
    )).toBeNull()
  })

  it('detects pointer movement beyond the application window', () => {
    expect(pointOutsideViewport(
      { x: -1, y: 200 },
      { width: 400, height: 600 }
    )).toBe(true)
    expect(pointOutsideViewport(
      { x: 399, y: 599 },
      { width: 400, height: 600 }
    )).toBe(false)
  })
})
