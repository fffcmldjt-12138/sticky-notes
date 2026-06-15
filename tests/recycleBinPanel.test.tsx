// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteItem } from '../src/shared/models'
import { RecycleBinPanel } from '../src/renderer/src/pages/RecycleBinPanel'

const deletedNote: NoteItem = {
  id: 'note_deleted',
  type: 'note',
  title: '已删除笔记',
  contentMarkdown: '',
  headerColor: '#f2c94c',
  bodyTheme: 'light',
  pinned: false,
  detached: false,
  windowBounds: null,
  parentFolderId: null,
  tags: [],
  order: 0,
  deletedAt: '2026-06-15T00:00:00.000Z',
  syncedToSiyuan: false,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

describe('RecycleBinPanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'stickyApi', {
      configurable: true,
      value: {
        recycle: {
          list: vi.fn().mockResolvedValue({ items: [deletedNote], folders: [] }),
          restoreItem: vi.fn().mockResolvedValue(true),
          restoreFolder: vi.fn().mockResolvedValue(false),
          empty: vi.fn().mockResolvedValue(0),
          cleanUnusedImages: vi.fn().mockResolvedValue(0)
        }
      }
    })
  })

  it('lists and restores a deleted note', async () => {
    render(<RecycleBinPanel onBack={vi.fn()} onChanged={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: '恢复 已删除笔记' }))

    await waitFor(() => {
      expect(window.stickyApi.recycle.restoreItem).toHaveBeenCalledWith('note_deleted')
    })
    expect(screen.queryByText('已删除笔记')).not.toBeInTheDocument()
  })
})
