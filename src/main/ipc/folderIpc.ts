import { ipcMain } from 'electron'
import type { FolderItem, FolderPatch, OrderedNodeRef } from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { NoteStore } from '../services/NoteStore'

interface FolderIpcEvents {
  beforeDelete(folderId: string): void
  changed(folder: FolderItem): void
  deleted(folderId: string): void
}

const noFolderEvents: FolderIpcEvents = {
  beforeDelete: () => undefined,
  changed: () => undefined,
  deleted: () => undefined
}

export function registerFolderIpc(
  store: NoteStore,
  events: FolderIpcEvents = noFolderEvents
): void {
  ipcMain.handle(ipcChannels.foldersList, () => store.listFolders())
  ipcMain.handle(
    ipcChannels.foldersCreate,
    async (_event, title: string, parentFolderId?: string | null) => {
      const folder = await store.createFolder(title, parentFolderId ?? null)
      events.changed(folder)
      return folder
    }
  )
  ipcMain.handle(
    ipcChannels.foldersUpdate,
    async (_event, id: string, patch: FolderPatch) => {
      const folder = await store.updateFolder(id, patch)
      if (folder) events.changed(folder)
      return folder
    }
  )
  ipcMain.handle(ipcChannels.foldersDelete, async (_event, id: string) => {
    events.beforeDelete(id)
    const deleted = await store.deleteFolder(id)
    if (deleted) events.deleted(id)
    return deleted
  })
  ipcMain.handle(
    ipcChannels.foldersMoveItem,
    (_event, itemId: string, parentFolderId: string | null) =>
      store.moveItem(itemId, parentFolderId)
  )
  ipcMain.handle(
    ipcChannels.foldersReorderChildren,
    (
      _event,
      parentFolderId: string | null,
      orderedNodes: OrderedNodeRef[]
    ) => store.reorderChildren(parentFolderId, orderedNodes)
  )
}
