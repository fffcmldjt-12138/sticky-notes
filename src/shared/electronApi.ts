import type {
  AppConfig,
  NoteType,
  StickyItem,
  StickyItemPatch,
  TodoItem,
  TodoTask,
  TodoTaskPatch
} from './models'

export interface StickyApi {
  notes: {
    list(): Promise<StickyItem[]>
    create(type: NoteType): Promise<StickyItem>
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
