// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { describe, expect, it, vi } from 'vitest'
import type { TodoItem } from '../src/shared/models'
import { TodoCard } from '../src/renderer/src/components/TodoCard'

const item: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: 'Launch',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  tasks: [{
    id: 'task_1',
    contentMarkdown: 'Prepare release',
    completed: false,
    tags: [],
    importance: 'normal',
    urgency: 'normal',
    schedule: null,
    children: [{
      id: 'child_1',
      contentMarkdown: 'Write notes',
      completed: false,
      tags: [],
      importance: 'normal',
      urgency: 'normal',
      schedule: null
    }]
  }],
  panelExpanded: true,
  createdAt: '2026-07-13T00:00:00.000Z',
  updatedAt: '2026-07-13T00:00:00.000Z'
}

describe('TodoCard', () => {
  it('lets a subtask be checked directly from the panel', () => {
    const onToggleSubtask = vi.fn()
    render(
      <DndContext>
        <TodoCard
          item={item}
          onOpen={vi.fn()}
          onToggle={vi.fn()}
          onToggleSubtask={onToggleSubtask}
          onToggleExpanded={vi.fn()}
          onContextMenu={vi.fn()}
          onDetach={vi.fn()}
        />
      </DndContext>
    )

    fireEvent.click(screen.getByRole('checkbox', { name: '子待办 Write notes' }))
    expect(onToggleSubtask).toHaveBeenCalledWith('task_1', 'child_1', true)
  })
})
