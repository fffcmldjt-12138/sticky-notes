import { useRef, useState } from 'react'
import type {
  BodyTheme,
  TodoSubtask,
  TodoSubtaskPatch
} from '../../../shared/models'
import { TaskQuadrantPicker } from './TaskQuadrantPicker'
import { TaskSchedulePopover } from './TaskSchedulePopover'
import { TodoTaskInput } from './TodoTaskInput'

export function TodoSubtaskRow({
  subtask,
  bodyTheme,
  onUpdate,
  onDelete
}: {
  subtask: TodoSubtask
  bodyTheme: BodyTheme
  onUpdate(patch: TodoSubtaskPatch): void
  onDelete(): void
}): React.JSX.Element {
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const scheduleButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <div className={`todo-subtask-row ${subtask.completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        aria-label="完成子待办"
        checked={subtask.completed}
        onChange={(event) => onUpdate({ completed: event.target.checked })}
      />
      <TodoTaskInput
        ariaLabel="子待办内容"
        value={subtask.contentMarkdown}
        onCommit={(contentMarkdown) => onUpdate({ contentMarkdown })}
      />
      <TaskQuadrantPicker
        ariaLabel="子待办四象限"
        importance={subtask.importance}
        urgency={subtask.urgency}
        onChange={(importance, urgency) => onUpdate({ importance, urgency })}
      />
      <button
        ref={scheduleButtonRef}
        type="button"
        className={`task-setting-button ${subtask.schedule ? 'active' : ''}`}
        aria-label="子待办时间设置"
        onClick={() => setScheduleOpen((open) => !open)}
      >
        时间
      </button>
      {scheduleOpen && (
        <TaskSchedulePopover
          value={subtask.schedule}
          anchor={scheduleButtonRef.current}
          bodyTheme={bodyTheme}
          onSave={(schedule) => onUpdate({ schedule })}
          onClose={() => setScheduleOpen(false)}
        />
      )}
      <button
        type="button"
        className="task-delete-button"
        aria-label="删除子待办"
        onClick={onDelete}
      >
        ×
      </button>
    </div>
  )
}
