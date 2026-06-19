import type { FolderItem, OrderedNodeRef, StickyItem } from '../../../shared/models'
import { FolderCard } from '../components/FolderCard'
import { NoteCard } from '../components/NoteCard'
import { TreeDndContext } from '../components/TreeDndContext'
import { TreeDropZone } from '../components/TreeDropZone'
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
  onCreateInFolder,
  onDetachFolder,
  onReorder
  , onBeginDrag
  , onDragStateChange
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
  onCreateInFolder(folder: FolderTreeNode): void
  onDetachFolder(folder: FolderItem): void
  onReorder(parentFolderId: string | null, orderedNodes: OrderedNodeRef[]): void
  onBeginDrag?(): void
  onDragStateChange?(active: boolean): void
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
    <TreeDndContext
      items={items}
      folders={folders}
      onReorder={onReorder}
      onDetachItem={onDetach}
      onDetachFolder={onDetachFolder}
      onDragStart={onBeginDrag}
      onDragStateChange={onDragStateChange}
    >
      <main className="card-list">
        {tree.entries.map((entry, index) => (
          <div key={`${entry.kind}:${entry.id}`}>
            <TreeDropZone
              id={`drop:root:${index}`}
              position={{ parentFolderId: null, index }}
            />
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
              onItemContextMenu={onContextMenu}
              onToggle={onToggleFolder}
              onContextMenu={onFolderContextMenu}
              onCreate={onCreateInFolder}
            />
          ) : null}
          </div>
        ))}
        <TreeDropZone
          id="drop:root:end"
          position={{ parentFolderId: null, index: Number.MAX_SAFE_INTEGER }}
        />
      </main>
    </TreeDndContext>
  )
}
