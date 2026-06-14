// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteItem, TodoItem } from '../src/shared/models'
import { SettingsPanel } from '../src/renderer/src/pages/SettingsPanel'
import { StickyCard } from '../src/renderer/src/components/StickyCard'
import { CardContextMenu } from '../src/renderer/src/components/CardContextMenu'
import { TitleDialog } from '../src/renderer/src/components/TitleDialog'

const note: NoteItem = {
  id: 'note_1',
  type: 'note',
  title: 'Note title',
  contentMarkdown: 'Content',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

const todo: TodoItem = {
  id: 'todo_1',
  type: 'todo',
  title: 'Todo title',
  headerColor: '#5b8def',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  tasks: [],
  createdAt: '2026-06-14T09:00:00.000Z',
  updatedAt: '2026-06-14T09:00:00.000Z'
}

describe('card and navigation actions', () => {
  it('lets the settings back button receive clicks', () => {
    const onBack = vi.fn()
    render(
      <SettingsPanel
        config={{
          version: 1,
          autoLaunch: false,
          panelPosition: 'right',
          alwaysOnTop: true
        }}
        onChange={vi.fn()}
        onBack={onBack}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('uses one identical header structure for Note and Todo cards', () => {
    const { rerender } = render(
      <StickyCard item={note} onOpen={vi.fn()}>
        Note body
      </StickyCard>
    )
    const noteHeader = document.querySelector('.sticky-card-header')
    expect(noteHeader).toBeInTheDocument()

    rerender(
      <StickyCard item={todo} onOpen={vi.fn()}>
        Todo body
      </StickyCard>
    )
    const todoHeader = document.querySelector('.sticky-card-header')
    expect(todoHeader?.className).toBe(noteHeader?.className)
  })

  it('opens the context menu on right click and closes it with Escape', () => {
    render(
      <CardContextMenu
        item={note}
        position={{ x: 10, y: 20 }}
        onAction={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByRole('menu')).toBeVisible()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not create an item when the title dialog is cancelled', () => {
    const onConfirm = vi.fn()
    render(
      <TitleDialog type="note" onConfirm={onConfirm} onCancel={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: 'Draft title' }
    })
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
