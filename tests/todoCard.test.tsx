// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { TodoCard } from '../src/renderer/src/components/TodoCard'

const todo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: 'Tasks',
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
  tasks: Array.from({ length: 5 }, (_, index) => ({
    id: `task_${index + 1}`,
    contentMarkdown: `Task ${index + 1}`,
    completed: false,
    remindAt: null,
    reminded: false,
    tags: [],
    deadlineAt: null,
    deadlineReminders: []
  })),
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

function renderCard(item: TodoItem, onToggleExpanded = vi.fn()) {
  return render(
    <TodoCard
      item={item}
      onOpen={vi.fn()}
      onToggle={vi.fn()}
      onToggleExpanded={onToggleExpanded}
      onContextMenu={vi.fn()}
      onDetach={vi.fn()}
    />
  )
}

describe('TodoCard expansion', () => {
  it('shows three tasks when collapsed and every task when expanded', () => {
    const collapsed = renderCard(todo)
    expect(collapsed.container.querySelectorAll('.todo-check')).toHaveLength(3)
    collapsed.unmount()

    const expanded = renderCard({ ...todo, panelExpanded: true })
    expect(expanded.container.querySelectorAll('.todo-check')).toHaveLength(5)
  })

  it('requests a persisted expansion toggle', () => {
    const onToggleExpanded = vi.fn()
    renderCard(todo, onToggleExpanded)

    fireEvent.click(screen.getByRole('button', { name: '展开全部待办' }))

    expect(onToggleExpanded).toHaveBeenCalledWith(true)
  })
})
