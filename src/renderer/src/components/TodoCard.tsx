import type { TodoItem } from '../../../shared/models'

export function TodoCard({
  item,
  onOpen,
  onToggle
}: {
  item: TodoItem
  onOpen(): void
  onToggle(completed: boolean): void
}): React.JSX.Element {
  return (
    <article className={`note-card todo-card body-${item.bodyTheme} ${item.completed ? 'completed' : ''}`}>
      <button className={`card-open header-${item.headerColor}`} onClick={onOpen}>
        <span className="type-badge">待办</span>
        <span className="card-title">{item.title || '无标题待办'}</span>
      </button>
      <div className="card-body">
        <label className="todo-check">
          <input
            type="checkbox"
            checked={item.completed}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span>{item.contentMarkdown || '点击编辑待办内容...'}</span>
        </label>
        {item.remindAt && <time>提醒：{new Date(item.remindAt).toLocaleString('zh-CN')}</time>}
      </div>
    </article>
  )
}

