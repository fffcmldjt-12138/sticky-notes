// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StickyApi } from '../src/shared/electronApi'
import type { NoteItem } from '../src/shared/models'
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
  syncedToSiyuan: false,
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
      window: {
        expand: vi.fn(),
        scheduleCollapse: vi.fn(),
        cancelCollapse: vi.fn(),
        hide: vi.fn(),
        suspendAutoHide: vi.fn(),
        detach: vi.fn(),
        attach: vi.fn()
      },
      onOpenEditor: vi.fn().mockReturnValue(() => undefined),
      onItemChanged: vi.fn().mockReturnValue(() => undefined),
      onItemDeleted: vi.fn().mockReturnValue(() => undefined)
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
    expect(window.stickyApi.notes.create).toHaveBeenCalledWith('note', undefined)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByLabelText('标题')).toHaveValue('新建笔记')
  })
})
