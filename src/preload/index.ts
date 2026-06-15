import { contextBridge, ipcRenderer } from 'electron'
import type { StickyApi } from '../shared/electronApi'
import type {
  AppConfig,
  NoteType,
  StickyItem,
  StickyItemPatch
} from '../shared/models'
import { ipcChannels } from '../shared/ipcChannels'

const api: StickyApi = {
  notes: {
    list: () => ipcRenderer.invoke(ipcChannels.notesList),
    create: (type, title) => ipcRenderer.invoke(ipcChannels.notesCreate, type, title),
    update: (id, patch) => ipcRenderer.invoke(ipcChannels.notesUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(ipcChannels.notesDelete, id),
    addTodoTask: (todoId, contentMarkdown) =>
      ipcRenderer.invoke(ipcChannels.todoTaskAdd, todoId, contentMarkdown),
    updateTodoTask: (todoId, taskId, patch) =>
      ipcRenderer.invoke(ipcChannels.todoTaskUpdate, todoId, taskId, patch),
    deleteTodoTask: (todoId, taskId) =>
      ipcRenderer.invoke(ipcChannels.todoTaskDelete, todoId, taskId),
    reorderTodoTasks: (todoId, taskIds) =>
      ipcRenderer.invoke(ipcChannels.todoTaskReorder, todoId, taskIds)
  },
  config: {
    get: () => ipcRenderer.invoke(ipcChannels.configGet),
    update: (patch: Partial<Omit<AppConfig, 'version'>>) =>
      ipcRenderer.invoke(ipcChannels.configUpdate, patch)
  },
  assets: {
    selectImage: () => ipcRenderer.invoke(ipcChannels.assetSelect),
    importImageData: (bytes, mimeType) =>
      ipcRenderer.invoke(ipcChannels.assetImportData, bytes, mimeType)
  },
  folders: {
    list: () => ipcRenderer.invoke(ipcChannels.foldersList),
    create: (title, parentFolderId) =>
      ipcRenderer.invoke(ipcChannels.foldersCreate, title, parentFolderId),
    update: (id, patch) =>
      ipcRenderer.invoke(ipcChannels.foldersUpdate, id, patch),
    moveItem: (itemId, parentFolderId) =>
      ipcRenderer.invoke(ipcChannels.foldersMoveItem, itemId, parentFolderId)
  },
  window: {
    expand: () => ipcRenderer.send(ipcChannels.windowExpand),
    scheduleCollapse: () => ipcRenderer.send(ipcChannels.windowScheduleCollapse),
    cancelCollapse: () => ipcRenderer.send(ipcChannels.windowCancelCollapse),
    hide: () => ipcRenderer.send(ipcChannels.windowHide),
    suspendAutoHide: (value) =>
      ipcRenderer.send(ipcChannels.windowSuspendAutoHide, value),
    detach: (itemId) => ipcRenderer.invoke(ipcChannels.windowDetach, itemId),
    attach: (itemId) => ipcRenderer.invoke(ipcChannels.windowAttach, itemId),
    openExternal: (url) => ipcRenderer.invoke(ipcChannels.windowOpenExternal, url)
  },
  onOpenEditor: (callback: (type: NoteType) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, type: NoteType): void =>
      callback(type)
    ipcRenderer.on(ipcChannels.openEditor, listener)
    return () => ipcRenderer.removeListener(ipcChannels.openEditor, listener)
  },
  onItemChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, item: StickyItem): void =>
      callback(item)
    ipcRenderer.on(ipcChannels.itemChanged, listener)
    return () => ipcRenderer.removeListener(ipcChannels.itemChanged, listener)
  },
  onItemDeleted: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, itemId: string): void =>
      callback(itemId)
    ipcRenderer.on(ipcChannels.itemDeleted, listener)
    return () => ipcRenderer.removeListener(ipcChannels.itemDeleted, listener)
  }
}

contextBridge.exposeInMainWorld('stickyApi', api)
