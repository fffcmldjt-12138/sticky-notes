// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchPanel } from '../src/renderer/src/pages/SearchPanel'
import type { NoteItem } from '../src/shared/models'

const note: NoteItem = {
  revision: 1, id: 'n1', type: 'note', title: '搜索测试', contentMarkdown: '正文内容',
  headerColor: '#f2c94c', bodyTheme: 'light', pinned: false, detached: false,
  windowBounds: null, parentFolderId: null, tags: [], order: 0, deletedAt: null,
  siyuanDelivery: null, createdAt: '2026-07-14T00:00:00.000Z', updatedAt: '2026-07-14T00:00:00.000Z'
}

describe('SearchPanel', () => {
  it('filters and opens a result', () => {
    const onOpenResult = vi.fn()
    render(<SearchPanel items={[note]} folders={[]} onClose={vi.fn()} onOpenResult={onOpenResult} />)
    fireEvent.change(screen.getByLabelText('搜索内容'), { target: { value: '正文' } })
    fireEvent.click(screen.getByRole('button', { name: /搜索测试/ }))
    expect(onOpenResult).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'n1' }))
  })

  it('supports smart filters and close', () => {
    const onClose = vi.fn()
    render(<SearchPanel items={[note]} folders={[]} onClose={onClose} onOpenResult={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重要' }))
    expect(screen.getByText('0 条结果')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '关闭搜索' }))
    expect(onClose).toHaveBeenCalled()
  })
})
