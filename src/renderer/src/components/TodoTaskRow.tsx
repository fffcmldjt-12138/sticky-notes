import { useRef, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import type {
  BodyTheme,
  TodoTask,
  TodoTaskPatch
} from '../../../shared/models'
import { extractTags } from '../../../shared/tags'
import { DeadlinePopover } from './DeadlinePopover'
import { ReminderPopover } from './ReminderPopover'
import { TodoTaskInput } from './TodoTaskInput'

type ActivePopover = 'reminder' | 'deadline' | null

export function TodoTaskRow({
  task,
  bodyTheme,
  onUpdate,
  onDelete
}: {
  task: TodoTask
  bodyTheme: BodyTheme
  onUpdate(patch: TodoTaskPatch): void
  onDelete(): void
}): React.JSX.Element {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null)
  const reminderButtonRef = useRef<HTMLButtonElement>(null)
  const deadlineButtonRef = useRef<HTMLButtonElement>(null)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })
  const status = getDeadlineStatus(task)

  return (
    <div
      ref={setNodeRef}
      className={`todo-task-row deadline-${status} ${isDragging ? 'dragging' : ''}`}
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
        className="task-complete-checkbox"
        aria-label="完成状态"
        type="checkbox"
        checked={task.completed}
        onChange={(event) => onUpdate({ completed: event.target.checked })}
      />
      <TodoTaskInput
        value={task.contentMarkdown}
        onCommit={(contentMarkdown) => onUpdate({ contentMarkdown })}
      />
      <button
        className="task-delete-button"
        onClick={onDelete}
        aria-label="删除任务"
      >
        ×
      </button>
      <div className="task-setting-buttons">
        <div className="task-setting-anchor">
          <button
            ref={reminderButtonRef}
            type="button"
            className={`task-setting-button ${task.remindAt ? 'active' : ''}`}
            aria-label="设置提醒"
            onClick={() =>
              setActivePopover((current) =>
                current === 'reminder' ? null : 'reminder'
              )
            }
          >
            提醒{task.remindAt ? ` · ${formatShortDate(task.remindAt)}` : ''}
          </button>
          {activePopover === 'reminder' && (
            <ReminderPopover
              value={task.remindAt ?? null}
              anchor={reminderButtonRef.current}
              bodyTheme={bodyTheme}
              onSave={onUpdate}
              onClose={() => setActivePopover(null)}
            />
          )}
        </div>
        <div className="task-setting-anchor">
          <button
            ref={deadlineButtonRef}
            type="button"
            className={`task-setting-button ${task.deadlineAt ? 'active' : ''}`}
            aria-label="设置 DDL"
            onClick={() =>
              setActivePopover((current) =>
                current === 'deadline' ? null : 'deadline'
              )
            }
          >
            DDL{task.deadlineAt ? ` · ${formatShortDate(task.deadlineAt)}` : ''}
          </button>
          {activePopover === 'deadline' && (
            <DeadlinePopover
              deadlineAt={task.deadlineAt ?? null}
              reminders={task.deadlineReminders ?? []}
              anchor={deadlineButtonRef.current}
              bodyTheme={bodyTheme}
              onSave={onUpdate}
              onClose={() => setActivePopover(null)}
            />
          )}
        </div>
      </div>
      {extractTags(task.contentMarkdown).length > 0 && (
        <div className="task-inline-tags">
          {extractTags(task.contentMarkdown).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso))
}

export function getDeadlineStatus(
  task: Pick<TodoTask, 'completed' | 'deadlineAt'>,
  now = Date.now()
): 'neutral' | 'approaching' | 'overdue' {
  if (task.completed || !task.deadlineAt) return 'neutral'
  const deadline = new Date(task.deadlineAt).getTime()
  if (deadline <= now) return 'overdue'
  return deadline - now <= 3 * 24 * 60 * 60 * 1000
    ? 'approaching'
    : 'neutral'
}
