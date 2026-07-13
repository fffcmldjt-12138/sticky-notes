import { describe, expect, it } from 'vitest'
import type { OrderedNodeRef } from '../src/shared/models'
import type { NoteItem } from '../src/shared/models'
import { render, screen } from '@testing-library/react'
import { TreeDragOverlay } from '../src/renderer/src/components/TreeDragOverlay'
import {
  toDragPreviewPayload,
  treeDragVisualState
} from '../src/renderer/src/components/TreeDndContext'
import {
  resolveTreeDragOutcome,
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

  it('detaches outside the window even when dnd-kit reports a drop target', () => {
    expect(resolveTreeDragOutcome(true, true)).toBe('detach')
    expect(resolveTreeDragOutcome(false, true)).toBe('drop')
    expect(resolveTreeDragOutcome(false, false)).toBe('cancel')
  })

  it('renders a visual card overlay with type title and header color', () => {
    const item: NoteItem = {
      id: 'note_1',
      type: 'note',
      title: '视觉预览',
      contentMarkdown: '',
      headerColor: '#f2c94c',
      bodyTheme: 'light',
      pinned: false,
      detached: false,
      windowBounds: null,
      parentFolderId: null,
      tags: [],
      order: 0,
      deletedAt: null,
      syncedToSiyuan: false,
      createdAt: '',
      updatedAt: ''
    }
    render(
      <TreeDragOverlay
        active={{ kind: 'item', node: { kind: 'item', id: item.id }, item }}
      />
    )

    expect(screen.getByText('笔记')).toBeInTheDocument()
    expect(screen.getByText('视觉预览')).toBeInTheDocument()
    expect(screen.getByTestId('tree-drag-overlay')).toHaveStyle({
      '--drag-header-color': '#f2c94c'
    })
  })

  it('builds a native drag preview payload for dragged items', () => {
    const item: NoteItem = {
      id: 'note_1',
      type: 'note',
      title: '视觉预览',
      contentMarkdown: '',
      headerColor: '#f2c94c',
      bodyTheme: 'light',
      pinned: false,
      detached: false,
      windowBounds: null,
      parentFolderId: null,
      tags: [],
      order: 0,
      deletedAt: null,
      syncedToSiyuan: false,
      createdAt: '',
      updatedAt: ''
    }

    expect(toDragPreviewPayload({
      kind: 'item',
      node: { kind: 'item', id: item.id },
      item
    })).toEqual({
      kind: 'item',
      itemType: 'note',
      title: '视觉预览',
      headerColor: '#f2c94c',
      bodyTheme: 'light'
    })
  })

  it('suppresses internal drag feedback after the pointer leaves the panel', () => {
    expect(treeDragVisualState(true, false)).toEqual({
      className: 'tree-dnd-surface',
      showOverlay: true
    })
    expect(treeDragVisualState(true, true)).toEqual({
      className: 'tree-dnd-surface outside-drag',
      showOverlay: false
    })
  })
})
// @vitest-environment jsdom
