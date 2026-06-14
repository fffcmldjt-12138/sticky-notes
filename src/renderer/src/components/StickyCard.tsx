import type { PropsWithChildren } from 'react'
import type { StickyItem } from '../../../shared/models'

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
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu?.(event)
      }}
      onDragEnd={(event) => {
        const outside =
          event.clientX <= 0 ||
          event.clientY <= 0 ||
          event.clientX >= window.innerWidth ||
          event.clientY >= window.innerHeight
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
