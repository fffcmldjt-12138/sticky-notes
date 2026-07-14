// @vitest-environment jsdom

import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/renderer/src/App'
import { DetachedEditor } from '../src/renderer/src/pages/DetachedEditor'
import { DetachedFolder } from '../src/renderer/src/pages/DetachedFolder'
import type { FolderItem, NoteItem } from '../src/shared/models'

const note: NoteItem = {
  revision: 1,
  id: 'note_1',
  type: 'note',
  title: 'Reloaded note',
  contentMarkdown: '',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: true,
  windowBounds: null,
  parentFolderId: 'folder_1',
  tags: [],
  order: 0,
  deletedAt: null,
  syncedToSiyuan: false,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
}

const folder: FolderItem = {
  revision: 1,
  id: 'folder_1',
  title: 'Reloaded folder',
  parentFolderId: null,
  order: 0,
  collapsed: false,
  detached: true,
  windowBounds: null,
  deletedAt: null,
  createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
}

function installApi() {
  let reload: ((reason: 'restore' | 'import') => void) | undefined
  const notesList = vi.fn().mockResolvedValue([note])
  const foldersList = vi.fn().mockResolvedValue([folder])
  const api = {
    notes: {
      list: notesList,
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      addTodoTask: vi.fn(), updateTodoTask: vi.fn(), deleteTodoTask: vi.fn(),
      reorderTodoTasks: vi.fn(), addTodoSubtask: vi.fn(),
      updateTodoSubtask: vi.fn(), deleteTodoSubtask: vi.fn()
    },
    folders: {
      list: foldersList,
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      moveItem: vi.fn(), reorderChildren: vi.fn()
    },
    config: {
      get: vi.fn().mockResolvedValue({
        version: 1, autoLaunch: false, panelPosition: 'right', alwaysOnTop: true
      }),
      update: vi.fn()
    },
    window: {
      expand: vi.fn(), scheduleCollapse: vi.fn(), cancelCollapse: vi.fn(),
      hide: vi.fn(), suspendAutoHide: vi.fn(), detach: vi.fn(), attach: vi.fn(),
      detachFolder: vi.fn(), attachFolder: vi.fn(), openExternal: vi.fn()
    },
    onOpenEditor: vi.fn(() => vi.fn()),
    onOpenItem: vi.fn(() => vi.fn()),
    onItemChanged: vi.fn(() => vi.fn()),
    onItemDeleted: vi.fn(() => vi.fn()),
    onFolderChanged: vi.fn(() => vi.fn()),
    onFolderDeleted: vi.fn(() => vi.fn()),
    onReminderFired: vi.fn(() => vi.fn()),
    onDataReloaded: vi.fn((callback: typeof reload) => {
      reload = callback
      return vi.fn()
    })
  }
  Object.defineProperty(window, 'stickyApi', { configurable: true, value: api })
  return { notesList, foldersList, fireReload: () => reload?.('restore') }
}

describe('data reload subscriptions', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))

  it('fully refetches the main window once per broadcast', async () => {
    const { notesList, foldersList, fireReload } = installApi()
    render(<App />)
    await waitFor(() => expect(notesList).toHaveBeenCalledOnce())

    await act(async () => fireReload())

    await waitFor(() => expect(notesList).toHaveBeenCalledTimes(2))
    expect(foldersList).toHaveBeenCalledTimes(2)
  })

  it('fully refetches a detached editor', async () => {
    const { notesList, fireReload } = installApi()
    render(<DetachedEditor itemId={note.id} />)
    await screen.findByText('Reloaded note')

    await act(async () => fireReload())

    await waitFor(() => expect(notesList).toHaveBeenCalledTimes(2))
  })

  it('fully refetches a detached folder', async () => {
    const { notesList, foldersList, fireReload } = installApi()
    render(<DetachedFolder folderId={folder.id} />)
    await screen.findAllByText('Reloaded folder')

    await act(async () => fireReload())

    await waitFor(() => expect(notesList).toHaveBeenCalledTimes(2))
    expect(foldersList).toHaveBeenCalledTimes(2)
  })
})
