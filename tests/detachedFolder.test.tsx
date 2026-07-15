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
  revision: 1,
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
  siyuanDelivery: null,
  siyuanDeliveryDisabled: false,
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
        update: vi.fn().mockImplementation(async (_id, _revision, patch) => ({
          status: 'ok',
          value: { ...note, ...patch, revision: 2 }
        })),
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
      siyuan: {
        sendNote: vi.fn().mockResolvedValue({
          status: 'sent',
          documentId: 'doc-1',
          item: {
            ...note,
            revision: 2,
            siyuanDelivery: {
              notebookId: 'inbox',
              documentId: 'doc-1',
              sentAt: '2026-07-14T12:00:00.000Z',
              contentFingerprint: 'fingerprint'
            }
          }
        })
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
    expect(screen.queryByRole('menuitem', { name: '发送到思源' }))
      .not.toBeInTheDocument()
  })

  it('disables SiYuan delivery from a nested note context menu', async () => {
    render(<DetachedFolder folderId={rootFolder.id} />)

    fireEvent.contextMenu(await screen.findByText('Nested note'))
    fireEvent.click(screen.getByRole('menuitem', {
      name: '禁止投送到思源'
    }))

    expect(window.stickyApi.notes.update).toHaveBeenCalledWith(
      note.id,
      note.revision,
      { siyuanDeliveryDisabled: true }
    )
  })

  it('sends a nested note from beside its title and reports success', async () => {
    render(<DetachedFolder folderId={rootFolder.id} />)

    fireEvent.click(await screen.findByRole('button', { name: '发送到思源' }))

    await waitFor(() => {
      expect(window.stickyApi.siyuan.sendNote).toHaveBeenCalledWith(note.id)
    })
    expect(await screen.findByRole('status', { name: '思源发送结果' }))
      .toHaveTextContent('已发送到思源：Nested note')
  })

  it('keeps delivery feedback visible while editing a nested note', async () => {
    render(<DetachedFolder folderId={rootFolder.id} />)

    fireEvent.click(await screen.findByText('Nested note'))
    fireEvent.click(await screen.findByRole('button', { name: '发送到思源' }))

    expect(await screen.findByRole('status', { name: '思源发送结果' }))
      .toHaveTextContent('已发送到思源：Nested note')
  })
})
