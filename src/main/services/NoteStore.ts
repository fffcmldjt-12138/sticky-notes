import { copyFile, readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import type {
  FolderItem,
  FolderPatch,
  NoteItem,
  NotesFile,
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
      version: 4,
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
        order: nextSiblingOrder(data, parentFolderId),
        collapsed: false,
        detached: false,
        windowBounds: null,
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

  async deleteFolder(id: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      const folder = data.folders.find(
        (candidate) => candidate.id === id && !candidate.deletedAt
      )
      if (!folder) return false

      const parentFolderId = folder.parentFolderId
      const insertionIndex = siblingReferences(data, parentFolderId).findIndex(
        (reference) => reference.kind === 'folder' && reference.id === id
      )
      const promoted = siblingReferences(data, id)
      const now = new Date().toISOString()
      for (const reference of promoted) {
        if (reference.kind === 'item') {
          const item = data.items.find((candidate) => candidate.id === reference.id)
          if (item) {
            item.parentFolderId = parentFolderId
            item.updatedAt = now
          }
        } else {
          const child = data.folders.find(
            (candidate) => candidate.id === reference.id
          )
          if (child) {
            child.parentFolderId = parentFolderId
            child.updatedAt = now
          }
        }
      }
      folder.deletedAt = now
      folder.updatedAt = now

      const promotedKeys = new Set(
        promoted.map((reference) => `${reference.kind}:${reference.id}`)
      )
      const siblings = siblingReferences(data, parentFolderId).filter(
        (reference) =>
          !promotedKeys.has(`${reference.kind}:${reference.id}`)
      )
      siblings.splice(Math.max(0, insertionIndex), 0, ...promoted)
      assignSiblingOrder(data, siblings)
      await this.file.write(data)
      return true
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

  async reorderChildren(
    parentFolderId: string | null,
    orderedNodes: OrderedNodeRef[]
  ): Promise<void> {
    await this.ensureInitialized()
    return this.mutate(async () => {
      const data = await this.file.read()
      if (
        parentFolderId &&
        !data.folders.some(
          (folder) => folder.id === parentFolderId && !folder.deletedAt
        )
      ) {
        throw new Error('Target folder does not exist')
      }

      const seen = new Set<string>()
      const sourceParents = new Set<string | null>()
      for (const reference of orderedNodes) {
        const key = `${reference.kind}:${reference.id}`
        if (seen.has(key)) throw new Error('Duplicate ordered node')
        seen.add(key)

        if (reference.kind === 'item') {
          const item = data.items.find(
            (candidate) => candidate.id === reference.id && !candidate.deletedAt
          )
          if (!item) throw new Error('Sticky item does not exist')
          sourceParents.add(item.parentFolderId)
          item.parentFolderId = parentFolderId
          item.updatedAt = new Date().toISOString()
        } else {
          const folder = data.folders.find(
            (candidate) => candidate.id === reference.id && !candidate.deletedAt
          )
          if (!folder) throw new Error('Folder does not exist')
          assertFolderMove(data.folders, folder.id, parentFolderId)
          sourceParents.add(folder.parentFolderId)
          folder.parentFolderId = parentFolderId
          folder.updatedAt = new Date().toISOString()
        }
      }

      const remaining = siblingReferences(data, parentFolderId).filter(
        (reference) => !seen.has(`${reference.kind}:${reference.id}`)
      )
      assignSiblingOrder(data, [...orderedNodes, ...remaining])
      for (const sourceParent of sourceParents) {
        if (sourceParent !== parentFolderId) {
          assignSiblingOrder(data, siblingReferences(data, sourceParent))
        }
      }
      await this.file.write(data)
    })
  }

  async create(
    type: NoteType,
    title?: string,
    parentFolderId: string | null = null
  ): Promise<StickyItem> {
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
        parentFolderId,
        tags: [],
        order: nextSiblingOrder(data, parentFolderId),
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      }
      const item: NoteItem | TodoItem =
        type === 'note'
          ? { ...base, type, contentMarkdown: '', syncedToSiyuan: false }
          : { ...base, type, tasks: [], panelExpanded: false }

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
      tags: [],
      importance: 'normal',
      urgency: 'normal',
      children: [],
      schedule: null
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
        const scheduleChanged =
          Object.hasOwn(patch, 'schedule') &&
          JSON.stringify(patch.schedule) !== JSON.stringify(task.schedule)
        const updated = { ...task, ...patch }
        if (scheduleChanged && updated.schedule) {
          updated.schedule = {
            ...updated.schedule,
            reminders: updated.schedule.reminders.map((reminder) => ({
              ...reminder,
              remindedAt: null
            }))
          }
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

  async addTodoSubtask(
    todoId: string,
    taskId: string,
    contentMarkdown = ''
  ): Promise<TodoSubtask | null> {
    const child: TodoSubtask = {
      id: `subtask_${randomUUID()}`,
      contentMarkdown,
      completed: false,
      importance: 'normal',
      urgency: 'normal',
      tags: [],
      schedule: null
    }
    const updated = await this.changeTodo(todoId, (todo) => ({
      ...todo,
      tasks: todo.tasks.map((task) =>
        task.id === taskId
          ? { ...task, children: [...task.children, child] }
          : task
      )
    }))
    return updated ? child : null
  }

  async updateTodoSubtask(
    todoId: string,
    taskId: string,
    subtaskId: string,
    patch: TodoSubtaskPatch
  ): Promise<TodoItem | null> {
    return this.changeTodo(todoId, (todo) => ({
      ...todo,
      tasks: todo.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              children: task.children.map((child) =>
                child.id === subtaskId ? { ...child, ...patch } : child
              )
            }
          : task
      )
    }))
  }

  async deleteTodoSubtask(
    todoId: string,
    taskId: string,
    subtaskId: string
  ): Promise<TodoItem | null> {
    return this.changeTodo(todoId, (todo) => ({
      ...todo,
      tasks: todo.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              children: task.children.filter((child) => child.id !== subtaskId)
            }
          : task
      )
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
      if (raw.version === 1 || raw.version === 2 || raw.version === 3) {
        await copyFile(this.filePath, `${this.filePath}.backup-${Date.now()}`)
        await this.file.write(migrateNotesFile(raw))
      } else if (raw.version === 4) {
        const normalized = migrateNotesFile(raw)
        await this.file.write(normalized)
      } else {
        throw new Error(`Unsupported notes version: ${raw.version}`)
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError.code !== 'ENOENT') throw error
      await this.file.write({ version: 4, items: [], folders: [] })
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

function siblingReferences(
  data: NotesFile,
  parentFolderId: string | null
): OrderedNodeRef[] {
  return [
    ...data.items
      .filter(
        (item) => !item.deletedAt && item.parentFolderId === parentFolderId
      )
      .map((item) => ({ kind: 'item' as const, id: item.id, order: item.order })),
    ...data.folders
      .filter(
        (folder) =>
          !folder.deletedAt && folder.parentFolderId === parentFolderId
      )
      .map((folder) => ({
        kind: 'folder' as const,
        id: folder.id,
        order: folder.order
      }))
  ]
    .sort((a, b) => a.order - b.order)
    .map(({ kind, id }) => ({ kind, id }))
}

function assignSiblingOrder(
  data: NotesFile,
  orderedNodes: OrderedNodeRef[]
): void {
  orderedNodes.forEach((reference, order) => {
    const collection =
      reference.kind === 'item' ? data.items : data.folders
    const node = collection.find((candidate) => candidate.id === reference.id)
    if (node) node.order = order
  })
}

function nextSiblingOrder(
  data: NotesFile,
  parentFolderId: string | null
): number {
  return siblingReferences(data, parentFolderId).length
}
