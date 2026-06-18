import type { OrderedNodeRef, StickyItem } from '../../../shared/models'
import type { FolderTreeEntry, FolderTreeNode } from '../lib/folderTree'
import { endedOutsidePanel } from '../lib/dragBoundary'

export function FolderCard({
  node,
  onOpenItem,
  onItemContextMenu,
  onToggle,
  onContextMenu,
  onCreate,
  onDetachItem,
  onDetachFolder,
  onReorder
}: {
  node: FolderTreeNode
  onOpenItem(item: StickyItem): void
  onItemContextMenu(
    item: StickyItem,
    event: React.MouseEvent<HTMLElement>
  ): void
  onToggle(node: FolderTreeNode): void
  onContextMenu(node: FolderTreeNode, event: React.MouseEvent<HTMLElement>): void
  onCreate(node: FolderTreeNode): void
  onDetachItem(item: StickyItem): void
  onDetachFolder(node: FolderTreeNode): void
  onReorder(parentFolderId: string | null, orderedNodes: OrderedNodeRef[]): void
}): React.JSX.Element {
  return (
    <section
      className="folder-card"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const dragged = readDraggedNode(event.dataTransfer)
        if (dragged && dragged.id !== node.id) {
          onReorder(node.id, appendDragged(node.entries, dragged))
        }
      }}
    >
      <div
        className="folder-title-bar"
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenu(node, event)
        }}
        draggable
        onDragStart={(event) => {
          event.stopPropagation()
          event.dataTransfer.setData('text/sticky-folder', node.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={(event) => {
          if (
            endedOutsidePanel(
              event.clientX,
              event.clientY,
              window.innerWidth,
              window.innerHeight
            )
          ) {
            onDetachFolder(node)
          }
        }}
      >
        <button
          className={`folder-toggle ${node.collapsed ? '' : 'expanded'}`}
          onClick={() => onToggle(node)}
          aria-label={node.collapsed ? '展开文件夹' : '收起文件夹'}
        >
          ›
        </button>
        <span className="folder-title">文件夹 {node.title}</span>
        <small>{node.descendantItemCount}</small>
        <button
          className="folder-create-button"
          aria-label={`在${node.title}中新建`}
          onClick={(event) => {
            event.stopPropagation()
            onCreate(node)
          }}
        >
          ＋
        </button>
      </div>
      {!node.collapsed && (
        <div className="folder-contents">
          {node.entries.map((entry, index) => (
            <div key={`${entry.kind}:${entry.id}`}>
              <DropMarker
                onDrop={(dragged) =>
                  onReorder(node.id, insertDragged(node.entries, dragged, index))
                }
              />
              {entry.kind === 'item' ? (
                <FolderItemTitle
                  item={entry.item}
                  onOpen={onOpenItem}
                  onDetach={onDetachItem}
                  onContextMenu={onItemContextMenu}
                />
              ) : (
                <FolderCard
                  node={entry.folder}
                  onOpenItem={onOpenItem}
                  onItemContextMenu={onItemContextMenu}
                  onToggle={onToggle}
                  onContextMenu={onContextMenu}
                  onCreate={onCreate}
                  onDetachItem={onDetachItem}
                  onDetachFolder={onDetachFolder}
                  onReorder={onReorder}
                />
              )}
            </div>
          ))}
          <DropMarker
            onDrop={(dragged) =>
              onReorder(node.id, appendDragged(node.entries, dragged))
            }
          />
        </div>
      )}
    </section>
  )
}

function FolderItemTitle({
  item,
  onOpen,
  onDetach,
  onContextMenu
}: {
  item: StickyItem
  onOpen(item: StickyItem): void
  onDetach(item: StickyItem): void
  onContextMenu(item: StickyItem, event: React.MouseEvent<HTMLElement>): void
}): React.JSX.Element {
  return (
    <button
      className="folder-item-title"
      style={{ borderLeftColor: item.headerColor }}
      onClick={() => onOpen(item)}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextMenu(item, event)
      }}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/sticky-item', item.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={(event) => {
        if (
          endedOutsidePanel(
            event.clientX,
            event.clientY,
            window.innerWidth,
            window.innerHeight
          )
        ) {
          onDetach(item)
        }
      }}
    >
      <span>{item.type === 'note' ? '笔记' : '待办'}</span>
      <strong>{item.title || '无标题'}</strong>
    </button>
  )
}

export function DropMarker({
  onDrop
}: {
  onDrop(node: OrderedNodeRef): void
}): React.JSX.Element {
  return (
    <div
      className="mixed-drop-marker"
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const dragged = readDraggedNode(event.dataTransfer)
        if (dragged) onDrop(dragged)
      }}
    />
  )
}

function readDraggedNode(dataTransfer: DataTransfer): OrderedNodeRef | null {
  const itemId = dataTransfer.getData('text/sticky-item')
  if (itemId) return { kind: 'item', id: itemId }
  const folderId = dataTransfer.getData('text/sticky-folder')
  return folderId ? { kind: 'folder', id: folderId } : null
}

function insertDragged(
  entries: FolderTreeEntry[],
  dragged: OrderedNodeRef,
  index: number
): OrderedNodeRef[] {
  const ordered = entries
    .map(({ kind, id }) => ({ kind, id }))
    .filter((entry) => entry.kind !== dragged.kind || entry.id !== dragged.id)
  ordered.splice(Math.min(index, ordered.length), 0, dragged)
  return ordered
}

function appendDragged(
  entries: FolderTreeEntry[],
  dragged: OrderedNodeRef
): OrderedNodeRef[] {
  return insertDragged(entries, dragged, entries.length)
}
