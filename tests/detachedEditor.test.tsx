// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteItem, TodoItem } from '../src/shared/models'
import { NoteEditor } from '../src/renderer/src/components/NoteEditor'
import { TodoEditor } from '../src/renderer/src/components/TodoEditor'

const note: NoteItem = {
  id: 'note_1',
  revision: 1,
  type: 'note',
  title: 'Note',
  contentMarkdown: 'Text',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: true,
  windowBounds: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

const todo: TodoItem = {
  id: 'todo_1',
  revision: 1,
  type: 'todo',
  title: 'Todo',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: true,
  windowBounds: null,
  tasks: [],
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

describe('detached editor controls', () => {
  it('shows only a close window action and uses a draggable header for notes', () => {
    const onClose = vi.fn()
    const { container } = render(
      <NoteEditor
        detached
        item={note}
        onSave={vi.fn()}
        onBack={onClose}
        onDelete={vi.fn()}
      />
    )

    expect(container.querySelector('.editor-header')).toHaveClass('detached-header')
    expect(container.querySelector('.editor-header input')).not.toBeInTheDocument()
    expect(container.querySelector('.editor-header')).toHaveTextContent('Note')
    expect(screen.queryByLabelText('标题')).not.toBeInTheDocument()
    expect(container.querySelector('.editor')).toHaveClass('detached-editor')
    expect(container.querySelector('.editor-identity-toolbar')).not
      .toBeInTheDocument()
    expect(container.querySelector('.tag-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'H1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows only a close window action for detached todos', () => {
    render(
      <TodoEditor
        detached
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

    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '删除' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('标题')).not.toBeInTheDocument()
    expect(screen.queryByText('添加标签')).not.toBeInTheDocument()
  })
})
