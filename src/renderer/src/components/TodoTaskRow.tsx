import { useRef, useState } from 'react'
import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import type {
  BodyTheme,
  TodoSubtaskPatch,
  TodoTask,
  TodoTaskPatch
} from '../../../shared/models'
import { extractTags } from '../../../shared/tags'
import { getScheduleDueAt } from '../../../shared/taskSchedule'
import { TaskQuadrantPicker } from './TaskQuadrantPicker'
import { TaskSchedulePopover } from './TaskSchedulePopover'
import { TodoSubtaskRow } from './TodoSubtaskRow'
import { TodoTaskInput } from './TodoTaskInput'

export function TodoTaskRow({
  task,
  bodyTheme,
  onUpdate,
  onDelete,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask
}: {
  task: TodoTask
  bodyTheme: BodyTheme
  onUpdate(patch: TodoTaskPatch): void
  onDelete(): void
  onAddSubtask(): void
  onUpdateSubtask(subtaskId: string, patch: TodoSubtaskPatch): void
  onDeleteSubtask(subtaskId: string): void
}): React.JSX.Element {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const scheduleButtonRef = useRef<HTMLButtonElement>(null)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })
  const status = getScheduleStatus(task)

  return (
    <div
      ref={setNodeRef}
      className={[
        'todo-task-row',
        `deadline-${status}`,
        task.completed ? 'completed' : '',
        isDragging ? 'dragging' : ''
      ].filter(Boolean).join(' ')}
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
        <TaskQuadrantPicker
          ariaLabel="任务四象限"
          importance={task.importance}
          urgency={task.urgency}
          onChange={(importance, urgency) => onUpdate({ importance, urgency })}
        />
        <div className="task-setting-anchor">
          <button
            ref={scheduleButtonRef}
            type="button"
            className={`task-setting-button ${task.schedule ? 'active' : ''}`}
            aria-label="时间设置"
            onClick={() => setScheduleOpen((open) => !open)}
          >
            时间{task.schedule ? ` · ${formatShortDate(
              getScheduleDueAt(task.schedule)
            )}` : ''}
          </button>
          {scheduleOpen && (
            <TaskSchedulePopover
              value={task.schedule}
              anchor={scheduleButtonRef.current}
              bodyTheme={bodyTheme}
              onSave={(schedule) => onUpdate({ schedule })}
              onClose={() => setScheduleOpen(false)}
            />
          )}
        </div>
        <button
          type="button"
          className="task-setting-button"
          aria-label="添加子待办"
          onClick={onAddSubtask}
        >
          ＋ 子待办
        </button>
      </div>
      {extractTags(task.contentMarkdown).length > 0 && (
        <div className="task-inline-tags">
          {extractTags(task.contentMarkdown).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
      {task.children.length > 0 && (
        <div className="todo-subtask-list">
          {task.children.map((subtask) => (
            <TodoSubtaskRow
              key={subtask.id}
              subtask={subtask}
              bodyTheme={bodyTheme}
              onUpdate={(patch) => onUpdateSubtask(subtask.id, patch)}
              onDelete={() => onDeleteSubtask(subtask.id)}
            />
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

export function getScheduleStatus(
  task: Pick<TodoTask, 'completed' | 'schedule'>,
  now = Date.now()
): 'neutral' | 'approaching' | 'overdue' {
  if (task.completed || !task.schedule) return 'neutral'
  const dueAt = new Date(getScheduleDueAt(task.schedule)).getTime()
  if (dueAt <= now) return 'overdue'
  return dueAt - now <= 3 * 24 * 60 * 60 * 1000
    ? 'approaching'
    : 'neutral'
}
