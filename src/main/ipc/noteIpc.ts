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

interface NoteIpcEvents {
  changed(item: StickyItem): void
  deleted(itemId: string): void
}

export function registerNoteIpc(store: NoteStore, events: NoteIpcEvents): void {
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
    async (_event, id: string, patch: StickyItemPatch) => {
      const item = await store.update(id, patch)
      if (item) events.changed(item)
      return item
    }
  )
  ipcMain.handle(ipcChannels.notesDelete, async (_event, id: string) => {
    const deleted = await store.delete(id)
    if (deleted) events.deleted(id)
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
    async (_event, todoId: string, taskId: string, patch: TodoTaskPatch) => {
      const item = await store.updateTodoTask(todoId, taskId, patch)
      if (item) events.changed(item)
      return item
    }
  )
  ipcMain.handle(
    ipcChannels.todoTaskDelete,
    async (_event, todoId: string, taskId: string) => {
      const item = await store.deleteTodoTask(todoId, taskId)
      if (item) events.changed(item)
      return item
    }
  )
  ipcMain.handle(
    ipcChannels.todoTaskReorder,
    async (_event, todoId: string, taskIds: string[]) => {
      const item = await store.reorderTodoTasks(todoId, taskIds)
      if (item) events.changed(item)
      return item
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
      patch: TodoSubtaskPatch
    ) => {
      const item = await store.updateTodoSubtask(
        todoId,
        taskId,
        subtaskId,
        patch
      )
      if (item) events.changed(item)
      return item
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
      const item = await store.deleteTodoSubtask(todoId, taskId, subtaskId)
      if (item) events.changed(item)
      return item
    }
  )
}
