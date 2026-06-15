// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { TodoEditor } from '../src/renderer/src/components/TodoEditor'

const todo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: 'Project',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  tasks: [
    {
      id: 'task_1',
      contentMarkdown: 'First',
      completed: false,
      remindAt: null,
      reminded: false,
      tags: [],
      deadlineAt: null,
      deadlineReminders: []
    }
  ],
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

function renderEditor(onUpdateTask = vi.fn()): ReturnType<typeof render> {
  return render(
    <TodoEditor
      item={todo}
      onSave={vi.fn()}
      onAddTask={vi.fn()}
      onUpdateTask={onUpdateTask}
      onDeleteTask={vi.fn()}
      onReorderTasks={vi.fn()}
      onBack={vi.fn()}
      onDelete={vi.fn()}
    />
  )
}

describe('TodoEditor', () => {
  it('shows a compact row with a large checkbox and only two setting buttons', () => {
    renderEditor()

    expect(screen.getByLabelText('完成状态')).toHaveClass('task-complete-checkbox')
    expect(screen.getByLabelText('任务内容')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置提醒' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '设置 DDL' })).toBeInTheDocument()
    expect(screen.queryByLabelText('提醒时间')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('DDL 时间')).not.toBeInTheDocument()
  })

  it('opens reminder settings near the reminder button and saves once', () => {
    const onUpdateTask = vi.fn()
    renderEditor(onUpdateTask)

    fireEvent.click(screen.getByRole('button', { name: '设置提醒' }))
    fireEvent.change(screen.getByLabelText('提醒时间'), {
      target: { value: '2026-06-16T09:30' }
    })

    expect(onUpdateTask).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '保存提醒' }))

    expect(onUpdateTask).toHaveBeenCalledOnce()
    expect(onUpdateTask).toHaveBeenCalledWith('task_1', {
      remindAt: new Date('2026-06-16T09:30').toISOString(),
      reminded: false
    })
    expect(screen.queryByLabelText('提醒时间')).not.toBeInTheDocument()
  })

  it('clears an existing reminder from the popover', () => {
    const onUpdateTask = vi.fn()
    renderEditor(onUpdateTask)

    fireEvent.click(screen.getByRole('button', { name: '设置提醒' }))
    fireEvent.click(screen.getByRole('button', { name: '清除提醒' }))

    expect(onUpdateTask).toHaveBeenCalledWith('task_1', {
      remindAt: null,
      reminded: false
    })
  })

  it('opens DDL settings and saves the deadline with selected reminders once', () => {
    const onUpdateTask = vi.fn()
    renderEditor(onUpdateTask)

    fireEvent.click(screen.getByRole('button', { name: '设置 DDL' }))
    fireEvent.change(screen.getByLabelText('DDL 时间'), {
      target: { value: '2026-06-20T18:00' }
    })
    fireEvent.click(screen.getByRole('button', { name: '提前 3 天' }))
    fireEvent.click(screen.getByRole('button', { name: '提前 6 小时' }))

    expect(onUpdateTask).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '保存 DDL' }))

    expect(onUpdateTask).toHaveBeenCalledOnce()
    expect(onUpdateTask).toHaveBeenCalledWith('task_1', {
      deadlineAt: new Date('2026-06-20T18:00').toISOString(),
      deadlineReminders: [
        {
          id: 'preset-4320',
          offsetMinutes: 4320,
          remindedAt: null
        },
        {
          id: 'preset-360',
          offsetMinutes: 360,
          remindedAt: null
        }
      ]
    })
  })

  it('switches from reminder to DDL and clears the deadline', () => {
    const onUpdateTask = vi.fn()
    renderEditor(onUpdateTask)

    fireEvent.click(screen.getByRole('button', { name: '设置提醒' }))
    expect(screen.getByRole('dialog', { name: '提醒设置' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '设置 DDL' }))
    expect(screen.queryByRole('dialog', { name: '提醒设置' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'DDL 设置' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '清除 DDL' }))
    expect(onUpdateTask).toHaveBeenCalledWith('task_1', {
      deadlineAt: null,
      deadlineReminders: []
    })
  })

  it('closes reminder settings without saving on cancel or Escape', () => {
    const onUpdateTask = vi.fn()
    renderEditor(onUpdateTask)

    fireEvent.click(screen.getByRole('button', { name: '设置提醒' }))
    fireEvent.change(screen.getByLabelText('提醒时间'), {
      target: { value: '2026-06-16T09:30' }
    })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onUpdateTask).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: '提醒设置' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '设置提醒' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '提醒设置' })).not.toBeInTheDocument()
    expect(onUpdateTask).not.toHaveBeenCalled()
  })
})
