import { constants } from 'node:fs'
import { copyFile, readFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
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
  TodoSchedule,
  TodoTask,
  TodoTaskPatch
} from '../../shared/models'
import { BackupService } from './BackupService'
import { SafeJsonStore } from './SafeJsonStore'
import { migrateNotesFile } from './noteMigration'
import {
  DataUnavailableError,
  UnsupportedDataVersionError
} from './storageErrors'
import {
  migrateAndValidateRecoverableNotesFile,
  validateAppConfig,
  validateNotesFile
} from './storageValidators'

export class NoteStore {
  private readonly filePath: string
  private readonly file: SafeJsonStore<NotesFile>
  private readonly backups: BackupService
  private mutationQueue: Promise<void> = Promise.resolve()
  private initialized: Promise<void> | null = null

  constructor(userDataPath: string, backups?: BackupService) {
    this.filePath = join(userDataPath, 'notes.json')
    this.backups = backups ?? new BackupService(join(userDataPath, 'backups'), {
      notes: validateNotesFile,
      config: validateAppConfig
    })
    this.file = new SafeJsonStore(
      this.filePath,
      createDefaultNotes,
      validateNotesFile,
      (path, value) => this.backups.beforeReplace('notes', path, value),
      (path, value) => this.backups.afterReplace('notes', path, value),
      (error, phase) => console.error(`notes ${phase} backup failed`, error)
    )
  }

  async list(): Promise<StickyItem[]> {
    await this.ensureInitialized()
    await this.mutationQueue
    return (await this.file.read()).items.filter((item) => !item.deletedAt)
  }

  async getSnapshot(): Promise<NotesFile> {
    await this.ensureInitialized()
    return this.mutate(async () => structuredClone(await this.file.read()))
  }

