import { ipcMain } from 'electron'
import type {
  NoteType,
  StickyItemPatch,
  TodoTaskPatch
} from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { NoteStore } from '../services/NoteStore'

export function registerNoteIpc(store: NoteStore): void {
  ipcMain.handle(ipcChannels.notesList, () => store.list())
  ipcMain.handle(
    ipcChannels.notesCreate,
    (_event, type: NoteType, title?: string) => store.create(type, title)
  )
  ipcMain.handle(
    ipcChannels.notesUpdate,
    (_event, id: string, patch: StickyItemPatch) => store.update(id, patch)
  )
  ipcMain.handle(ipcChannels.notesDelete, (_event, id: string) => store.delete(id))
  ipcMain.handle(
    ipcChannels.todoTaskAdd,
    (_event, todoId: string, contentMarkdown?: string) =>
      store.addTodoTask(todoId, contentMarkdown)
  )
  ipcMain.handle(
    ipcChannels.todoTaskUpdate,
    (_event, todoId: string, taskId: string, patch: TodoTaskPatch) =>
      store.updateTodoTask(todoId, taskId, patch)
  )
  ipcMain.handle(
    ipcChannels.todoTaskDelete,
    (_event, todoId: string, taskId: string) =>
      store.deleteTodoTask(todoId, taskId)
  )
  ipcMain.handle(
    ipcChannels.todoTaskReorder,
    (_event, todoId: string, taskIds: string[]) =>
      store.reorderTodoTasks(todoId, taskIds)
  )
}
