import type { RecycleContents, StickyItem } from '../../shared/models'
import type { AssetService } from './AssetService'
import type { NoteStore } from './NoteStore'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export class RecycleService {
  constructor(
    private readonly store: NoteStore,
    private readonly now: () => Date = () => new Date(),
    private readonly assets?: AssetService
  ) {}

  list(): Promise<RecycleContents> {
    return this.store.listDeleted()
  }

  async restoreItem(id: string): Promise<boolean> {
    if (this.assets) {
      const item = (await this.store.listDeleted()).items.find(
        (candidate) => candidate.id === id
      )
      if (item) await this.assets.restoreReferenced(itemMarkdown(item))
    }
    return this.store.restoreItem(id)
  }

  restoreFolder(id: string): Promise<boolean> {
    return this.store.restoreFolder(id)
  }

  async purgeExpired(): Promise<number> {
    const cutoff = new Date(this.now().getTime() - RETENTION_MS)
    const purged = await this.store.purgeDeletedBefore(cutoff)
    if (this.assets) {
      await this.cleanUnusedImages()
      await this.assets.purgeTrashBefore(cutoff)
    }
    return purged
  }

  async empty(): Promise<number> {
    const emptied = await this.store.emptyDeleted()
    if (this.assets) await this.cleanUnusedImages()
    return emptied
  }

  async cleanUnusedImages(): Promise<number> {
    if (!this.assets) return 0
    const active = await this.store.list()
    const deleted = await this.store.listDeleted()
    return this.assets.cleanUnused(
      [...active, ...deleted.items].flatMap(itemMarkdown),
      this.now().getTime()
    )
  }
}

function itemMarkdown(item: StickyItem): string[] {
  return item.type === 'note'
    ? [item.contentMarkdown]
    : item.tasks.flatMap((task) => [
        task.contentMarkdown,
        ...task.children.map((child) => child.contentMarkdown)
      ])
}
