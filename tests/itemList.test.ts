import { describe, expect, it } from 'vitest'
import type { NoteItem } from '../src/shared/models'
import { upsertItem } from '../src/renderer/src/lib/itemList'
import { acceptNewer } from '../src/renderer/src/lib/entityEvents'

const note: NoteItem = {
  revision: 1,
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
    const updated = { ...note, title: 'Edited note', revision: 2 }

    expect(upsertItem([note], updated)).toEqual([updated])
  })

  it('ignores an older cross-window entity snapshot', () => {
    const current = { ...note, title: 'Current', revision: 3 }
    const stale = { ...note, title: 'Stale', revision: 2 }

    expect(acceptNewer(current, stale)).toBe(current)
    expect(upsertItem([current], stale)).toEqual([current])
  })
})
