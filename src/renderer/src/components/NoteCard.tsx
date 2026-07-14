import { memo, Profiler } from 'react'
import type { NoteItem } from '../../../shared/models'
import { getItemTags } from '../../../shared/tags'
import { StickyCard } from './StickyCard'

interface NoteCardProps {
  item: NoteItem
  onOpen(): void
  onContextMenu(event: React.MouseEvent<HTMLElement>): void
  onDetach(): void
  onRender?(id: string, actualDuration: number): void
}

function NoteCardView({
  item,
  onOpen,
  onContextMenu,
  onDetach,
  onRender
}: NoteCardProps): React.JSX.Element {
  return (
    <StickyCard
      item={item}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      onDetach={onDetach}
    >
      <NoteCardBody item={item} onRender={onRender} />
    </StickyCard>
  )
}

const NoteCardBody = memo(function NoteCardBody({
  item,
  onRender
}: Pick<NoteCardProps, 'item' | 'onRender'>): React.JSX.Element {
  return (
    <Profiler
      id={item.id}
      onRender={(_id, _phase, duration) => onRender?.(item.id, duration)}
    >
      <>
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
      </>
    </Profiler>
  )
}, (previous, next) => previous.item.revision === next.item.revision)

export const NoteCard = memo(
  NoteCardView,
  (previous, next) => previous.item.revision === next.item.revision
)
