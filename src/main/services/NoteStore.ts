import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  NoteItem,
  NotesFile,
  NoteType,
  StickyItem,
  StickyItemPatch,
  TodoItem
} from '../../shared/models'
import { JsonFileStore } from './JsonFileStore'

export class NoteStore {
  private readonly file: JsonFileStore<NotesFile>
  private mutationQueue: Promise<void> = Promise.resolve()

  constructor(userDataPath: string) {
    this.file = new JsonFileStore(join(userDataPath, 'notes.json'), () => ({
      version: 1,
      items: []
    }))
  }

  async list(): Promise<StickyItem[]> {
    await this.mutationQueue
    return (await this.file.read()).items
  }

  async create(type: NoteType): Promise<StickyItem> {
    return this.mutate(async () => {
      const data = await this.file.read()
      const now = new Date().toISOString()
      const base = {
        id: `${type}_${randomUUID()}`,
        title: type === 'note' ? '新建笔记' : '新建待办',
        contentMarkdown: '',
        headerColor: type === 'note' ? ('yellow' as const) : ('blue' as const),
        bodyTheme: 'light' as const,
        pinned: false,
        createdAt: now,
        updatedAt: now
      }
      const item: NoteItem | TodoItem =
        type === 'note'
          ? { ...base, type, syncedToSiyuan: false }
          : {
              ...base,
              type,
              completed: false,
              remindAt: null,
              reminded: false
            }

      data.items.unshift(item)
      await this.file.write(data)
      return item
    })
  }

  async update(id: string, patch: StickyItemPatch): Promise<StickyItem | null> {
    return this.mutate(async () => {
      const data = await this.file.read()
      const index = data.items.findIndex((item) => item.id === id)
      if (index < 0) return null

      const current = data.items[index]
      const nextPatch = { ...patch }
      if (
        current.type === 'todo' &&
        Object.hasOwn(nextPatch, 'remindAt') &&
        nextPatch.remindAt !== current.remindAt
      ) {
        nextPatch.reminded = false
      }

      const updated = {
        ...current,
        ...nextPatch,
        updatedAt: new Date().toISOString()
      } as StickyItem
      data.items[index] = updated
      await this.file.write(data)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    return this.mutate(async () => {
      const data = await this.file.read()
      const remaining = data.items.filter((item) => item.id !== id)
      if (remaining.length === data.items.length) return false
      data.items = remaining
      await this.file.write(data)
      return true
    })
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation)
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
