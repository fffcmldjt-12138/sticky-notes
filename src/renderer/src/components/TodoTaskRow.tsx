import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import type { TodoTask, TodoTaskPatch } from '../../../shared/models'

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TodoTaskRow({
  task,
  onUpdate,
  onDelete
}: {
  task: TodoTask
  onUpdate(patch: TodoTaskPatch): void
  onDelete(): void
}): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  return (
    <div
      ref={setNodeRef}
      className={`todo-task-row ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="task-drag-handle"
        aria-label="拖动排序"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <input
        aria-label="完成状态"
        type="checkbox"
        checked={task.completed}
        onChange={(event) => onUpdate({ completed: event.target.checked })}
      />
      <button className="task-delete-button" onClick={onDelete} aria-label="删除任务">
        ×
      </button>
      <input
        className="task-content-input"
        aria-label="任务内容"
        type="text"
        value={task.contentMarkdown}
        onChange={(event) => onUpdate({ contentMarkdown: event.target.value })}
      />
      <label className="task-reminder">
        提醒时间
        <input
          aria-label="提醒时间"
          type="datetime-local"
          value={toLocalInput(task.remindAt)}
          onChange={(event) =>
            onUpdate({
              remindAt: event.target.value
                ? new Date(event.target.value).toISOString()
                : null,
              reminded: false
            })
          }
        />
      </label>
    </div>
  )
}
