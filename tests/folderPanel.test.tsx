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
  onContextMenu?: ReturnType<typeof vi.fn>
  onDragStateChange?: ReturnType<typeof vi.fn>
} = {}): ReturnType<typeof render> {
  return render(
    <StickyPanel
      items={[note]}
      folders={[folder]}
      onOpen={vi.fn()}
      onToggleTodo={vi.fn()}
      onToggleTodoSubtask={vi.fn()}
      onToggleTodoExpanded={vi.fn()}
      onContextMenu={overrides.onContextMenu ?? vi.fn()}
      onDetach={overrides.onDetach ?? vi.fn()}
      onToggleFolder={vi.fn()}
      onFolderContextMenu={vi.fn()}
      onCreateInFolder={vi.fn()}
      onDetachFolder={overrides.onDetachFolder ?? vi.fn()}
      onReorder={vi.fn()}
      onBeginDrag={vi.fn()}
      onDragStateChange={overrides.onDragStateChange ?? vi.fn()}
    />
  )
}

describe('StickyPanel folders', () => {
  it('renders folder children as title bars without their content', () => {
    renderPanel()

    expect(screen.getByText(/项目资料/)).toBeInTheDocument()
    expect(screen.getByText('文件夹内笔记')).toBeInTheDocument()
    expect(screen.queryByText('这段正文不应在文件夹中显示')).not.toBeInTheDocument()
  })

  it('uses dedicated dnd-kit handles instead of native draggable rows', () => {
    renderPanel()

    expect(screen.getByText('文件夹内笔记').closest('button')).not
      .toHaveAttribute('draggable')
    expect(screen.getByLabelText('拖动文件夹 项目资料')).toBeInTheDocument()
    expect(screen.getByLabelText('拖动笔记 文件夹内笔记')).toBeInTheDocument()
  })

  it('uses the full folder title bar as the dnd-kit activator', () => {
    renderPanel()

    const titleBar = screen.getByText(/项目资料/).closest('.folder-title-bar')
    expect(titleBar).toHaveAttribute('role', 'button')
    expect(titleBar).toHaveAttribute('tabindex', '0')
  })

  it('reports active drag state from the folder title bar', () => {
    const onDragStateChange = vi.fn()
    renderPanel({ onDragStateChange })
    const titleBar = screen.getByText(/项目资料/).closest('.folder-title-bar')!

    fireEvent.keyDown(titleBar, { code: 'Space', key: ' ' })

    expect(onDragStateChange).toHaveBeenCalledWith(true)
  })

  it('opens the shared item context menu for a folder child', () => {
    const onContextMenu = vi.fn()
    renderPanel({ onContextMenu })

    fireEvent.contextMenu(screen.getByText('文件夹内笔记').closest('button')!)

    expect(onContextMenu).toHaveBeenCalledWith(
      note,
      expect.objectContaining({ clientX: 0, clientY: 0 })
    )
  })
})