  async replaceSnapshot(
    value: NotesFile,
    _reason: 'restore' | 'import'
  ): Promise<void> {
    const candidate = structuredClone(value)
    validateNotesFile(candidate)
    await this.ensureInitialized()
    return this.mutate(async () => {
      const current = validateNotesFile(await this.file.read())
      await this.backups.recordProtected('notes', current)
      validateNotesFile(candidate)
      await this.file.write(candidate)
    })
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
        revision: 1,
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
        revision: 1,
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
          : {
              ...base,
              type,
              tasks: [createTodoTask()],
              panelExpanded: false
            }

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
    let task = createTodoTask(contentMarkdown)
    const updated = await this.changeTodo(todoId, (todo) => {
      const reusable = todo.tasks.find(isReusableBlankTask)
      if (reusable) {
        task = { ...reusable, contentMarkdown }
        return {
          ...todo,
          tasks: todo.tasks.map((entry) =>
            entry.id === reusable.id ? task : entry
          )
        }
      }
      return {
        ...todo,
        tasks: [...todo.tasks, task]
      }
    })
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
        const scheduleRulesChanged =
          Object.hasOwn(patch, 'schedule') &&
          scheduleRuleKey(patch.schedule ?? null) !==
            scheduleRuleKey(task.schedule)
        const updated = { ...task, ...patch }
        if (Object.hasOwn(patch, 'completed') && task.children.length > 0) {
          updated.children = task.children.map((child) => ({
            ...child,
            completed: Boolean(patch.completed)
          }))
        }
        if (scheduleRulesChanged && updated.schedule) {
          updated.schedule = {
            ...updated.schedule,
            reminders: updated.schedule.reminders.map((reminder) => ({
              ...reminder,
              remindedAt: null,
              snoozedUntil: null
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
          ? updateTaskSubtask(task, subtaskId, patch)
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

  async snoozeReminder(
    target: {
      itemId: string
      taskId: string
      subtaskId?: string
      reminderId: string
    },
    snoozedUntil: Date
  ): Promise<TodoItem | null> {
    return this.changeTodo(target.itemId, (todo) => ({
      ...todo,
      tasks: todo.tasks.map((task) => {
        if (task.id !== target.taskId) return task
        if (target.subtaskId) {
          return {
            ...task,
            children: task.children.map((child) =>
              child.id === target.subtaskId
                ? {
                    ...child,
                    schedule: snoozeSchedule(
                      child.schedule,
                      target.reminderId,
                      snoozedUntil
                    )
                  }
                : child
            )
          }
        }
        return {
          ...task,
          schedule: snoozeSchedule(
            task.schedule,
            target.reminderId,
            snoozedUntil
          )
        }
      })
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
    let contents: Buffer
    try {
      contents = await readFile(this.filePath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.file.read()
        return
      }
      throw new DataUnavailableError('notes', error)
    }

    let raw: unknown
    try {
      raw = JSON.parse(contents.toString('utf8')) as unknown
    } catch (error) {
      await this.recover(contents, error)
      return
    }

    const version = persistedVersion(raw)
    if (Number.isSafeInteger(version) && Number(version) > 5) {
      throw new UnsupportedDataVersionError('notes', version)
    }
    if (version === 5) {
      try {
        validateNotesFile(raw)
      } catch (error) {
        await this.recover(contents, error)
      }
      return
    }
    if (version === 1 || version === 2 || version === 3 || version === 4) {
      let migrated: NotesFile
      try {
        migrated = validateNotesFile(migrateNotesFile(raw))
      } catch (error) {
        await this.recover(contents, error)
        return
      }
      const backupPath = `${this.filePath}.backup-${Date.now()}-${randomUUID()}`
      await copyFile(this.filePath, backupPath, constants.COPYFILE_EXCL)
      await this.file.replaceInvalid(migrated, backupPath)
      validateNotesFile(await this.file.read())
      return
    }
    await this.recover(
      contents,
      new Error(`Invalid notes version: ${String(version)}`)
    )
  }

  private async recover(contents: Buffer, cause: unknown): Promise<void> {
    const corruptPath = corruptCopyPath(this.filePath, contents)
    const backup = await this.backups.findNewestValid(
      'notes',
      migrateAndValidateRecoverableNotesFile
    )
    if (!backup) {
      await preserveCorruptCopy(this.filePath, corruptPath)
      throw new DataUnavailableError('notes', cause)
    }

    const candidate = validateNotesFile(backup.value)
    await this.file.replaceInvalid(candidate, corruptPath)
    validateNotesFile(await this.file.read())
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

function createDefaultNotes(): NotesFile {
  return { version: 5, items: [], folders: [] }
}

function persistedVersion(value: unknown): unknown {
  return value && typeof value === 'object' && 'version' in value
    ? value.version
    : undefined
}

function corruptCopyPath(filePath: string, contents: Buffer): string {
  const digest = createHash('sha256').update(contents).digest('hex')
  return `${filePath}.corrupt-${digest}`
}

async function preserveCorruptCopy(
  filePath: string,
  corruptPath: string
): Promise<void> {
  try {
    await copyFile(filePath, corruptPath, constants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
}

function applySubtaskPatch(
  child: TodoSubtask,
  patch: TodoSubtaskPatch
): TodoSubtask {
  const scheduleRulesChanged =
    Object.hasOwn(patch, 'schedule') &&
    scheduleRuleKey(patch.schedule ?? null) !== scheduleRuleKey(child.schedule)
  const updated = { ...child, ...patch }
  if (scheduleRulesChanged && updated.schedule) {
    updated.schedule = {
      ...updated.schedule,
      reminders: updated.schedule.reminders.map((reminder) => ({
        ...reminder,
        remindedAt: null,
        snoozedUntil: null
      }))
    }
  }
  return updated
}

function updateTaskSubtask(
  task: TodoTask,
  subtaskId: string,
  patch: TodoSubtaskPatch
): TodoTask {
  const children = task.children.map((child) =>
    child.id === subtaskId ? applySubtaskPatch(child, patch) : child
  )
  return {
    ...task,
    children,
    completed: children.length > 0 && children.every((child) => child.completed)
  }
}

function snoozeSchedule(
  schedule: TodoSchedule | null,
  reminderId: string,
  snoozedUntil: Date
): TodoSchedule | null {
  if (!schedule) return null
  return {
    ...schedule,
    reminders: schedule.reminders.map((reminder) =>
      reminder.id === reminderId
        ? {
            ...reminder,
            remindedAt: null,
            snoozedUntil: snoozedUntil.toISOString()
          }
        : reminder
    )
  }
}

function createTodoTask(contentMarkdown = ''): TodoTask {
  return {
    id: `task_${randomUUID()}`,
    contentMarkdown,
    completed: false,
    tags: [],
    importance: 'normal',
    urgency: 'normal',
    children: [],
    schedule: null
  }
}

function isReusableBlankTask(task: TodoTask): boolean {
  return (
    !task.contentMarkdown.trim() &&
    !task.completed &&
    task.importance === 'normal' &&
    task.urgency === 'normal' &&
    task.children.length === 0 &&
    !task.schedule &&
    task.tags.length === 0
  )
}

function scheduleRuleKey(schedule: TodoSchedule | null): string {
  if (!schedule) return 'none'
  return JSON.stringify({
    mode: schedule.mode,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    repeat: schedule.repeat,
    reminders: schedule.reminders
      .map(({ id, offsetMinutes }) => ({ id, offsetMinutes }))
      .sort((left, right) =>
        left.offsetMinutes - right.offsetMinutes || left.id.localeCompare(right.id)
      )
  })
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
