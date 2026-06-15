import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  FolderItem,
  OrderedNodeRef,
  StickyItem,
  StickyItemPatch,
  TodoTaskPatch
} from '../../../shared/models'
import { FolderCard } from '../components/FolderCard'
import { NoteEditor } from '../components/NoteEditor'
import { TodoEditor } from '../components/TodoEditor'
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
    return () => {
      removeChanged()
      removeDeleted()
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
    await window.stickyApi.folders.reorderChildren(
      parentFolderId,
      orderedNodes
    )
    await load()
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
    <section className="detached-folder-shell">
      <header className="detached-folder-header">
        <strong>{root.title}</strong>
        <button
          className="icon-button"
          aria-label="关闭文件夹窗口"
          onClick={() => void window.stickyApi.window.attachFolder(folderId)}
        >
          ×
        </button>
      </header>
      <div className="detached-folder-tree">
        <FolderCard
          node={root}
          onOpenItem={(item) => setSelectedItemId(item.id)}
          onToggle={async (folder) => {
            await window.stickyApi.folders.update(folder.id, {
              collapsed: !folder.collapsed
            })
            await load()
          }}
          onContextMenu={() => undefined}
          onDetachItem={(item) =>
            void window.stickyApi.window.detach(item.id)
          }
          onDetachFolder={(folder) =>
            void window.stickyApi.window.detachFolder(folder.id)
          }
          onReorder={(parentId, orderedNodes) =>
            void reorder(parentId, orderedNodes)
          }
        />
      </div>
    </section>
  )
}
