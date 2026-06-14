import { ipcMain } from 'electron'
import type {
  NoteType,
  StickyItem,
  StickyItemPatch,
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
    async (_event, type: NoteType, title?: string) => {
      const item = await store.create(type, title)
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
}
