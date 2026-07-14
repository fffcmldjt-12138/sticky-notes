// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StickyApi } from '../src/shared/electronApi'
import type { FolderItem, NoteItem } from '../src/shared/models'
import App from '../src/renderer/src/App'

const createdNote: NoteItem = {
  id: 'note_1',
  type: 'note',
  title: '新建笔记',
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
  siyuanDelivery: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

const createdFolder: FolderItem = {
  id: 'folder_1',
  title: '项目资料',
  parentFolderId: null,
  order: 0,
  collapsed: false,
  deletedAt: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

describe('App creation flow', () => {
  beforeEach(() => {
    const api: StickyApi = {
      notes: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(createdNote),
        update: vi.fn().mockResolvedValue(createdNote),
        delete: vi.fn().mockResolvedValue(true),
        addTodoTask: vi.fn().mockResolvedValue(null),
        updateTodoTask: vi.fn().mockResolvedValue(null),
        deleteTodoTask: vi.fn().mockResolvedValue(null),
        reorderTodoTasks: vi.fn().mockResolvedValue(null)
      },
      config: {
        get: vi.fn().mockResolvedValue({
          version: 1,
          autoLaunch: false,
          panelPosition: 'right',
          alwaysOnTop: true
        }),
        update: vi.fn()
      },
      assets: {
        selectImage: vi.fn().mockResolvedValue(null),
        importImageData: vi.fn()
      },
      siyuan: {
        getSettings: vi.fn(),
        updateSettings: vi.fn(),
        testConnection: vi.fn(),
        sendNote: vi.fn()
      },
      folders: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(createdFolder),
        update: vi.fn(),
        moveItem: vi.fn()
      },
      recycle: {
        list: vi.fn().mockResolvedValue({ items: [], folders: [] }),
        restoreItem: vi.fn(),
        restoreFolder: vi.fn(),
        empty: vi.fn(),
        cleanUnusedImages: vi.fn()
      },
      window: {
        expand: vi.fn(),
        scheduleCollapse: vi.fn(),
        cancelCollapse: vi.fn(),
        hide: vi.fn(),
        suspendAutoHide: vi.fn(),
        detach: vi.fn(),
        attach: vi.fn(),
        openExternal: vi.fn()
      },
      onOpenEditor: vi.fn().mockReturnValue(() => undefined),
      onItemChanged: vi.fn().mockReturnValue(() => undefined),
      onItemDeleted: vi.fn().mockReturnValue(() => undefined),
      onDataReloaded: vi.fn().mockReturnValue(() => undefined)
    }
    Object.defineProperty(window, 'stickyApi', {
      configurable: true,
      value: api
    })
  })

  it('creates one note without opening a title dialog', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /新建/ }))
    fireEvent.click(screen.getByRole('button', { name: /新建笔记/ }))

    await waitFor(() => {
      expect(window.stickyApi.notes.create).toHaveBeenCalledOnce()
    })
    expect(window.stickyApi.notes.create).toHaveBeenCalledWith(
      'note',
      undefined,
      null
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('标题', {}, { timeout: 5000 }))
      .toHaveValue('新建笔记')
  })

  it('creates one folder through an in-app name dialog', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /新建/ }))
    fireEvent.click(screen.getByRole('button', { name: /新建文件夹/ }))

    const input = await screen.findByRole('textbox', { name: '文件夹名称' })
    fireEvent.change(input, { target: { value: '项目资料' } })
    const confirm = screen.getByRole('button', { name: '确认' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(window.stickyApi.folders.create).toHaveBeenCalledOnce()
    })
    expect(window.stickyApi.folders.create).toHaveBeenCalledWith('项目资料', null)
    expect(screen.getByText(/项目资料/)).toBeInTheDocument()
  })

  it('shows visible feedback after sending a note from its title', async () => {
    vi.mocked(window.stickyApi.notes.list).mockResolvedValue([createdNote])
    vi.mocked(window.stickyApi.siyuan.sendNote).mockResolvedValue({
      status: 'sent',
      documentId: 'doc-1',
      item: {
        ...createdNote,
        revision: 2,
        siyuanDelivery: {
          notebookId: 'inbox',
          documentId: 'doc-1',
          sentAt: '2026-07-14T12:00:00.000Z',
          contentFingerprint: 'fingerprint'
        }
      }
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '发送到思源' }))

    expect(await screen.findByRole('status', {
      name: '思源发送结果'
    })).toHaveTextContent('已发送到思源：新建笔记')
  })

  it('shows the error and leaves title delivery retryable', async () => {
    vi.mocked(window.stickyApi.notes.list).mockResolvedValue([createdNote])
    vi.mocked(window.stickyApi.siyuan.sendNote)
      .mockRejectedValue(new Error('思源未启动'))
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: '发送到思源' }))

    expect(await screen.findByRole('alert', {
      name: '思源发送结果'
    })).toHaveTextContent('发送失败：思源未启动')
    expect(screen.getByRole('button', { name: '重试发送到思源' }))
      .toBeEnabled()
  })
})
