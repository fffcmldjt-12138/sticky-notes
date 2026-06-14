import type { PropsWithChildren } from 'react'
import type { StickyItem } from '../../../shared/models'

interface Props extends PropsWithChildren {
  item: StickyItem
  onOpen(): void
  onContextMenu?(event: React.MouseEvent<HTMLElement>): void
}

export function StickyCard({
  item,
  onOpen,
  onContextMenu,
  children
}: Props): React.JSX.Element {
  return (
    <article
      className={`sticky-card body-${item.bodyTheme}`}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu?.(event)
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

