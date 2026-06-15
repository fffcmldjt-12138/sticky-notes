import type { PropsWithChildren } from 'react'
import type { StickyItem } from '../../../shared/models'
import { endedOutsidePanel } from '../lib/dragBoundary'

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
  return (
    <article
      className={`sticky-card body-${item.bodyTheme}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/sticky-item', item.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu?.(event)
      }}
      onDragEnd={(event) => {
        const outside = endedOutsidePanel(
          event.clientX,
          event.clientY,
          window.innerWidth,
          window.innerHeight
        )
        if (outside) onDetach?.()
      }}
    >
      <button
        className="sticky-card-header"
        style={{ backgroundColor: item.headerColor }}
        onClick={onOpen}
      >
        <span className="type-badge">{item.type === 'note' ? '笔记' : '待办'}</span>
        <span className="card-title">{item.title || '无标题'}</span>
      </button>
      <div className="sticky-card-body">{children}</div>
    </article>
  )
}
