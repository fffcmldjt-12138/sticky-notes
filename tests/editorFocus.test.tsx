// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NoteItem } from '../src/shared/models'
import { NoteEditor } from '../src/renderer/src/components/NoteEditor'

const note: NoteItem = {
  id: 'note_1',
  revision: 1,
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
  afterEach(() => vi.useRealTimers())

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

  it('does not save title text until IME composition ends', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue({
      status: 'ok',
      value: { ...note, title: '拼音', revision: 2 }
    })
    render(
      <NoteEditor item={note} onSave={onSave} onBack={vi.fn()} onDelete={vi.fn()} />
    )
    const title = screen.getByLabelText('标题')

    fireEvent.compositionStart(title)
    fireEvent.change(title, { target: { value: '拼音' } })
    await act(async () => vi.advanceTimersByTime(1000))
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => fireEvent.compositionEnd(title))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(1, { title: '拼音' })
  })
})
