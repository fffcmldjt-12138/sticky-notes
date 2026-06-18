import type { PropsWithChildren } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { StickyItem } from '../../../shared/models'
import { draggableId } from '../lib/treeDrag'
import { TreeDragHandle } from './TreeDragHandle'

interface Props extends PropsWithChildren {
  item: StickyItem
  onOpen(): void
  onContextMenu?(event: React.MouseEvent<HTMLElement>): void
  onDetach?(): void
}

export function StickyCard({
  item,
  onOpen,
  onContextMenu,
  onDetach,
  children
}: Props): React.JSX.Element {
  const node = { kind: 'item' as const, id: item.id }
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: draggableId(node),
      data: {
        node,
        parentFolderId: item.parentFolderId,
        label: item.title || '无标题'
      }
    })

  return (
    <article
      ref={setNodeRef}
      className={`sticky-card body-${item.bodyTheme} ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu?.(event)
      }}
    >
      <div
        className="sticky-card-header"
        style={{ backgroundColor: item.headerColor }}
      >
        <TreeDragHandle
          label={`拖动${item.type === 'note' ? '笔记' : '待办'} ${item.title || '无标题'}`}
          attributes={attributes}
          listeners={listeners}
        />
        <button className="sticky-card-open" onClick={onOpen}>
          <span className="type-badge">{item.type === 'note' ? '笔记' : '待办'}</span>
          <span className="card-title">{item.title || '无标题'}</span>
          {item.pinned && <span className="pin-indicator" title="已置顶">置顶</span>}
        </button>
      </div>
      <div className="sticky-card-body">{children}</div>
    </article>
  )
}
