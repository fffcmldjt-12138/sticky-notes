import { describe, expect, it } from 'vitest'
import type { NoteItem } from '../src/shared/models'
import { upsertItem } from '../src/renderer/src/lib/itemList'

const note: NoteItem = {
  id: 'note_1',
  type: 'note',
  title: 'New note',
  contentMarkdown: '',
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
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z'
}

describe('upsertItem', () => {
  it('keeps one entry when create response and IPC broadcast contain the same item', () => {
    const afterBroadcast = upsertItem([], note)
    const afterCreateResponse = upsertItem(afterBroadcast, note)

    expect(afterCreateResponse).toEqual([note])
  })

  it('replaces an existing item without changing its list position', () => {
    const updated = { ...note, title: 'Edited note' }

    expect(upsertItem([note], updated)).toEqual([updated])
  })
})
