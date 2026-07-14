import { memo, Profiler } from 'react'
import type { TodoItem } from '../../../shared/models'
import { getItemTags } from '../../../shared/tags'
import { sortTasksForDisplay } from '../../../shared/todoPriority'
import { StickyCard } from './StickyCard'

interface TodoCardProps {
  item: TodoItem
  onOpen(): void
  onToggle(taskId: string, completed: boolean): void
  onToggleSubtask(taskId: string, subtaskId: string, completed: boolean): void
  onToggleExpanded(expanded: boolean): void
  onContextMenu(event: React.MouseEvent<HTMLElement>): void
  onDetach(): void
  onRender?(id: string, actualDuration: number): void
}

function TodoCardView({
  item,
  onOpen,
  onToggle,
  onToggleSubtask,
  onToggleExpanded,
  onContextMenu,
  onDetach,
  onRender
}: TodoCardProps): React.JSX.Element {
  return (
    <StickyCard
      item={item}
      onOpen={onOpen}
      onContextMenu={onContextMenu}
      onDetach={onDetach}
    >
      <TodoCardBody
        item={item}
        onToggle={onToggle}
        onToggleSubtask={onToggleSubtask}
        onToggleExpanded={onToggleExpanded}
        onRender={onRender}
      />
    </StickyCard>
  )
}

const TodoCardBody = memo(function TodoCardBody({
  item,
  onToggle,
  onToggleSubtask,
  onToggleExpanded,
  onRender
}: Pick<
  TodoCardProps,
  'item' | 'onToggle' | 'onToggleSubtask' | 'onToggleExpanded' | 'onRender'
>): React.JSX.Element {
  const completedCount = item.tasks.filter((task) => task.completed).length
  const sortedTasks = sortTasksForDisplay(item.tasks)
  const nextScheduled = item.tasks
    .filter((task) => !task.completed && task.schedule)
    .sort((a, b) =>
      scheduleDueAt(a.schedule!).localeCompare(scheduleDueAt(b.schedule!))
    )[0]
  const visibleTasks = item.panelExpanded ? sortedTasks : sortedTasks.slice(0, 3)

  return (
    <Profiler
      id={item.id}
      onRender={(_id, _phase, duration) => onRender?.(item.id, duration)}
    >
      <>
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
                    <label key={child.id} className={child.completed ? 'completed' : ''}>
                      <input
                        type="checkbox"
                        aria-label={`子待办 ${child.contentMarkdown || '空子待办'}`}
                        checked={child.completed}
                        onChange={(event) =>
                          onToggleSubtask(task.id, child.id, event.target.checked)
                        }
                      />
                      <small>{child.contentMarkdown || '空子待办'}</small>
                    </label>
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
      </>
    </Profiler>
  )
}, (previous, next) => previous.item.revision === next.item.revision)

export const TodoCard = memo(
  TodoCardView,
  (previous, next) => previous.item.revision === next.item.revision
)

function scheduleDueAt(
  schedule: NonNullable<TodoItem['tasks'][number]['schedule']>
): string {
  return schedule.mode === 'range' && schedule.endAt
    ? schedule.endAt
    : schedule.startAt
}
