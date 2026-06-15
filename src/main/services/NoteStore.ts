import { copyFile, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  NoteItem,
  NotesFile,
  NoteType,
  StickyItem,
  StickyItemPatch,
  TodoItem,
  TodoTask,
  TodoTaskPatch
} from '../../shared/models'
import { JsonFileStore } from './JsonFileStore'
import { migrateNotesFile } from './noteMigration'

export class NoteStore {
  private readonly filePath: string
  private readonly file: JsonFileStore<NotesFile>
  private mutationQueue: Promise<void> = Promise.resolve()
  private initialized: Promise<void> | null = null

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'notes.json')
    this.file = new JsonFileStore(this.filePath, () => ({
      version: 3,
      items: [],
      folders: []
    }))
  }

  async list(): Promise<StickyItem[]> {
    await this.ensureInitialized()
    await this.mutationQueue
    return (await this.file.read()).items
  }

  async create(type: NoteType, title?: string): Promise<StickyItem> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const now = new Date().toISOString()
      const base = {
        id: `${type}_${randomUUID()}`,
        title: title?.trim() || (type === 'note' ? '新建笔记' : '新建待办'),
        headerColor: type === 'note'
          ? ('#f2c94c' as const)
          : ('#5b8def' as const),
        bodyTheme: 'light' as const,
        pinned: false,
        detached: false,
        windowBounds: null,
        parentFolderId: null,
        tags: [],
        order: data.items.length,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      }
      const item: NoteItem | TodoItem =
        type === 'note'
          ? { ...base, type, contentMarkdown: '', syncedToSiyuan: false }
          : { ...base, type, tasks: [] }

      data.items.unshift(item)
      await this.file.write(data)
      return item
    })
  }

  async update(id: string, patch: StickyItemPatch): Promise<StickyItem | null> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const index = data.items.findIndex((item) => item.id === id)
      if (index < 0) return null
      const updated = {
        ...data.items[index],
        ...patch,
        updatedAt: new Date().toISOString()
      } as StickyItem
      data.items[index] = updated
      await this.file.write(data)
      return updated
    })
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const remaining = data.items.filter((item) => item.id !== id)
      if (remaining.length === data.items.length) return false
      data.items = remaining
      await this.file.write(data)
      return true
    })
  }

  async addTodoTask(todoId: string, contentMarkdown = ''): Promise<TodoTask | null> {
    const task: TodoTask = {
      id: `task_${randomUUID()}`,
      contentMarkdown,
      completed: false,
      remindAt: null,
      reminded: false
    }
    const updated = await this.changeTodo(todoId, (todo) => ({
      ...todo,
      tasks: [...todo.tasks, task]
    }))
    return updated ? task : null
  }

  async updateTodoTask(
    todoId: string,
    taskId: string,
    patch: TodoTaskPatch
  ): Promise<TodoItem | null> {
    return this.changeTodo(todoId, (todo) => ({
      ...todo,
      tasks: todo.tasks.map((task) => {
        if (task.id !== taskId) return task
        const nextPatch = { ...patch }
        if (
          Object.hasOwn(nextPatch, 'remindAt') &&
          nextPatch.remindAt !== task.remindAt
        ) {
          nextPatch.reminded = false
        }
        return { ...task, ...nextPatch }
      })
    }))
  }

  async deleteTodoTask(todoId: string, taskId: string): Promise<TodoItem | null> {
    return this.changeTodo(todoId, (todo) => ({
      ...todo,
      tasks: todo.tasks.filter((task) => task.id !== taskId)
    }))
  }

  async reorderTodoTasks(
    todoId: string,
    orderedTaskIds: string[]
  ): Promise<TodoItem | null> {
    return this.changeTodo(todoId, (todo) => {
      const byId = new Map(todo.tasks.map((task) => [task.id, task]))
      const ordered = orderedTaskIds
        .map((id) => byId.get(id))
        .filter((task): task is TodoTask => Boolean(task))
      const missing = todo.tasks.filter((task) => !orderedTaskIds.includes(task.id))
      return { ...todo, tasks: [...ordered, ...missing] }
    })
  }

  private async changeTodo(
    todoId: string,
    change: (todo: TodoItem) => TodoItem
  ): Promise<TodoItem | null> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const index = data.items.findIndex((item) => item.id === todoId)
      const current = data.items[index]
      if (index < 0 || current.type !== 'todo') return null
      const updated = {
        ...change(current),
        updatedAt: new Date().toISOString()
      }
      data.items[index] = updated
      await this.file.write(data)
      return updated
    })
  }

  private ensureInitialized(): Promise<void> {
    this.initialized ??= this.initialize()
    return this.initialized
  }

  private async initialize(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, 'utf8')) as {
        version?: number
      }
      if (raw.version === 1 || raw.version === 2) {
        await copyFile(this.filePath, `${this.filePath}.backup-${Date.now()}`)
        await this.file.write(migrateNotesFile(raw))
      } else if (raw.version === 3) {
        const normalized = migrateNotesFile(raw)
        await this.file.write(normalized)
      } else {
        throw new Error(`Unsupported notes version: ${raw.version}`)
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'ENOENT') throw error
      await this.file.write({ version: 3, items: [], folders: [] })
    }
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
