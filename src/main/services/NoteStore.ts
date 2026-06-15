import { copyFile, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  FolderItem,
  FolderPatch,
  NoteItem,
  NotesFile,
  NoteType,
  RecycleContents,
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
    return (await this.file.read()).items.filter((item) => !item.deletedAt)
  }

  async listFolders(): Promise<FolderItem[]> {
    await this.ensureInitialized()
    await this.mutationQueue
    return (await this.file.read()).folders.filter((folder) => !folder.deletedAt)
  }

  async createFolder(
    title: string,
    parentFolderId: string | null = null
  ): Promise<FolderItem> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      assertFolderDepth(data.folders, parentFolderId)
      const now = new Date().toISOString()
      const folder: FolderItem = {
        id: `folder_${randomUUID()}`,
        title: title.trim() || '新建文件夹',
        parentFolderId,
        order: data.folders.length,
        collapsed: false,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      }
      data.folders.push(folder)
      await this.file.write(data)
      return folder
    })
  }

  async updateFolder(
    id: string,
    patch: FolderPatch
  ): Promise<FolderItem | null> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const index = data.folders.findIndex((folder) => folder.id === id)
      if (index < 0) return null
      if (Object.hasOwn(patch, 'parentFolderId')) {
        assertFolderMove(data.folders, id, patch.parentFolderId ?? null)
      }
      const updated = {
        ...data.folders[index],
        ...patch,
        updatedAt: new Date().toISOString()
      }
      data.folders[index] = updated
      await this.file.write(data)
      return updated
    })
  }

  async moveItem(
    itemId: string,
    parentFolderId: string | null
  ): Promise<StickyItem | null> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      if (
        parentFolderId &&
        !data.folders.some(
          (folder) => folder.id === parentFolderId && !folder.deletedAt
        )
      ) {
        throw new Error('目标文件夹不存在')
      }
      const index = data.items.findIndex((item) => item.id === itemId)
      if (index < 0) return null
      const updated = {
        ...data.items[index],
        parentFolderId,
        updatedAt: new Date().toISOString()
      } as StickyItem
      data.items[index] = updated
      await this.file.write(data)
      return updated
    })
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
      const index = data.items.findIndex((item) => item.id === id)
      if (index < 0) return false
      data.items[index] = {
        ...data.items[index],
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as StickyItem
      await this.file.write(data)
      return true
    })
  }

  async listDeleted(): Promise<RecycleContents> {
    await this.ensureInitialized()
    await this.mutationQueue
    const data = await this.file.read()
    return {
      items: data.items.filter((item) => item.deletedAt),
      folders: data.folders.filter((folder) => folder.deletedAt)
    }
  }

  async restoreItem(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const index = data.items.findIndex((item) => item.id === id && item.deletedAt)
      if (index < 0) return false
      const parentFolderId = data.folders.some(
        (folder) =>
          folder.id === data.items[index].parentFolderId && !folder.deletedAt
      )
        ? data.items[index].parentFolderId
        : null
      data.items[index] = {
        ...data.items[index],
        parentFolderId,
        deletedAt: null,
        updatedAt: new Date().toISOString()
      } as StickyItem
      await this.file.write(data)
      return true
    })
  }

  async restoreFolder(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const index = data.folders.findIndex(
        (folder) => folder.id === id && folder.deletedAt
      )
      if (index < 0) return false
      const parentFolderId = data.folders.some(
        (folder) =>
          folder.id === data.folders[index].parentFolderId && !folder.deletedAt
      )
        ? data.folders[index].parentFolderId
        : null
      data.folders[index] = {
        ...data.folders[index],
        parentFolderId,
        deletedAt: null,
        updatedAt: new Date().toISOString()
      }
      await this.file.write(data)
      return true
    })
  }

  async purgeDeletedBefore(cutoff: Date): Promise<number> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const shouldPurge = (deletedAt: string | null): boolean =>
        Boolean(deletedAt && new Date(deletedAt).getTime() <= cutoff.getTime())
      const itemCount = data.items.length
      const folderCount = data.folders.length
      data.items = data.items.filter((item) => !shouldPurge(item.deletedAt))
      data.folders = data.folders.filter((folder) => !shouldPurge(folder.deletedAt))
      await this.file.write(data)
      return itemCount + folderCount - data.items.length - data.folders.length
    })
  }

  async emptyDeleted(): Promise<number> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const itemCount = data.items.length
      const folderCount = data.folders.length
      data.items = data.items.filter((item) => !item.deletedAt)
      data.folders = data.folders.filter((folder) => !folder.deletedAt)
      await this.file.write(data)
      return itemCount + folderCount - data.items.length - data.folders.length
    })
  }

  async addTodoTask(todoId: string, contentMarkdown = ''): Promise<TodoTask | null> {
    const task: TodoTask = {
      id: `task_${randomUUID()}`,
      contentMarkdown,
      completed: false,
      remindAt: null,
      reminded: false,
      tags: [],
      deadlineAt: null,
      deadlineReminders: []
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
        const deadlineChanged =
          Object.hasOwn(nextPatch, 'deadlineAt') &&
          nextPatch.deadlineAt !== task.deadlineAt
        const selectionChanged =
          Object.hasOwn(nextPatch, 'deadlineReminders') &&
          reminderSelection(task.deadlineReminders) !==
            reminderSelection(nextPatch.deadlineReminders ?? [])
        const updated = { ...task, ...nextPatch }
        if (deadlineChanged || selectionChanged) {
          updated.deadlineReminders = updated.deadlineReminders.map((reminder) => ({
            ...reminder,
            remindedAt: null
          }))
        }
        return updated
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

function reminderSelection(
  reminders: TodoTask['deadlineReminders']
): string {
  return reminders
    .map(({ id, offsetMinutes }) => `${id}:${offsetMinutes}`)
    .sort()
    .join('|')
}

function assertFolderDepth(
  folders: FolderItem[],
  parentFolderId: string | null
): void {
  let depth = 1
  let current = parentFolderId
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current)) throw new Error('文件夹层级循环')
    visited.add(current)
    const parent = folders.find(
      (folder) => folder.id === current && !folder.deletedAt
    )
    if (!parent) throw new Error('目标文件夹不存在')
    depth += 1
    current = parent.parentFolderId
  }
  if (depth > 3) throw new Error('文件夹最多嵌套 3 层')
}

