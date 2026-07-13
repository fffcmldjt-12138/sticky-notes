import type {
  AppConfig,
  AssetReference,
  FolderItem,
  FolderPatch,
  NoteType,
  OrderedNodeRef,
  RecycleContents,
  StickyItem,
  StickyItemPatch,
  TodoItem,
  TodoSubtask,
  TodoSubtaskPatch,
  TodoTask,
  TodoTaskPatch
} from './models'

export interface ReminderAlertPayload {
  itemId?: string
  taskId?: string
  subtaskId?: string
  reminderId?: string
  title: string
  body: string
  createdAt: string
}

export type ReminderWindowAction =
  | { type: 'acknowledge' }
  | { type: 'open' }
  | { type: 'snooze'; minutes: 5 | 10 | 30 }

export interface DragPreviewPayload {
  kind: 'item' | 'folder'
  itemType?: NoteType
  title: string
  headerColor?: string
  bodyTheme?: 'light' | 'dark'
}

export interface DetachWindowOptions {
  atCursor?: boolean
}

export interface StickyApi {
  notes: {
    list(): Promise<StickyItem[]>
    create(
      type: NoteType,
      title?: string,
      parentFolderId?: string | null
    ): Promise<StickyItem>
    update(id: string, patch: StickyItemPatch): Promise<StickyItem | null>
    delete(id: string): Promise<boolean>
    addTodoTask(todoId: string, contentMarkdown?: string): Promise<TodoTask | null>
    updateTodoTask(
      todoId: string,
      taskId: string,
      patch: TodoTaskPatch
    ): Promise<TodoItem | null>
    deleteTodoTask(todoId: string, taskId: string): Promise<TodoItem | null>
    reorderTodoTasks(todoId: string, taskIds: string[]): Promise<TodoItem | null>
    addTodoSubtask(
      todoId: string,
      taskId: string,
      contentMarkdown?: string
    ): Promise<TodoSubtask | null>
    updateTodoSubtask(
      todoId: string,
      taskId: string,
      subtaskId: string,
      patch: TodoSubtaskPatch
    ): Promise<TodoItem | null>
    deleteTodoSubtask(
      todoId: string,
      taskId: string,
      subtaskId: string
    ): Promise<TodoItem | null>
  }
  config: {
    get(): Promise<AppConfig>
    update(patch: Partial<Omit<AppConfig, 'version'>>): Promise<AppConfig>
  }
  assets: {
    selectImage(): Promise<AssetReference | null>
    importImageData(bytes: Uint8Array, mimeType: string): Promise<AssetReference>
  }
  folders: {
    list(): Promise<FolderItem[]>
    create(title: string, parentFolderId?: string | null): Promise<FolderItem>
    update(id: string, patch: FolderPatch): Promise<FolderItem | null>
    delete(id: string): Promise<boolean>
    moveItem(itemId: string, parentFolderId: string | null): Promise<StickyItem | null>
    reorderChildren(
      parentFolderId: string | null,
      orderedNodes: OrderedNodeRef[]
    ): Promise<void>
  }
  recycle: {
    list(): Promise<RecycleContents>
    restoreItem(id: string): Promise<boolean>
    restoreFolder(id: string): Promise<boolean>
    empty(): Promise<number>
    cleanUnusedImages(): Promise<number>
  }
  reminder: {
    respond(action: ReminderWindowAction): Promise<void>
  }
  window: {
    expand(): void
    scheduleCollapse(): void
    cancelCollapse(): void
    hide(): void
    suspendAutoHide(suspended: boolean): void
    detach(itemId: string, options?: DetachWindowOptions): Promise<void>
    attach(itemId: string): Promise<void>
    detachFolder(folderId: string, options?: DetachWindowOptions): Promise<void>
    attachFolder(folderId: string): Promise<void>
    openExternal(url: string): Promise<boolean>
    startDragPreview?(payload: DragPreviewPayload): void
    stopDragPreview?(): void
  }
  onOpenEditor(callback: (type: NoteType) => void): () => void
  onOpenItem?(callback: (itemId: string) => void): () => void
  onItemChanged(callback: (item: StickyItem) => void): () => void
  onFolderChanged?(callback: (folder: FolderItem) => void): () => void
  onFolderDeleted?(callback: (folderId: string) => void): () => void
  onItemDeleted(callback: (itemId: string) => void): () => void
  onReminderFired?(callback: (payload: ReminderAlertPayload) => void): () => void
}
