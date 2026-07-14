// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderItem, NoteItem } from '../src/shared/models'
import { DetachedFolder } from '../src/renderer/src/pages/DetachedFolder'

const rootFolder: FolderItem = {
  id: 'folder_1',
  title: 'Project',
  parentFolderId: null,
  order: 0,
  collapsed: false,
  detached: true,
  windowBounds: null,
  deletedAt: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

const childFolder: FolderItem = {
  ...rootFolder,
  id: 'folder_2',
  title: 'Child',
  parentFolderId: rootFolder.id,
  detached: false
}

const note: NoteItem = {
  id: 'note_1',
  type: 'note',
  title: 'Nested note',
  contentMarkdown: 'Text',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: childFolder.id,
  tags: [],
  order: 0,
  deletedAt: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

const attachFolder = vi.fn()

beforeEach(() => {
  attachFolder.mockReset()
  Object.defineProperty(window, 'stickyApi', {
    configurable: true,
    value: {
      notes: {
        list: vi.fn().mockResolvedValue([note]),
        create: vi.fn().mockResolvedValue({ ...note, id: 'note_new' }),
        update: vi.fn().mockImplementation(
          async (_id, patch) => ({ ...note, ...patch })
        ),
        delete: vi.fn(),
        addTodoTask: vi.fn(),
        updateTodoTask: vi.fn(),
        deleteTodoTask: vi.fn(),
        reorderTodoTasks: vi.fn()
      },
      folders: {
        list: vi.fn().mockResolvedValue([rootFolder, childFolder]),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        reorderChildren: vi.fn()
      },
      window: {
        attachFolder,
        attach: vi.fn(),
        detach: vi.fn(),
        detachFolder: vi.fn()
      },
      onItemChanged: vi.fn(() => vi.fn()),
      onItemDeleted: vi.fn(() => vi.fn()),
      onDataReloaded: vi.fn(() => vi.fn())
    }
  })
})

describe('DetachedFolder', () => {
  it('shows the full subtree and edits an item in the same window', async () => {
    const { container } = render(<DetachedFolder folderId={rootFolder.id} />)

    expect((await screen.findAllByText(/Project/)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Child/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Nested note'))

    expect(await screen.findByDisplayValue('Nested note')).toBeInTheDocument()
    fireEvent.click(container.querySelector('.editor-header .icon-button')!)

    await waitFor(() => {
      expect(screen.getAllByText(/Project/).length).toBeGreaterThan(0)
      expect(screen.getByText('Nested note')).toBeInTheDocument()
    })
  })

  it('attaches the folder when the window close button is used', async () => {
    render(<DetachedFolder folderId={rootFolder.id} />)

    fireEvent.click(await screen.findByRole('button', {
      name: '关闭文件夹窗口'
    }))

    expect(attachFolder).toHaveBeenCalledWith(rootFolder.id)
  })

  it('can open a nested folder as the detached root', async () => {
    render(<DetachedFolder folderId={childFolder.id} />)

    expect((await screen.findAllByText(/Child/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Nested note')).toBeInTheDocument()
  })

  it('creates a note directly in the detached root folder', async () => {
    render(<DetachedFolder folderId={rootFolder.id} />)

    fireEvent.click(await screen.findByRole('button', { name: '＋ 新建' }))
    fireEvent.click(screen.getByRole('button', { name: /新建笔记/ }))

    await waitFor(() => {
      expect(window.stickyApi.notes.create).toHaveBeenCalledWith(
        'note',
        undefined,
        rootFolder.id
      )
    })
  })

  it('opens the item context menu inside a detached folder', async () => {
    render(<DetachedFolder folderId={rootFolder.id} />)

    fireEvent.contextMenu(await screen.findByText('Nested note'))

    expect(screen.getByRole('menuitem', { name: '编辑' })).toBeInTheDocument()
  })
})
