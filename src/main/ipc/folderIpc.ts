import { ipcMain } from 'electron'
import type { FolderItem, FolderPatch, OrderedNodeRef } from '../../shared/models'
import { ipcChannels } from '../../shared/ipcChannels'
import type { NoteStore } from '../services/NoteStore'
import type { UndoService } from '../services/UndoService'

interface FolderIpcEvents {
  beforeDelete(folderId: string): void
  changed(folder: FolderItem): void
  deleted(folderId: string): void
  itemChanged?(item: import('../../shared/models').StickyItem): void
}

const noFolderEvents: FolderIpcEvents = {
  beforeDelete: () => undefined,
  changed: () => undefined,
  deleted: () => undefined
}

export function registerFolderIpc(
  store: NoteStore,
  events: FolderIpcEvents = noFolderEvents,
  undo?: UndoService
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
    async (_event, id: string, expectedRevision: number, patch: FolderPatch) => {
      const result = await store.updateFolder(id, expectedRevision, patch)
      if (result.status === 'ok') events.changed(result.value)
      return result
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
    async (_event, itemId: string, parentFolderId: string | null) => {
      const before = undo
        ? (await store.list()).find((item) => item.id === itemId)
        : undefined
      const moved = await store.moveItem(itemId, parentFolderId)
      if (moved) events.itemChanged?.(moved)
      if (moved && before && before.parentFolderId !== parentFolderId) {
        undo?.push({
          label: '移动便签',
          execute: async () => {
            const current = (await store.list()).find((item) => item.id === itemId)
            if (!current || current.revision !== moved.revision) return 'conflict'
            const restored = await store.moveItem(itemId, before.parentFolderId)
            if (!restored) return 'conflict'
            events.itemChanged?.(restored)
            return 'ok'
          }
        })
      }
      return moved
    }
  )
  ipcMain.handle(
    ipcChannels.foldersReorderChildren,
    async (
      _event,
      parentFolderId: string | null,
      orderedNodes: OrderedNodeRef[]
    ) => {
      const beforeItems = undo ? await store.list() : []
      const beforeFolders = undo ? await store.listFolders() : []
      const affectedParents = new Set<string | null>([parentFolderId])
      for (const reference of orderedNodes) {
        const entity = reference.kind === 'item'
          ? beforeItems.find((item) => item.id === reference.id)
          : beforeFolders.find((folder) => folder.id === reference.id)
        if (entity) affectedParents.add(entity.parentFolderId)
      }
      const previousOrders = [...affectedParents].map((parent) => ({
        parent,
        nodes: siblingOrder(beforeItems, beforeFolders, parent)
      }))

      await store.reorderChildren(parentFolderId, orderedNodes)

      if (undo && orderedNodes.length > 0) {
        const afterItems = await store.list()
        const afterFolders = await store.listFolders()
        const revisions = new Map<string, number>([
          ...afterItems.map((item) => [`item:${item.id}`, item.revision] as const),
          ...afterFolders.map((folder) => [
            `folder:${folder.id}`, folder.revision
          ] as const)
        ])
        undo.push({
          label: '移动项目',
          execute: async () => {
            const currentItems = await store.list()
            const currentFolders = await store.listFolders()
            for (const reference of orderedNodes) {
              const entity = reference.kind === 'item'
                ? currentItems.find((item) => item.id === reference.id)
                : currentFolders.find((folder) => folder.id === reference.id)
              if (
                !entity ||
                entity.revision !== revisions.get(`${reference.kind}:${reference.id}`)
              ) return 'conflict'
            }
            for (const previous of previousOrders) {
              await store.reorderChildren(previous.parent, previous.nodes)
            }
            const restoredItems = await store.list()
            const restoredFolders = await store.listFolders()
            restoredItems.forEach((item) => events.itemChanged?.(item))
            restoredFolders.forEach((folder) => events.changed(folder))
            return 'ok'
          }
        })
      }
    }
  )
}

function siblingOrder(
  items: Awaited<ReturnType<NoteStore['list']>>,
  folders: Awaited<ReturnType<NoteStore['listFolders']>>,
  parentFolderId: string | null
): OrderedNodeRef[] {
  return [
    ...items
      .filter((item) => item.parentFolderId === parentFolderId)
      .map((item) => ({ kind: 'item' as const, id: item.id, order: item.order })),
    ...folders
      .filter((folder) => folder.parentFolderId === parentFolderId)
      .map((folder) => ({
        kind: 'folder' as const,
        id: folder.id,
        order: folder.order
      }))
  ]
    .sort((left, right) => left.order - right.order)
    .map(({ kind, id }) => ({ kind, id }))
}
