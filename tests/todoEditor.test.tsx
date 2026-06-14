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
  tasks: [
    {
      id: 'task_1',
      contentMarkdown: 'First',
      completed: false,
      remindAt: null,
      reminded: false
    },
    {
      id: 'task_2',
      contentMarkdown: 'Second',
      completed: false,
      remindAt: null,
      reminded: true
    }
  ],
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

describe('TodoEditor', () => {
  it('updates only the selected task reminder and resets its reminded flag', () => {
    const onUpdateTask = vi.fn()
    render(
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

    const reminderInputs = screen.getAllByLabelText('提醒时间')
    fireEvent.change(reminderInputs[1], {
      target: { value: '2026-06-16T09:30' }
    })

    expect(onUpdateTask).toHaveBeenCalledOnce()
    expect(onUpdateTask).toHaveBeenCalledWith('task_2', {
      remindAt: new Date('2026-06-16T09:30').toISOString(),
      reminded: false
    })
  })

  it('renders one drag handle and one plain text input per task', () => {
    render(
      <TodoEditor
        item={todo}
        onSave={vi.fn()}
        onAddTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onReorderTasks={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getAllByLabelText('拖动排序')).toHaveLength(2)
    expect(screen.getAllByLabelText('任务内容')).toHaveLength(2)
    expect(screen.queryByLabelText('Markdown 编辑器')).not.toBeInTheDocument()
  })

  it('updates task content from the plain text input', () => {
    const onUpdateTask = vi.fn()
    render(
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

    fireEvent.change(screen.getAllByLabelText('任务内容')[0], {
      target: { value: 'Updated task' }
    })

    expect(onUpdateTask).toHaveBeenCalledWith('task_1', {
      contentMarkdown: 'Updated task'
    })
  })
})
