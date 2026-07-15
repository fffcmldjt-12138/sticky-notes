// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiyuanDeliveryButton } from '../src/renderer/src/components/SiyuanDeliveryButton'
import type { NoteItem } from '../src/shared/models'
import { noteContentFingerprint } from '../src/shared/siyuan'

describe('SiyuanDeliveryButton', () => {
  it('shows sent and changed states from the delivered content fingerprint', () => {
    const note = makeNote()
    note.siyuanDelivery = {
      notebookId: 'inbox', documentId: 'doc-1',
      sentAt: '2026-07-14T12:00:00.000Z',
      contentFingerprint: noteContentFingerprint(note)
    }
    const view = render(<SiyuanDeliveryButton note={note} onSend={vi.fn()} />)
    expect(screen.getByRole('button', { name: '已发送到思源' })).toBeDisabled()

    view.rerender(
      <SiyuanDeliveryButton
        note={{ ...note, contentMarkdown: 'Changed' }}
        onSend={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: '再次发送到思源' })).toBeEnabled()
  })

  it('shows a retry action after sending fails', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('连接失败'))
    render(<SiyuanDeliveryButton note={makeNote()} onSend={onSend} />)

    fireEvent.click(screen.getByRole('button', { name: '发送到思源' }))

    expect(await screen.findByText('连接失败')).toBeInTheDocument()
    await waitFor(() => expect(
      screen.getByRole('button', { name: '重试发送到思源' })
    ).toBeEnabled())
  })

  it('clears a stale retry state when the note is delivered elsewhere', async () => {
    const note = makeNote()
    const onSend = vi.fn().mockRejectedValue(new Error('连接失败'))
    const view = render(
      <SiyuanDeliveryButton compact note={note} onSend={onSend} />
    )

    fireEvent.click(screen.getByRole('button', { name: '发送到思源' }))
    await waitFor(() => expect(
      screen.getByRole('button', { name: '重试发送到思源' })
    ).toBeEnabled())

    const delivered = { ...note }
    delivered.siyuanDelivery = {
      notebookId: 'inbox',
      documentId: 'doc-1',
      sentAt: '2026-07-14T12:00:00.000Z',
      contentFingerprint: noteContentFingerprint(delivered)
    }
    view.rerender(
      <SiyuanDeliveryButton compact note={delivered} onSend={onSend} />
    )

    expect(screen.getByRole('button', { name: '已发送到思源' })).toBeDisabled()
  })

  it('keeps a delivery-disabled note visible but locked', () => {
    const note = makeNote()
    note.siyuanDeliveryDisabled = true
    render(<SiyuanDeliveryButton compact note={note} onSend={vi.fn()} />)

    expect(screen.getByRole('button', {
      name: '已禁止投送到思源'
    })).toBeDisabled()
    expect(screen.getByRole('button', {
      name: '已禁止投送到思源'
    })).toHaveClass('delivery-disabled')
  })
})

function makeNote(): NoteItem {
  return {
    id: 'note-1', revision: 1, type: 'note', title: 'Video',
    contentMarkdown: 'Body', siyuanDelivery: null,
    siyuanDeliveryDisabled: false, headerColor: '#f2c94c',
    bodyTheme: 'light', pinned: false, detached: false, windowBounds: null,
    parentFolderId: null, tags: [], order: 0, deletedAt: null,
    createdAt: '2026-07-14T09:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z'
  }
}
