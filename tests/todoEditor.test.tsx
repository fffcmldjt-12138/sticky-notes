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
  panelExpanded: false,
  tasks: [{
    id: 'task_1',
    contentMarkdown: 'First',
    completed: false,
    tags: [],
    importance: 'normal',
    urgency: 'normal',
    children: [{
      id: 'subtask_1',
      contentMarkdown: 'Detail',
      completed: true,
      tags: [],
      importance: 'normal',
      urgency: 'urgent',
      schedule: null
    }],
    schedule: null
  }],
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

function renderEditor(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  return render(
    <TodoEditor
      item={todo}
      onSave={vi.fn()}
      onAddTask={vi.fn()}
      onUpdateTask={overrides.onUpdateTask ?? vi.fn()}
      onDeleteTask={vi.fn()}
      onReorderTasks={vi.fn()}
      onAddSubtask={overrides.onAddSubtask ?? vi.fn()}
      onUpdateSubtask={overrides.onUpdateSubtask ?? vi.fn()}
      onDeleteSubtask={overrides.onDeleteSubtask ?? vi.fn()}
      onBack={vi.fn()}
      onDelete={vi.fn()}
    />
  )
}

describe('TodoEditor', () => {
  it('uses one schedule button and exposes quadrant selection', () => {
    renderEditor()

    expect(screen.getByRole('button', { name: '时间设置' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '设置提醒' })).not
      .toBeInTheDocument()
    expect(screen.getByLabelText('任务四象限')).toBeInTheDocument()
  })

  it('updates a task quadrant', () => {
    const onUpdateTask = vi.fn()
    renderEditor({ onUpdateTask })

    fireEvent.change(screen.getByLabelText('任务四象限'), {
      target: { value: 'important-urgent' }
    })

    expect(onUpdateTask).toHaveBeenCalledWith('task_1', {
      importance: 'important',
      urgency: 'urgent'
    })
  })

  it('adds and edits one-level subtasks without a nested add action', () => {
    const onAddSubtask = vi.fn()
    renderEditor({ onAddSubtask })

    fireEvent.click(screen.getByRole('button', { name: '添加子待办' }))

    expect(onAddSubtask).toHaveBeenCalledWith('task_1')
    expect(screen.getByLabelText('子待办内容')).toHaveValue('Detail')
    expect(screen.getAllByRole('button', { name: '添加子待办' })).toHaveLength(1)
  })

  it('styles completed subtasks with a strike-through class', () => {
    const { container } = renderEditor()

    expect(container.querySelector('.todo-subtask-row.completed')).toBeTruthy()
  })
})
