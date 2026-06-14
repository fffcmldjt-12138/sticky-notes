import type { TodoItem } from '../../../shared/models'

export function TodoCard({
  item,
  onOpen,
  onToggle
}: {
  item: TodoItem
  onOpen(): void
  onToggle(taskId: string, completed: boolean): void
}): React.JSX.Element {
  const completedCount = item.tasks.filter((task) => task.completed).length
  const nextReminder = item.tasks
    .filter((task) => !task.completed && task.remindAt)
    .sort((a, b) => String(a.remindAt).localeCompare(String(b.remindAt)))[0]

  return (
    <article className={`note-card todo-card body-${item.bodyTheme}`}>
      <button
        className="card-open"
        style={{ backgroundColor: item.headerColor }}
        onClick={onOpen}
      >
        <span className="type-badge">待办</span>
        <span className="card-title">{item.title || '无标题待办'}</span>
      </button>
      <div className="card-body">
        {item.tasks.slice(0, 3).map((task) => (
          <label className="todo-check" key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={(event) => onToggle(task.id, event.target.checked)}
            />
            <span>{task.contentMarkdown || '空任务'}</span>
          </label>
        ))}
        {!item.tasks.length && <p>点击编辑并添加任务...</p>}
        <time>
          {completedCount}/{item.tasks.length} 已完成
          {nextReminder?.remindAt
            ? ` · 最近提醒 ${new Date(nextReminder.remindAt).toLocaleString('zh-CN')}`
            : ''}
        </time>
      </div>
    </article>
  )
}
