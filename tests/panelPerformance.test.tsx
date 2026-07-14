// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FolderItem, NoteItem, StickyItem, TodoItem } from '../src/shared/models'
import { StickyPanel } from '../src/renderer/src/pages/StickyPanel'

describe('StickyPanel render regression', () => {
  it('does not rerender every root card when one item changes', () => {
    const notes = Array.from({ length: 500 }, (_, index) => makeNote(index))
    const todo = makeTodo(1000)
    const folders = makeFolders()
    const items: StickyItem[] = [...notes, todo]
    const renders = vi.fn()
    const props = {
      folders,
      onOpen: vi.fn(), onToggleTodo: vi.fn(), onToggleTodoSubtask: vi.fn(),
      onToggleTodoExpanded: vi.fn(), onContextMenu: vi.fn(), onDetach: vi.fn(),
      onToggleFolder: vi.fn(), onFolderContextMenu: vi.fn(),
      onCreateInFolder: vi.fn(), onDetachFolder: vi.fn(), onReorder: vi.fn(),
      onCardRender: renders
    }
    const view = render(<StickyPanel {...props} items={items} />)
    expect(renders.mock.calls.length).toBeGreaterThan(500)
    renders.mockClear()

    const changed = { ...notes[0], title: 'changed', revision: 2 }
    view.rerender(
      <StickyPanel {...props} items={[changed, ...items.slice(1)]} />
    )

    expect(
      renders.mock.calls
        .filter(([, duration]) => duration > 0)
        .map(([id]) => id)
    ).toEqual([changed.id])
  })
})

function makeNote(index: number): NoteItem {
  return {
    id: `note_${index}`, revision: 1, type: 'note', title: `Note ${index}`,
    contentMarkdown: '', headerColor: '#f2c94c', bodyTheme: 'light',
    pinned: false, detached: false, windowBounds: null, parentFolderId: null,
    tags: [], order: index, deletedAt: null, siyuanDelivery: null,
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z'
  }
}

function makeTodo(taskCount: number): TodoItem {
  return {
    ...makeNote(9999), id: 'todo_perf', type: 'todo', panelExpanded: false,
    tasks: Array.from({ length: taskCount }, (_, index) => ({
      id: `task_${index}`, contentMarkdown: `Task ${index}`, completed: false,
      tags: [], importance: 'normal' as const, urgency: 'normal' as const,
      children: [], schedule: null
    }))
  } as TodoItem
}

function makeFolders(): FolderItem[] {
  return Array.from({ length: 3 }, (_, index) => ({
    id: `folder_${index}`, revision: 1, title: `Folder ${index}`,
    parentFolderId: index === 0 ? null : `folder_${index - 1}`, order: 600 + index,
    collapsed: false, detached: false, windowBounds: null, deletedAt: null,
    createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z'
  }))
}
