import type { FolderItem, StickyItem } from '../../../shared/models'
import { FolderCard } from '../components/FolderCard'
import { NoteCard } from '../components/NoteCard'
import { TodoCard } from '../components/TodoCard'
import { buildFolderTree, type FolderTreeNode } from '../lib/folderTree'

export function StickyPanel({
  items,
  folders,
  onOpen,
  onToggleTodo,
  onContextMenu,
  onDetach,
  onToggleFolder,
  onMoveItem,
  onMoveFolder
}: {
  items: StickyItem[]
  folders: FolderItem[]
  onOpen(item: StickyItem): void
  onToggleTodo(item: StickyItem, taskId: string, completed: boolean): void
  onContextMenu(item: StickyItem, event: React.MouseEvent<HTMLElement>): void
  onDetach(item: StickyItem): void
  onToggleFolder(folder: FolderTreeNode): void
  onMoveItem(itemId: string, folderId: string | null): void
  onMoveFolder(folderId: string, parentFolderId: string | null): void
}): React.JSX.Element {
  const tree = buildFolderTree(folders, items)

  if (!items.length && !folders.length) {
    return (
      <div className="empty-state">
        <div className="empty-mark">+</div>
        <h2>还没有便签</h2>
        <p>从右上角新建一条笔记、待办或文件夹。</p>
      </div>
    )
  }

  return (
    <main
      className="card-list"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const itemId = event.dataTransfer.getData('text/sticky-item')
        const folderId = event.dataTransfer.getData('text/sticky-folder')
        if (itemId) onMoveItem(itemId, null)
        if (folderId) onMoveFolder(folderId, null)
      }}
    >
      {tree.rootItems.map((item) =>
        item.type === 'note' ? (
          <NoteCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onContextMenu={(event) => onContextMenu(item, event)}
            onDetach={() => onDetach(item)}
          />
        ) : (
          <TodoCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onToggle={(taskId, completed) => onToggleTodo(item, taskId, completed)}
            onContextMenu={(event) => onContextMenu(item, event)}
            onDetach={() => onDetach(item)}
          />
        )
      )}
      {tree.folders.map((folder) => (
        <FolderCard
          key={folder.id}
          node={folder}
          onOpenItem={onOpen}
          onToggle={onToggleFolder}
          onMoveItem={(itemId, folderId) => onMoveItem(itemId, folderId)}
          onMoveFolder={(folderId, parentFolderId) =>
            onMoveFolder(folderId, parentFolderId)
          }
        />
      ))}
    </main>
  )
}
