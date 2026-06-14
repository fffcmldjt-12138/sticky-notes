import type {
  AppConfig,
  NoteType,
  StickyItem,
  StickyItemPatch
} from './models'

export interface StickyApi {
  notes: {
    list(): Promise<StickyItem[]>
    create(type: NoteType): Promise<StickyItem>
    update(id: string, patch: StickyItemPatch): Promise<StickyItem | null>
    delete(id: string): Promise<boolean>
  }
  config: {
    get(): Promise<AppConfig>
    update(patch: Partial<Omit<AppConfig, 'version'>>): Promise<AppConfig>
  }
  window: {
    expand(): void
    scheduleCollapse(): void
    cancelCollapse(): void
    hide(): void
    suspendAutoHide(suspended: boolean): void
  }
  onOpenEditor(callback: (type: NoteType) => void): () => void
}

