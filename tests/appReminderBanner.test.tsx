// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StickyApi } from '../src/shared/electronApi'
import type { TodoItem } from '../src/shared/models'
import App from '../src/renderer/src/App'

const todo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: '交互设计作业',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  panelExpanded: false,
  tasks: [{
    id: 'task_1',
    contentMarkdown: '提交原型图',
    completed: false,
    tags: [],
    importance: 'important',
    urgency: 'urgent',
    children: [],
    schedule: null
  }],
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

let reminderCallback:
  | ((payload: {
      itemId?: string
      title: string
      body: string
      createdAt: string
    }) => void)
  | null = null

function makeApi(): StickyApi {
  return {
    notes: {
      list: vi.fn().mockResolvedValue([todo]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      addTodoTask: vi.fn(),
      updateTodoTask: vi.fn(),
      deleteTodoTask: vi.fn(),
      reorderTodoTasks: vi.fn(),
      addTodoSubtask: vi.fn(),
      updateTodoSubtask: vi.fn(),
      deleteTodoSubtask: vi.fn()
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
      selectImage: vi.fn(),
      importImageData: vi.fn()
    },
    folders: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      moveItem: vi.fn(),
      reorderChildren: vi.fn()
    },
    recycle: {
      list: vi.fn(),
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
      detachFolder: vi.fn(),
      attachFolder: vi.fn(),
      openExternal: vi.fn()
    },
    onOpenEditor: vi.fn().mockReturnValue(() => undefined),
    onItemChanged: vi.fn().mockReturnValue(() => undefined),
    onItemDeleted: vi.fn().mockReturnValue(() => undefined),
    onReminderFired: vi.fn((callback) => {
      reminderCallback = callback
      return () => {
        reminderCallback = null
      }
    })
  }
}

describe('App reminder banner', () => {
  beforeEach(() => {
    reminderCallback = null
    Object.defineProperty(window, 'stickyApi', {
      configurable: true,
      value: makeApi()
    })
  })

  it('shows an in-app urgent reminder and opens the related todo', async () => {
    render(<App />)
    await screen.findByText('交互设计作业')

    act(() => {
      reminderCallback?.({
        itemId: 'todo_1',
        title: '提交原型图',
        body: '截止时间已到',
        createdAt: '2026-06-20T12:00:00.000Z'
      })
    })

    expect(screen.getByRole('alert')).toHaveTextContent('提交原型图')
    expect(screen.getByRole('alert')).toHaveTextContent('截止时间已到')
    expect(screen.getByRole('alert')).toHaveClass('reminder-alert-strong')
    expect(screen.getByText('待办强提醒')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '查看' }))

    expect(await screen.findByLabelText('标题')).toHaveValue('交互设计作业')
  })
})