function assertFolderMove(
  folders: FolderItem[],
  folderId: string,
  parentFolderId: string | null
): void {
  if (folderId === parentFolderId) throw new Error('文件夹不能移动到自身')
  let current = parentFolderId
  while (current) {
    if (current === folderId) throw new Error('文件夹不能移动到子文件夹')
    current = folders.find((folder) => folder.id === current)?.parentFolderId ?? null
  }
  assertFolderDepth(folders, parentFolderId)
  const targetDepth = parentFolderId
    ? getFolderDepth(folders, parentFolderId) + 1
    : 1
  if (targetDepth + getSubtreeHeight(folders, folderId) - 1 > 3) {
    throw new Error('文件夹最多嵌套 3 层')
  }
}

function getFolderDepth(folders: FolderItem[], folderId: string): number {
  let depth = 0
  let current: string | null = folderId
  const visited = new Set<string>()
  while (current) {
    if (visited.has(current)) throw new Error('文件夹层级循环')
    visited.add(current)
    const folder = folders.find(
      (candidate) => candidate.id === current && !candidate.deletedAt
    )
    if (!folder) throw new Error('目标文件夹不存在')
    depth += 1
    current = folder.parentFolderId
  }
  return depth
}

function getSubtreeHeight(folders: FolderItem[], folderId: string): number {
  const children = folders.filter(
    (folder) => folder.parentFolderId === folderId && !folder.deletedAt
  )
  if (!children.length) return 1
  return (
    1 +
    Math.max(...children.map((folder) => getSubtreeHeight(folders, folder.id)))
  )
}
