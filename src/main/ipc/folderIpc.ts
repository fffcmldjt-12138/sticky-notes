import { ipcMain } from 'electron'
import type { FolderPatch, OrderedNodeRef } from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { NoteStore } from '../services/NoteStore'

export function registerFolderIpc(store: NoteStore): void {
  ipcMain.handle(ipcChannels.foldersList, () => store.listFolders())
  ipcMain.handle(
    ipcChannels.foldersCreate,
    (_event, title: string, parentFolderId?: string | null) =>
      store.createFolder(title, parentFolderId ?? null)
  )
  ipcMain.handle(
    ipcChannels.foldersUpdate,
    (_event, id: string, patch: FolderPatch) => store.updateFolder(id, patch)
  )
  ipcMain.handle(ipcChannels.foldersDelete, (_event, id: string) =>
    store.deleteFolder(id)
  )
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
