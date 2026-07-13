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
    create: (type, title, parentFolderId) =>
      ipcRenderer.invoke(
        ipcChannels.notesCreate,
        type,
        title,
        parentFolderId
      ),
    update: (id, patch) => ipcRenderer.invoke(ipcChannels.notesUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(ipcChannels.notesDelete, id),
    addTodoTask: (todoId, contentMarkdown) =>
      ipcRenderer.invoke(ipcChannels.todoTaskAdd, todoId, contentMarkdown),
    updateTodoTask: (todoId, taskId, patch) =>
      ipcRenderer.invoke(ipcChannels.todoTaskUpdate, todoId, taskId, patch),
    deleteTodoTask: (todoId, taskId) =>
      ipcRenderer.invoke(ipcChannels.todoTaskDelete, todoId, taskId),
    reorderTodoTasks: (todoId, taskIds) =>
      ipcRenderer.invoke(ipcChannels.todoTaskReorder, todoId, taskIds),
    addTodoSubtask: (todoId, taskId, contentMarkdown) =>
      ipcRenderer.invoke(
        ipcChannels.todoSubtaskAdd,
        todoId,
        taskId,
        contentMarkdown
      ),
    updateTodoSubtask: (todoId, taskId, subtaskId, patch) =>
      ipcRenderer.invoke(
        ipcChannels.todoSubtaskUpdate,
        todoId,
        taskId,
        subtaskId,
        patch
      ),
    deleteTodoSubtask: (todoId, taskId, subtaskId) =>
      ipcRenderer.invoke(
        ipcChannels.todoSubtaskDelete,
        todoId,
        taskId,
        subtaskId
      )
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
    delete: (id) => ipcRenderer.invoke(ipcChannels.foldersDelete, id),
    moveItem: (itemId, parentFolderId) =>
      ipcRenderer.invoke(ipcChannels.foldersMoveItem, itemId, parentFolderId),
    reorderChildren: (parentFolderId, orderedNodes) =>
      ipcRenderer.invoke(
        ipcChannels.foldersReorderChildren,
        parentFolderId,
        orderedNodes
      )
  },
  recycle: {
    list: () => ipcRenderer.invoke(ipcChannels.recycleList),
    restoreItem: (id) =>
      ipcRenderer.invoke(ipcChannels.recycleRestoreItem, id),
    restoreFolder: (id) =>
      ipcRenderer.invoke(ipcChannels.recycleRestoreFolder, id),
    empty: () => ipcRenderer.invoke(ipcChannels.recycleEmpty),
    cleanUnusedImages: () =>
      ipcRenderer.invoke(ipcChannels.recycleCleanUnusedImages)
  },
  reminder: {
    respond: (action) =>
      ipcRenderer.invoke(ipcChannels.reminderWindowAction, action)
  },
  window: {
    expand: () => ipcRenderer.send(ipcChannels.windowExpand),
    scheduleCollapse: () => ipcRenderer.send(ipcChannels.windowScheduleCollapse),
    cancelCollapse: () => ipcRenderer.send(ipcChannels.windowCancelCollapse),
    hide: () => ipcRenderer.send(ipcChannels.windowHide),
    suspendAutoHide: (value) =>
      ipcRenderer.send(ipcChannels.windowSuspendAutoHide, value),
    detach: (itemId, options) =>
      ipcRenderer.invoke(ipcChannels.windowDetach, itemId, options),
    attach: (itemId) => ipcRenderer.invoke(ipcChannels.windowAttach, itemId),
    detachFolder: (folderId, options) =>
      ipcRenderer.invoke(ipcChannels.windowDetachFolder, folderId, options),
    attachFolder: (folderId) =>
      ipcRenderer.invoke(ipcChannels.windowAttachFolder, folderId),
    openExternal: (url) => ipcRenderer.invoke(ipcChannels.windowOpenExternal, url),
    startDragPreview: (payload) =>
      ipcRenderer.send(ipcChannels.windowDragPreviewStart, payload),
    stopDragPreview: () => ipcRenderer.send(ipcChannels.windowDragPreviewStop)
  },
  onOpenEditor: (callback: (type: NoteType) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, type: NoteType): void =>
      callback(type)
    ipcRenderer.on(ipcChannels.openEditor, listener)
    return () => ipcRenderer.removeListener(ipcChannels.openEditor, listener)
  },
  onOpenItem: (callback: (itemId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, itemId: string): void =>
      callback(itemId)
    ipcRenderer.on(ipcChannels.openItem, listener)
    return () => ipcRenderer.removeListener(ipcChannels.openItem, listener)
  },
  onItemChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, item: StickyItem): void =>
      callback(item)
    ipcRenderer.on(ipcChannels.itemChanged, listener)
    return () => ipcRenderer.removeListener(ipcChannels.itemChanged, listener)
  },
  onFolderChanged: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      folder: Parameters<typeof callback>[0]
    ): void => callback(folder)
    ipcRenderer.on(ipcChannels.folderChanged, listener)
    return () => ipcRenderer.removeListener(ipcChannels.folderChanged, listener)
  },
  onFolderDeleted: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      folderId: string
    ): void => callback(folderId)
    ipcRenderer.on(ipcChannels.folderDeleted, listener)
    return () => ipcRenderer.removeListener(ipcChannels.folderDeleted, listener)
  },
  onItemDeleted: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, itemId: string): void =>
      callback(itemId)
    ipcRenderer.on(ipcChannels.itemDeleted, listener)
    return () => ipcRenderer.removeListener(ipcChannels.itemDeleted, listener)
  },
  onReminderFired: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof callback>[0]
    ): void => callback(payload)
    ipcRenderer.on(ipcChannels.reminderFired, listener)
    return () => ipcRenderer.removeListener(ipcChannels.reminderFired, listener)
  }
}

contextBridge.exposeInMainWorld('stickyApi', api)
