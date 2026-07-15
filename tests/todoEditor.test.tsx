// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { TodoEditor } from '../src/renderer/src/components/TodoEditor'

const todo: TodoItem = {
  id: 'todo_1',
  revision: 1,
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
      onAddTask={overrides.onAddTask ?? vi.fn()}
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

    expect(onUpdateTask).toHaveBeenCalledWith('task_1', null, {
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

  it('toggles a subtask from its checkbox', () => {
    const onUpdateSubtask = vi.fn()
    const { container } = renderEditor({ onUpdateSubtask })

    fireEvent.click(
      container.querySelector('.todo-subtask-row input[type="checkbox"]')!
    )

    expect(onUpdateSubtask).toHaveBeenCalledWith('task_1', 'subtask_1', null, {
      completed: false
    })
  })

  it('focuses the newest task input after a task is added', async () => {
    const view = renderEditor()
    const added: TodoItem = {
      ...todo,
      tasks: [
        ...todo.tasks,
        {
          id: 'task_2',
          contentMarkdown: '',
          completed: false,
          tags: [],
          importance: 'normal',
          urgency: 'normal',
          children: [],
          schedule: null
        }
      ]
    }

    view.rerender(
      <TodoEditor
        item={added}
        onSave={vi.fn()}
        onAddTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onReorderTasks={vi.fn()}
        onAddSubtask={vi.fn()}
        onUpdateSubtask={vi.fn()}
        onDeleteSubtask={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await waitFor(() => {
      const taskInputs = view.container.querySelectorAll('.task-content-input')
      expect(taskInputs[taskInputs.length - 1]).toHaveFocus()
    })
  })

  it('renders and focuses a new task before persistence resolves', async () => {
    let resolveAdd!: (value: TodoItem['tasks'][number]) => void
    const onAddTask = vi.fn(() => new Promise<TodoItem['tasks'][number]>((resolve) => {
      resolveAdd = resolve
    }))
    const view = renderEditor({ onAddTask })

    fireEvent.click(screen.getByRole('button', { name: /添加任务/ }))

    const inputs = screen.getAllByLabelText('任务内容')
    expect(inputs).toHaveLength(2)
    expect(inputs[1]).toHaveFocus()
    expect(onAddTask).toHaveBeenCalledOnce()

    resolveAdd({
      id: 'task_2', contentMarkdown: '', completed: false, tags: [],
      importance: 'normal', urgency: 'normal', children: [], schedule: null
    })
  })

  it('focuses the first empty task when a new todo opens', async () => {
    const fresh: TodoItem = {
      ...todo,
      tasks: [{
        id: 'task_new',
        contentMarkdown: '',
        completed: false,
        tags: [],
        importance: 'normal',
        urgency: 'normal',
        children: [],
        schedule: null
      }]
    }

    const view = render(
      <TodoEditor
        item={fresh}
        onSave={vi.fn()}
        onAddTask={vi.fn()}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onReorderTasks={vi.fn()}
        onAddSubtask={vi.fn()}
        onUpdateSubtask={vi.fn()}
        onDeleteSubtask={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(view.container.querySelector('.task-content-input')).toHaveFocus()
    })
  })

  it('asks for one blank task when an older empty todo is opened', () => {
    const onAddTask = vi.fn()
    render(
      <TodoEditor
        item={{ ...todo, tasks: [] }}
        onSave={vi.fn()}
        onAddTask={onAddTask}
        onUpdateTask={vi.fn()}
        onDeleteTask={vi.fn()}
        onReorderTasks={vi.fn()}
        onAddSubtask={vi.fn()}
        onUpdateSubtask={vi.fn()}
        onDeleteSubtask={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(onAddTask).toHaveBeenCalledOnce()
  })

  it('edits the persisted replacement after the final task is deleted', async () => {
    const replacement: TodoItem = {
      ...todo,
      revision: 2,
      tasks: [{
        id: 'task_replacement',
        contentMarkdown: '',
        completed: false,
        tags: [],
        importance: 'normal',
        urgency: 'normal',
        children: [],
        schedule: null
      }]
    }
    const onUpdateTask = vi.fn().mockResolvedValue({
      status: 'ok',
      value: { ...replacement, revision: 3 }
    })
    const props = {
      onSave: vi.fn(),
      onAddTask: vi.fn(),
      onUpdateTask,
      onDeleteTask: vi.fn(),
      onReorderTasks: vi.fn(),
      onAddSubtask: vi.fn(),
      onUpdateSubtask: vi.fn(),
      onDeleteSubtask: vi.fn(),
      onBack: vi.fn(),
      onDelete: vi.fn()
    }
    const view = render(<TodoEditor item={todo} {...props} />)

    fireEvent.click(screen.getByRole('button', { name: '删除任务' }))
    view.rerender(<TodoEditor item={replacement} {...props} />)

    const input = await screen.findByRole('textbox', { name: '任务内容' })
    fireEvent.change(input, { target: { value: '现在可以编辑' } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(onUpdateTask).toHaveBeenCalledWith('task_replacement', 2, {
        contentMarkdown: '现在可以编辑'
      })
    })
  })

  it('unblocks replacement editing after a deleted-task save conflict', async () => {
    const replacement: TodoItem = {
      ...todo,
      revision: 2,
      tasks: [{
        id: 'task_replacement', contentMarkdown: '', completed: false,
        tags: [], importance: 'normal', urgency: 'normal', children: [],
        schedule: null
      }]
    }
    const onUpdateTask = vi.fn()
      .mockResolvedValueOnce({ status: 'conflict', current: replacement })
      .mockResolvedValueOnce({
        status: 'ok',
        value: { ...replacement, revision: 3 }
      })
    const props = {
      onSave: vi.fn(), onAddTask: vi.fn(), onUpdateTask,
      onDeleteTask: vi.fn(), onReorderTasks: vi.fn(), onAddSubtask: vi.fn(),
      onUpdateSubtask: vi.fn(), onDeleteSubtask: vi.fn(),
      onBack: vi.fn(), onDelete: vi.fn()
    }
    const view = render(<TodoEditor item={todo} {...props} />)

    const staleInput = screen.getByRole('textbox', { name: '任务内容' })
    fireEvent.change(staleInput, { target: { value: '冲突中的旧任务' } })
    fireEvent.blur(staleInput)
    await waitFor(() => expect(onUpdateTask).toHaveBeenCalledTimes(1))

    view.rerender(<TodoEditor item={replacement} {...props} />)
    const replacementInput = screen.getByRole('textbox', { name: '任务内容' })
    fireEvent.change(replacementInput, { target: { value: '新的可编辑任务' } })
    fireEvent.blur(replacementInput)

    await waitFor(() => {
      expect(onUpdateTask).toHaveBeenLastCalledWith('task_replacement', 2, {
        contentMarkdown: '新的可编辑任务'
      })
    })
  })
})
