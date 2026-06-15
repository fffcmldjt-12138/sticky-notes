import type { TodoItem } from '../../../shared/models'
import { StickyCard } from './StickyCard'
import { getItemTags } from '../../../shared/tags'

export function TodoCard({
  item,
  onOpen,
  onToggle,
  onContextMenu,
  onDetach
}: {
  item: TodoItem
  onOpen(): void
  onToggle(taskId: string, completed: boolean): void
  onContextMenu(event: React.MouseEvent<HTMLElement>): void
  onDetach(): void
}): React.JSX.Element {
  const completedCount = item.tasks.filter((task) => task.completed).length
  const nextReminder = item.tasks
    .filter((task) => !task.completed && task.remindAt)
    .sort((a, b) => String(a.remindAt).localeCompare(String(b.remindAt)))[0]
  const nextDeadline = item.tasks
    .filter((task) => !task.completed && task.deadlineAt)
    .sort((a, b) => String(a.deadlineAt).localeCompare(String(b.deadlineAt)))[0]

  return (
    <StickyCard
      item={item}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      onDetach={onDetach}
    >
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
      <div className="card-tags">
        {getItemTags(item).map((tag) => <span key={tag}>#{tag}</span>)}
      </div>
      {!item.tasks.length && <p>点击编辑并添加任务...</p>}
      <time>
        {completedCount}/{item.tasks.length} 已完成
        {nextReminder?.remindAt
          ? ` · 最近提醒 ${new Date(nextReminder.remindAt).toLocaleString('zh-CN')}`
          : ''}
        {nextDeadline?.deadlineAt
          ? ` · DDL ${new Date(nextDeadline.deadlineAt).toLocaleString('zh-CN')}`
          : ''}
      </time>
    </StickyCard>
  )
}
