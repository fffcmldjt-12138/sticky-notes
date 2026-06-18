import type { TodoItem } from '../../../shared/models'
import { StickyCard } from './StickyCard'
import { getItemTags } from '../../../shared/tags'
import { sortTasksForDisplay } from '../../../shared/todoPriority'

export function TodoCard({
  item,
  onOpen,
  onToggle,
  onToggleExpanded,
  onContextMenu,
  onDetach
}: {
  item: TodoItem
  onOpen(): void
  onToggle(taskId: string, completed: boolean): void
  onToggleExpanded(expanded: boolean): void
  onContextMenu(event: React.MouseEvent<HTMLElement>): void
  onDetach(): void
}): React.JSX.Element {
  const completedCount = item.tasks.filter((task) => task.completed).length
  const sortedTasks = sortTasksForDisplay(item.tasks)
  const nextScheduled = item.tasks
    .filter((task) => !task.completed && task.schedule)
    .sort((a, b) =>
      scheduleDueAt(a.schedule!).localeCompare(scheduleDueAt(b.schedule!))
    )[0]
  const visibleTasks = item.panelExpanded
    ? sortedTasks
    : sortedTasks.slice(0, 3)

  return (
    <StickyCard
      item={item}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      onDetach={onDetach}
    >
      {visibleTasks.map((task) => (
        <div
          className={`todo-check ${task.completed ? 'completed' : ''}`}
          key={task.id}
        >
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(event) => onToggle(task.id, event.target.checked)}
          />
          <div>
            <span>{task.contentMarkdown || '空任务'}</span>
            {task.children.length > 0 && (
              <div className="todo-subtasks-preview">
                {task.children.map((child) => (
                  <small
                    key={child.id}
                    className={child.completed ? 'completed' : ''}
                  >
                    {child.contentMarkdown || '空子待办'}
                  </small>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="card-tags">
        {getItemTags(item).map((tag) => <span key={tag}>#{tag}</span>)}
      </div>
      {!item.tasks.length && <p>点击编辑并添加任务...</p>}
      {item.tasks.length > 3 && (
        <button
          type="button"
          draggable={false}
          className="todo-expand-button"
          aria-label={item.panelExpanded ? '收起待办' : '展开全部待办'}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleExpanded(!item.panelExpanded)
          }}
        >
          {item.panelExpanded ? '收起' : `展开全部（${item.tasks.length}）`}
        </button>
      )}
      <time>
        {completedCount}/{item.tasks.length} 已完成
        {nextScheduled?.schedule
          ? ` · 时间 ${new Date(
              scheduleDueAt(nextScheduled.schedule)
            ).toLocaleString('zh-CN')}`
          : ''}
      </time>
    </StickyCard>
  )
}

function scheduleDueAt(schedule: NonNullable<TodoItem['tasks'][number]['schedule']>): string {
  return schedule.mode === 'range' && schedule.endAt
    ? schedule.endAt
    : schedule.startAt
}
