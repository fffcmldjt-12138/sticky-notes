// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NoteItem } from '../src/shared/models'
import { NoteEditor } from '../src/renderer/src/components/NoteEditor'

const note: NoteItem = {
  id: 'note_1',
  type: 'note',
  title: '原标题',
  contentMarkdown: '正文',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: null,
  syncedToSiyuan: false,
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z'
}

describe('editor focus stability', () => {
  it('does not replace a focused title with a stale save response', () => {
    const view = render(
      <NoteEditor
        item={note}
        onSave={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    const title = screen.getByLabelText('标题')
    title.focus()
    fireEvent.change(title, { target: { value: '正在输入的新标题' } })

    view.rerender(
      <NoteEditor
        item={{ ...note, title: '迟到的旧标题' }}
        onSave={vi.fn()}
        onBack={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(title).toHaveValue('正在输入的新标题')
    expect(title).toHaveFocus()
  })
})
