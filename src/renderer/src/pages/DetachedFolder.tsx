import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  FolderItem,
  NoteType,
  OrderedNodeRef,
  StickyItem,
  StickyItemPatch,
  TodoTaskPatch
} from '../../../shared/models'
import type { DetachWindowOptions } from '../../../shared/electronApi'
import { CardContextMenu, type CardAction } from '../components/CardContextMenu'
import { CreateMenu } from '../components/CreateMenu'
import { FolderContextMenu } from '../components/FolderContextMenu'
import { FolderDialog } from '../components/FolderDialog'
import { FolderCard } from '../components/FolderCard'
import { TreeDndContext } from '../components/TreeDndContext'
import { NoteEditor } from '../components/NoteEditor'
import { TodoEditor } from '../components/TodoEditor'
import { TitleDialog } from '../components/TitleDialog'
import { buildFolderTree } from '../lib/folderTree'
import type { FolderTreeNode } from '../lib/folderTree'

function findFolderNode(
  folders: FolderTreeNode[],
  folderId: string
): FolderTreeNode | undefined {
  for (const folder of folders) {
    if (folder.id === folderId) return folder
    const nested = findFolderNode(folder.children, folderId)
    if (nested) return nested
  }
  return undefined
}

export function DetachedFolder({
  folderId
}: {
  folderId: string
}): React.JSX.Element {
  const [items, setItems] = useState<StickyItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createParentId, setCreateParentId] = useState(folderId)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [pendingRename, setPendingRename] = useState<StickyItem | null>(null)
  const [pendingFolderRename, setPendingFolderRename] =
    useState<FolderTreeNode | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    item: StickyItem
    x: number
    y: number
  } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{
    folder: FolderTreeNode
    x: number
    y: number
  } | null>(null)

  const load = useCallback(async () => {
    const [nextItems, nextFolders] = await Promise.all([
      window.stickyApi.notes.list(),
      window.stickyApi.folders.list()
    ])
    setItems(nextItems)
    setFolders(nextFolders)
    if (!nextFolders.some((folder) => folder.id === folderId)) {
      setError('文件夹不存在或已被删除')
    }
  }, [folderId])

  useEffect(() => {
    void load()
    const removeChanged = window.stickyApi.onItemChanged((changed) => {
      setItems((current) =>
        current.map((item) => item.id === changed.id ? changed : item)
      )
    })
    const removeDeleted = window.stickyApi.onItemDeleted((deletedId) => {
      setItems((current) => current.filter((item) => item.id !== deletedId))
      setSelectedItemId((current) => current === deletedId ? null : current)
    })
    const removeReloaded = window.stickyApi.onDataReloaded(() => void load())
    return () => {
      removeChanged()
      removeDeleted()
      removeReloaded()
    }
  }, [load])

  const root = useMemo(
    () => findFolderNode(buildFolderTree(folders, items).folders, folderId),
    [folderId, folders, items]
  )
  const selected = items.find((item) => item.id === selectedItemId) ?? null

  const save = useCallback(async (id: string, patch: StickyItemPatch) => {
    const updated = await window.stickyApi.notes.update(id, patch)
    if (updated) {
      setItems((current) =>
        current.map((item) => item.id === updated.id ? updated : item)
      )
    }
  }, [])

  async function updateTask(
    todoId: string,
    taskId: string,
    patch: TodoTaskPatch
  ): Promise<void> {
    const updated = await window.stickyApi.notes.updateTodoTask(
      todoId,
      taskId,
      patch
    )
    if (updated) {
      setItems((current) =>
        current.map((item) => item.id === updated.id ? updated : item)
      )
    }
  }

  async function reorder(
    parentFolderId: string | null,
    orderedNodes: OrderedNodeRef[]
  ): Promise<void> {
    try {
      await window.stickyApi.folders.reorderChildren(
        parentFolderId,
        orderedNodes
      )
      await load()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '移动失败')
    }
  }

  async function createItem(type: NoteType, parentFolderId: string): Promise<void> {
    const created = await window.stickyApi.notes.create(
      type,
      undefined,
      parentFolderId
    )
    setCreateOpen(false)
    await load()
    setSelectedItemId(created.id)
  }

  async function handleCardAction(
    item: StickyItem,
    action: CardAction
  ): Promise<void> {
    if (action.type === 'edit') setSelectedItemId(item.id)
    if (action.type === 'rename') setPendingRename(item)
    if (action.type === 'color') await save(item.id, { headerColor: action.color })
    if (action.type === 'theme') await save(item.id, { bodyTheme: action.theme })
    if (action.type === 'pin') await save(item.id, { pinned: action.pinned })
    if (action.type === 'add-task' && item.type === 'todo') {
      await window.stickyApi.notes.addTodoTask(item.id)
      await load()
      setSelectedItemId(item.id)
    }
    if (action.type === 'detach') {
      if (item.detached) await window.stickyApi.window.attach(item.id)
      else await window.stickyApi.window.detach(item.id)
      await load()
    }
    if (action.type === 'delete') {
      if (!window.confirm(`确定删除“${item.title || '无标题'}”吗？`)) return
      await window.stickyApi.notes.delete(item.id)
      await load()
    }
  }

  if (error) return <div className="detached-error">{error}</div>
  if (!root) return <div className="detached-loading">正在加载...</div>

  if (selected?.type === 'note') {
    return (
      <NoteEditor
        item={selected}
        onSave={(patch) => void save(selected.id, patch)}
        onBack={() => setSelectedItemId(null)}
        onDelete={async () => {
          if (!window.confirm(`确定删除“${selected.title}”吗？`)) return
          await window.stickyApi.notes.delete(selected.id)
          setSelectedItemId(null)
          await load()
        }}
      />
    )
  }

  if (selected?.type === 'todo') {
    return (
      <TodoEditor
        item={selected}
        onSave={(patch) => void save(selected.id, patch)}
        onAddTask={async () => {
          await window.stickyApi.notes.addTodoTask(selected.id)
          await load()
        }}
        onUpdateTask={(taskId, patch) =>
          void updateTask(selected.id, taskId, patch)
        }
        onDeleteTask={async (taskId) => {
          await window.stickyApi.notes.deleteTodoTask(selected.id, taskId)
          await load()
        }}
        onReorderTasks={async (taskIds) => {
          await window.stickyApi.notes.reorderTodoTasks(selected.id, taskIds)
          await load()
        }}
        onAddSubtask={async (taskId) => {
          await window.stickyApi.notes.addTodoSubtask(selected.id, taskId)
          await load()
        }}
        onUpdateSubtask={async (taskId, subtaskId, patch) => {
          await window.stickyApi.notes.updateTodoSubtask(
            selected.id,
            taskId,
            subtaskId,
            patch
          )
          await load()
        }}
        onDeleteSubtask={async (taskId, subtaskId) => {
          await window.stickyApi.notes.deleteTodoSubtask(
            selected.id,
            taskId,
            subtaskId
          )
          await load()
        }}
        onBack={() => setSelectedItemId(null)}
        onDelete={async () => {
          if (!window.confirm(`确定删除“${selected.title}”吗？`)) return
          await window.stickyApi.notes.delete(selected.id)
          setSelectedItemId(null)
          await load()
        }}
      />
    )
  }

  return (
    <TreeDndContext
      items={items}
      folders={folders}
      onReorder={(parentId, orderedNodes) =>
        void reorder(parentId, orderedNodes)
      }
      onDetachItem={(item, options?: DetachWindowOptions) =>
        void window.stickyApi.window.detach(item.id, options)
      }
      onDetachFolder={(folder, options?: DetachWindowOptions) =>
        void window.stickyApi.window.detachFolder(folder.id, options)
      }
    >
      <section className="detached-folder-shell">
      <header className="detached-folder-header">
        <strong>{root.title}</strong>
        <div className="detached-folder-actions">
          <button
            className="primary-button"
            onClick={() => {
              setCreateParentId(root.id)
              setCreateOpen((open) => !open)
            }}
          >
            ＋ 新建
          </button>
          <button
            className="icon-button"
            aria-label="关闭文件夹窗口"
            onClick={() => void window.stickyApi.window.attachFolder(folderId)}
          >
            ×
          </button>
        </div>
      </header>
      {createOpen && (
        <CreateMenu
          onCreate={(type) => void createItem(type, createParentId)}
          canCreateFolder={folderDepth(folders, createParentId) < 3}
          onCreateFolder={() => {
            setCreateOpen(false)
            setFolderDialogOpen(true)
          }}
          onClose={() => setCreateOpen(false)}
        />
      )}
      <div className="detached-folder-tree">
        <FolderCard
          node={root}
          onOpenItem={(item) => setSelectedItemId(item.id)}
          onItemContextMenu={(item, event) =>
            setContextMenu({
              item,
              x: event.clientX,
              y: event.clientY
            })
          }
          onToggle={async (folder) => {
            await window.stickyApi.folders.update(folder.id, {
              collapsed: !folder.collapsed
            })
            await load()
          }}
          onContextMenu={(folder, event) =>
            setFolderContextMenu({
              folder,
              x: event.clientX,
              y: event.clientY
            })
          }
          onCreate={(folder) => {
            setCreateParentId(folder.id)
            setCreateOpen(true)
          }}
        />
      </div>
      {contextMenu && (
        <CardContextMenu
          item={contextMenu.item}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onAction={(action) =>
            void handleCardAction(contextMenu.item, action)
          }
          onClose={() => setContextMenu(null)}
        />
      )}
      {folderContextMenu && (
        <FolderContextMenu
          position={{ x: folderContextMenu.x, y: folderContextMenu.y }}
          canCreateFolder={
            folderDepth(folders, folderContextMenu.folder.id) < 3
          }
          onCreate={(type) => {
            const targetId = folderContextMenu.folder.id
            setFolderContextMenu(null)
            setCreateParentId(targetId)
            if (type === 'folder') {
              setFolderDialogOpen(true)
            } else {
              void createItem(type, targetId)
            }
          }}
          onRename={() => {
            setPendingFolderRename(folderContextMenu.folder)
            setFolderContextMenu(null)
          }}
          onDelete={() => {
            const target = folderContextMenu.folder
            setFolderContextMenu(null)
            if (!window.confirm(`确定删除“${target.title}”吗？其中内容会移到上一级。`)) {
              return
            }
            void window.stickyApi.folders.delete(target.id).then(load)
          }}
          onClose={() => setFolderContextMenu(null)}
        />
      )}
      {folderDialogOpen && (
        <FolderDialog
          onConfirm={async (title) => {
            await window.stickyApi.folders.create(title, createParentId)
            setFolderDialogOpen(false)
            await load()
          }}
          onCancel={() => setFolderDialogOpen(false)}
        />
      )}
      {pendingRename && (
        <TitleDialog
          type={pendingRename.type}
          initialTitle={pendingRename.title}
          onConfirm={(title) => {
            void save(pendingRename.id, { title })
            setPendingRename(null)
          }}
          onCancel={() => setPendingRename(null)}
        />
      )}
      {pendingFolderRename && (
        <FolderDialog
          initialTitle={pendingFolderRename.title}
          onConfirm={async (title) => {
            await window.stickyApi.folders.update(pendingFolderRename.id, {
              title
            })
            setPendingFolderRename(null)
            await load()
          }}
          onCancel={() => setPendingFolderRename(null)}
        />
      )}
      </section>
    </TreeDndContext>
  )
}

function folderDepth(folders: FolderItem[], folderId: string): number {
  let depth = 0
  let current: string | null = folderId
  while (current) {
    depth += 1
    current = folders.find((folder) => folder.id === current)?.parentFolderId ?? null
  }
  return depth
}
