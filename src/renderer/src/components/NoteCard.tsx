import type { NoteItem } from '../../../shared/models'
import { StickyCard } from './StickyCard'
import { getItemTags } from '../../../shared/tags'

export function NoteCard({
  item,
  onOpen,
  onContextMenu,
  onDetach
}: {
  item: NoteItem
  onOpen(): void
  onContextMenu(event: React.MouseEvent<HTMLElement>): void
  onDetach(): void
}): React.JSX.Element {
  return (
    <StickyCard
      item={item}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      onDetach={onDetach}
    >
      <p>{item.contentMarkdown || '点击开始记录 Markdown 内容...'}</p>
      <div className="card-tags">
        {getItemTags(item).map((tag) => <span key={tag}>#{tag}</span>)}
      </div>
      <time>
        {new Date(item.updatedAt).toLocaleString('zh-CN', {
          dateStyle: 'short',
          timeStyle: 'short'
        })}
      </time>
    </StickyCard>
  )
}
