import { ipcMain } from 'electron'
import type {
  NoteType,
  StickyItem,
  StickyItemPatch,
  TodoSubtaskPatch,
  TodoTaskPatch
} from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { NoteStore } from '../services/NoteStore'
import type { UndoService } from '../services/UndoService'

interface NoteIpcEvents {
  changed(item: StickyItem): void
  deleted(itemId: string): void
}

export function registerNoteIpc(
  store: NoteStore,
  events: NoteIpcEvents,
  undo?: UndoService
): void {
  ipcMain.handle(ipcChannels.notesList, () => store.list())
  ipcMain.handle(
    ipcChannels.notesCreate,
    async (
      _event,
      type: NoteType,
      title?: string,
      parentFolderId?: string | null
    ) => {
      const item = await store.create(type, title, parentFolderId ?? null)
      events.changed(item)
      return item
    }
  )
  ipcMain.handle(
    ipcChannels.notesUpdate,
    async (_event, id: string, expectedRevision: number, patch: StickyItemPatch) => {
      const before = undo
        ? (await store.list()).find((item) => item.id === id)
        : undefined
      const result = await store.update(id, expectedRevision, patch)
      if (result.status === 'ok') {
        events.changed(result.value)
        if (before && Object.hasOwn(patch, 'pinned') && before.pinned !== patch.pinned) {
          const undoRevision = result.value.revision
          undo?.push({
            label: patch.pinned ? '置顶便签' : '取消置顶',
            execute: async () => {
              const inverse = await store.update(id, undoRevision, {
                pinned: before.pinned
              })
              if (inverse.status !== 'ok') return 'conflict'
              events.changed(inverse.value)
              return 'ok'
            }
          })
        }
      }
      return result
    }
  )
  ipcMain.handle(ipcChannels.notesDelete, async (_event, id: string) => {
    const before = undo
      ? (await store.list()).find((item) => item.id === id)
      : undefined
    const deleted = await store.delete(id)
    if (deleted) {
      events.deleted(id)
      const deletedRevision = before ? before.revision + 1 : null
      if (before && deletedRevision !== null) {
        undo?.push({
          label: '删除便签',
          execute: async () => {
            const current = (await store.listDeleted()).items.find(
              (item) => item.id === id
            )
            if (!current || current.revision !== deletedRevision) return 'conflict'
            if (!await store.restoreItem(id)) return 'conflict'
            const restored = (await store.list()).find((item) => item.id === id)
            if (!restored) return 'conflict'
            events.changed(restored)
            return 'ok'
          }
        })
      }
    }
    return deleted
  })
  ipcMain.handle(
    ipcChannels.todoTaskAdd,
    async (_event, todoId: string, contentMarkdown?: string) => {
      const task = await store.addTodoTask(todoId, contentMarkdown)
      const item = (await store.list()).find((entry) => entry.id === todoId)
      if (item) events.changed(item)
      return task
    }
  )
  ipcMain.handle(
    ipcChannels.todoTaskUpdate,
    async (
      _event,
      todoId: string,
      taskId: string,
      expectedRevision: number | null,
      patch: TodoTaskPatch
    ) => {
      const before = undo
        ? (await store.list()).find((item) => item.id === todoId)
        : undefined
      const result = await store.updateTodoTask(
        todoId, taskId, expectedRevision, patch
      )
      if (result.status === 'ok') {
        events.changed(result.value)
        const previousTask = before?.type === 'todo'
          ? before.tasks.find((task) => task.id === taskId)
          : undefined
        if (
          previousTask &&
          Object.hasOwn(patch, 'completed') &&
          previousTask.completed !== patch.completed
        ) {
          const undoRevision = result.value.revision
          undo?.push({
            label: patch.completed ? '完成待办' : '重新打开待办',
            execute: async () => {
              const inverse = await store.updateTodoTask(
                todoId,
                taskId,
                undoRevision,
                { completed: previousTask.completed }
              )
              if (inverse.status !== 'ok') return 'conflict'
              events.changed(inverse.value)
              return 'ok'
            }
          })
        }
      }
      return result
    }
  )
  ipcMain.handle(
    ipcChannels.todoTaskDelete,
    async (_event, todoId: string, taskId: string) => {
      const result = await store.deleteTodoTask(todoId, taskId)
      if (result.status === 'ok') events.changed(result.value)
      return result
    }
  )
  ipcMain.handle(
    ipcChannels.todoTaskReorder,
    async (_event, todoId: string, taskIds: string[]) => {
      const result = await store.reorderTodoTasks(todoId, taskIds)
      if (result.status === 'ok') events.changed(result.value)
      return result
    }
  )
  ipcMain.handle(
    ipcChannels.todoSubtaskAdd,
    async (
      _event,
      todoId: string,
      taskId: string,
      contentMarkdown?: string
    ) => {
      const child = await store.addTodoSubtask(todoId, taskId, contentMarkdown)
      const item = (await store.list()).find((entry) => entry.id === todoId)
      if (item) events.changed(item)
      return child
    }
  )
  ipcMain.handle(
    ipcChannels.todoSubtaskUpdate,
    async (
      _event,
      todoId: string,
      taskId: string,
      subtaskId: string,
      expectedRevision: number | null,
      patch: TodoSubtaskPatch
    ) => {
      const result = await store.updateTodoSubtask(
        todoId,
        taskId,
        subtaskId,
        expectedRevision,
        patch
      )
      if (result.status === 'ok') events.changed(result.value)
      return result
    }
  )
  ipcMain.handle(
    ipcChannels.todoSubtaskDelete,
    async (
      _event,
      todoId: string,
      taskId: string,
      subtaskId: string
    ) => {
      const result = await store.deleteTodoSubtask(todoId, taskId, subtaskId)
      if (result.status === 'ok') events.changed(result.value)
      return result
    }
  )
}
