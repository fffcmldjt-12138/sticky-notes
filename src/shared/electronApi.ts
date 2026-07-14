import type {
  AppConfig,
  AssetReference,
  FolderItem,
  FolderPatch,
  MutationResult,
  NoteItem,
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

export interface SiyuanSendResult {
  status: 'sent' | 'already-sent'
  documentId: string
  item: NoteItem
}

export interface SiyuanSettings {
  endpoint: string
  inboxNotebookId: string | null
  inboxNotebookName: '00 收件箱'
  hasToken: boolean
}

export interface SiyuanSettingsPatch {
  endpoint?: string
  token?: string
}

export interface SiyuanConnectionResult {
  version: string
  notebookId: string
  notebookName: string
}

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

export interface BackupSummary {
  id: string
  kind: 'change' | 'daily' | 'protected'
  createdAt: string
  size: number
}

export interface ImportSummary {
  inspectionId: string
  itemCount: number
  folderCount: number
  assetCount: number
  orphanAssetCount: number
  expiresAt: string
}

export type DataReloadReason = 'restore' | 'import'

export type UndoExecutionResult =
  | { status: 'empty' }
  | { status: 'ok' | 'conflict'; label: string }

export interface StickyApi {
  notes: {
    list(): Promise<StickyItem[]>
    create(
      type: NoteType,
      title?: string,
      parentFolderId?: string | null
    ): Promise<StickyItem>
    update(
      id: string,
      expectedRevision: number,
      patch: StickyItemPatch
    ): Promise<MutationResult<StickyItem>>
    delete(id: string): Promise<boolean>
    addTodoTask(todoId: string, contentMarkdown?: string): Promise<TodoTask | null>
    updateTodoTask(
      todoId: string,
      taskId: string,
      expectedRevision: number | null,
      patch: TodoTaskPatch
    ): Promise<MutationResult<TodoItem>>
    deleteTodoTask(todoId: string, taskId: string): Promise<MutationResult<TodoItem>>
    reorderTodoTasks(todoId: string, taskIds: string[]): Promise<MutationResult<TodoItem>>
    addTodoSubtask(
      todoId: string,
      taskId: string,
      contentMarkdown?: string
    ): Promise<TodoSubtask | null>
    updateTodoSubtask(
      todoId: string,
      taskId: string,
      subtaskId: string,
      expectedRevision: number | null,
      patch: TodoSubtaskPatch
    ): Promise<MutationResult<TodoItem>>
    deleteTodoSubtask(
      todoId: string,
      taskId: string,
      subtaskId: string
    ): Promise<MutationResult<TodoItem>>
  }
  config: {
    get(): Promise<AppConfig>
    update(patch: Partial<Omit<AppConfig, 'version'>>): Promise<AppConfig>
  }
  assets: {
    selectImage(): Promise<AssetReference | null>
    importImageData(bytes: Uint8Array, mimeType: string): Promise<AssetReference>
  }
  siyuan: {
    getSettings(): Promise<SiyuanSettings>
    updateSettings(patch: SiyuanSettingsPatch): Promise<SiyuanSettings>
    testConnection(): Promise<SiyuanConnectionResult>
    sendNote(noteId: string): Promise<SiyuanSendResult>
  }
  folders: {
    list(): Promise<FolderItem[]>
    create(title: string, parentFolderId?: string | null): Promise<FolderItem>
    update(
      id: string,
      expectedRevision: number,
      patch: FolderPatch
    ): Promise<MutationResult<FolderItem>>
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
  undo: {
    latest(): Promise<{ label: string } | null>
    execute(): Promise<UndoExecutionResult>
  }
  data: {
    openDirectory(): Promise<void>
    createBackup(): Promise<BackupSummary>
    listBackups(): Promise<BackupSummary[]>
    restoreBackup(id: string): Promise<void>
    exportArchive(): Promise<boolean>
    inspectImport(): Promise<ImportSummary | null>
    cancelImport(inspectionId: string): Promise<void>
    confirmImport(inspectionId: string): Promise<void>
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
  onDataReloaded(callback: (reason: DataReloadReason) => void): () => void
}
