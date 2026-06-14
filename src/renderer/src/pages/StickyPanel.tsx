import type { StickyItem } from '../../../shared/models'
import { NoteCard } from '../components/NoteCard'
import { TodoCard } from '../components/TodoCard'

export function StickyPanel({
  items,
  onOpen,
  onToggleTodo
}: {
  items: StickyItem[]
  onOpen(item: StickyItem): void
  onToggleTodo(item: StickyItem, taskId: string, completed: boolean): void
}): React.JSX.Element {
  if (!items.length) {
    return (
      <div className="empty-state">
        <div className="empty-mark">✦</div>
        <h2>还没有便签</h2>
        <p>从右上角新建一条笔记或待办。</p>
      </div>
    )
  }

  return (
    <main className="card-list">
      {items.map((item) =>
        item.type === 'note' ? (
          <NoteCard key={item.id} item={item} onOpen={() => onOpen(item)} />
        ) : (
          <TodoCard
            key={item.id}
            item={item}
            onOpen={() => onOpen(item)}
            onToggle={(taskId, completed) => onToggleTodo(item, taskId, completed)}
          />
        )
      )}
    </main>
  )
}
