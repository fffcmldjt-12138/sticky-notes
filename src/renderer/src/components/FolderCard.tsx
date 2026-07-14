import { memo } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { StickyItem } from '../../../shared/models'
import type { FolderTreeNode } from '../lib/folderTree'
import { draggableId } from '../lib/treeDrag'
import { TreeDragHandle } from './TreeDragHandle'
import { TreeDropZone } from './TreeDropZone'

function FolderCardView({
  node,
  onOpenItem,
  onItemContextMenu,
  onToggle,
  onContextMenu,
  onCreate,
  onRender
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
  onRender?(id: string, actualDuration: number): void
}): React.JSX.Element {
  const dragNode = { kind: 'folder' as const, id: node.id }
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging
  } = useDraggable({
    id: draggableId(dragNode),
      data: {
        kind: 'folder',
        node: dragNode,
        parentFolderId: node.parentFolderId,
        folder: node
    }
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `inside-folder:${node.id}`,
    data: {
      position: {
        parentFolderId: node.id,
        index: Number.MAX_SAFE_INTEGER
      }
    }
  })

  return (
    <section
      ref={(element) => {
        setDragRef(element)
        setDropRef(element)
      }}
      className={[
        'folder-card',
        isDragging ? 'dragging' : '',
        isOver ? 'drop-inside' : ''
      ].filter(Boolean).join(' ')}
      style={{ transform: CSS.Translate.toString(transform) }}
    >
      <div
        className="folder-title-bar"
        {...attributes}
        {...listeners}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextMenu(node, event)
        }}
      >
        <TreeDragHandle
          label={`拖动文件夹 ${node.title}`}
          decorative
        />
        <button
          className={`folder-toggle ${node.collapsed ? '' : 'expanded'}`}
          onClick={() => onToggle(node)}
          onPointerDown={(event) => event.stopPropagation()}
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
          onPointerDown={(event) => event.stopPropagation()}
        >
          ＋
        </button>
      </div>
      {!node.collapsed && (
        <div className="folder-contents">
          <TreeDropZone
            id={`parent-exit:${node.id}`}
            position={{
              parentFolderId: node.parentFolderId,
              index: Number.MAX_SAFE_INTEGER
            }}
            parentExit
          />
          {node.entries.map((entry, index) => (
            <div key={`${entry.kind}:${entry.id}`}>
              <TreeDropZone
                id={`drop:${node.id}:${index}`}
                position={{ parentFolderId: node.id, index }}
              />
              {entry.kind === 'item' ? (
                <FolderItemTitle
                  item={entry.item}
                  onOpen={onOpenItem}
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
                  onRender={onRender}
                />
              )}
            </div>
          ))}
          <TreeDropZone
            id={`drop:${node.id}:end`}
            position={{
              parentFolderId: node.id,
              index: Number.MAX_SAFE_INTEGER
            }}
          />
        </div>
      )}
    </section>
  )
}

export const FolderCard = memo(
  FolderCardView,
  (previous, next) => folderRenderKey(previous.node) === folderRenderKey(next.node)
)

function folderRenderKey(node: FolderTreeNode): string {
  return [
    node.id,
    node.revision,
    node.collapsed,
    ...node.entries.map((entry) =>
      entry.kind === 'item'
        ? `item:${entry.item.id}:${entry.item.revision}`
        : `folder:${folderRenderKey(entry.folder)}`
    )
  ].join('|')
}

function FolderItemTitle({
  item,
  onOpen,
  onContextMenu
}: {
  item: StickyItem
  onOpen(item: StickyItem): void
  onContextMenu(item: StickyItem, event: React.MouseEvent<HTMLElement>): void
}): React.JSX.Element {
  const node = { kind: 'item' as const, id: item.id }
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: draggableId(node),
      data: {
        kind: 'item',
        node,
        parentFolderId: item.parentFolderId,
        item
      }
    })

  return (
    <div
      ref={setNodeRef}
      className={`folder-item-title ${isDragging ? 'dragging' : ''}`}
      style={{
        borderLeftColor: item.headerColor,
        transform: CSS.Translate.toString(transform)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextMenu(item, event)
      }}
    >
      <TreeDragHandle
        label={`拖动${item.type === 'note' ? '笔记' : '待办'} ${item.title || '无标题'}`}
        attributes={attributes}
        listeners={listeners}
      />
      <button className="folder-item-open" onClick={() => onOpen(item)}>
        <span>{item.type === 'note' ? '笔记' : '待办'}</span>
        <strong>{item.title || '无标题'}</strong>
      </button>
    </div>
  )
}
