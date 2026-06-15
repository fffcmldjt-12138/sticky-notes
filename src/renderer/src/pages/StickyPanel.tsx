import type { FolderItem, OrderedNodeRef, StickyItem } from '../../../shared/models'
import { DropMarker, FolderCard } from '../components/FolderCard'
import { NoteCard } from '../components/NoteCard'
import { TodoCard } from '../components/TodoCard'
import { buildFolderTree, type FolderTreeNode } from '../lib/folderTree'

export function StickyPanel({
  items,
  folders,
  onOpen,
  onToggleTodo,
  onToggleTodoExpanded,
  onContextMenu,
  onDetach,
  onToggleFolder,
  onFolderContextMenu,
  onDetachFolder,
  onReorder
}: {
  items: StickyItem[]
  folders: FolderItem[]
  onOpen(item: StickyItem): void
  onToggleTodo(item: StickyItem, taskId: string, completed: boolean): void
  onToggleTodoExpanded(item: StickyItem, expanded: boolean): void
  onContextMenu(item: StickyItem, event: React.MouseEvent<HTMLElement>): void
  onDetach(item: StickyItem): void
  onToggleFolder(folder: FolderTreeNode): void
  onFolderContextMenu(
    folder: FolderTreeNode,
    event: React.MouseEvent<HTMLElement>
  ): void
  onDetachFolder(folder: FolderTreeNode): void
  onReorder(parentFolderId: string | null, orderedNodes: OrderedNodeRef[]): void
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

  const reorderAt = (dragged: OrderedNodeRef, index: number): void => {
    const ordered = tree.entries
      .map(({ kind, id }) => ({ kind, id }))
      .filter((node) => node.kind !== dragged.kind || node.id !== dragged.id)
    ordered.splice(Math.min(index, ordered.length), 0, dragged)
    onReorder(null, ordered)
  }

  return (
    <main className="card-list">
      {tree.entries.map((entry, index) => (
        <div key={`${entry.kind}:${entry.id}`}>
          <DropMarker onDrop={(dragged) => reorderAt(dragged, index)} />
          {entry.kind === 'item' && entry.item.type === 'note' ? (
            <NoteCard
              item={entry.item}
              onOpen={() => onOpen(entry.item)}
              onContextMenu={(event) => onContextMenu(entry.item, event)}
              onDetach={() => onDetach(entry.item)}
            />
          ) : entry.kind === 'item' && entry.item.type === 'todo' ? (
            <TodoCard
              item={entry.item}
              onOpen={() => onOpen(entry.item)}
              onToggle={(taskId, completed) =>
                onToggleTodo(entry.item, taskId, completed)
              }
              onToggleExpanded={(expanded) =>
                onToggleTodoExpanded(entry.item, expanded)
              }
              onContextMenu={(event) => onContextMenu(entry.item, event)}
              onDetach={() => onDetach(entry.item)}
            />
          ) : entry.kind === 'folder' ? (
            <FolderCard
              node={entry.folder}
              onOpenItem={onOpen}
              onToggle={onToggleFolder}
              onContextMenu={onFolderContextMenu}
              onDetachItem={onDetach}
              onDetachFolder={onDetachFolder}
              onReorder={onReorder}
            />
          ) : null}
        </div>
      ))}
      <DropMarker onDrop={(dragged) => reorderAt(dragged, tree.entries.length)} />
    </main>
  )
}
