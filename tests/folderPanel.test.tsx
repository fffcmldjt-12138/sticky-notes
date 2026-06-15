// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FolderItem, NoteItem } from '../src/shared/models'
import { StickyPanel } from '../src/renderer/src/pages/StickyPanel'

const folder: FolderItem = {
  id: 'folder_1',
  title: '项目资料',
  parentFolderId: null,
  order: 0,
  collapsed: false,
  detached: false,
  windowBounds: null,
  deletedAt: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

const note: NoteItem = {
  id: 'note_1',
  type: 'note',
  title: '文件夹内笔记',
  contentMarkdown: '这段正文不应在文件夹中显示',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: folder.id,
  tags: [],
  order: 0,
  deletedAt: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

function renderPanel(overrides: {
  onDetach?: ReturnType<typeof vi.fn>
  onDetachFolder?: ReturnType<typeof vi.fn>
} = {}): ReturnType<typeof render> {
  return render(
    <StickyPanel
      items={[note]}
      folders={[folder]}
      onOpen={vi.fn()}
      onToggleTodo={vi.fn()}
      onContextMenu={vi.fn()}
      onDetach={overrides.onDetach ?? vi.fn()}
      onToggleFolder={vi.fn()}
      onFolderContextMenu={vi.fn()}
      onDetachFolder={overrides.onDetachFolder ?? vi.fn()}
      onReorder={vi.fn()}
    />
  )
}

function dragEndOutside(element: Element): void {
  const event = new Event('dragend', { bubbles: true })
  Object.defineProperties(event, {
    clientX: { value: -1 },
    clientY: { value: 100 }
  })
  fireEvent(element, event)
}

describe('StickyPanel folders', () => {
  it('renders folder children as title bars without their content', () => {
    renderPanel()

    expect(screen.getByText(/项目资料/)).toBeInTheDocument()
    expect(screen.getByText('文件夹内笔记')).toBeInTheDocument()
    expect(screen.queryByText('这段正文不应在文件夹中显示')).not.toBeInTheDocument()
  })

  it('detaches a folder child item when its drag ends outside the panel', () => {
    const onDetach = vi.fn()
    renderPanel({ onDetach })

    dragEndOutside(screen.getByText('文件夹内笔记').closest('button')!)

    expect(onDetach).toHaveBeenCalledWith(note)
  })

  it('detaches a folder when its title drag ends outside the panel', () => {
    const onDetachFolder = vi.fn()
    renderPanel({ onDetachFolder })

    dragEndOutside(screen.getByText(/项目资料/).closest('.folder-title-bar')!)

    expect(onDetachFolder).toHaveBeenCalledWith(
      expect.objectContaining({ id: folder.id })
    )
  })
})
