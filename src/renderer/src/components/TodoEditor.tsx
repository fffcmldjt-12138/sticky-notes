import { useEffect, useRef, useState } from 'react'
import type {
  StickyItemPatch,
  TodoItem,
  TodoTaskPatch
} from '../../../shared/models'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'

interface Props {
  item: TodoItem
  onSave(patch: StickyItemPatch): void
  onAddTask(): void
  onUpdateTask(taskId: string, patch: TodoTaskPatch): void
  onDeleteTask(taskId: string): void
  onBack(): void
  onDelete(): void
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TodoEditor({
  item,
  onSave,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onBack,
  onDelete
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(item)
  const onSaveRef = useRef(onSave)

  useEffect(() => setDraft(item), [item])
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSaveRef.current({
        title: draft.title,
        headerColor: draft.headerColor,
        bodyTheme: draft.bodyTheme
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  return (
    <section className={`editor body-${draft.bodyTheme}`}>
      <div className="editor-header" style={{ backgroundColor: draft.headerColor }}>
        <button className="icon-button" onClick={onBack} aria-label="返回">‹</button>
        <input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <button className="icon-button danger" onClick={onDelete} aria-label="删除">×</button>
      </div>
      <div className="editor-toolbar">
        <HeaderColorPicker
          value={draft.headerColor}
          onChange={(headerColor) => setDraft({ ...draft, headerColor })}
        />
        <BodyThemeToggle
          value={draft.bodyTheme}
          onChange={(bodyTheme) => setDraft({ ...draft, bodyTheme })}
        />
      </div>
      <div className="todo-task-list">
        {draft.tasks.map((task) => (
          <div className="todo-task-row" key={task.id}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={(event) =>
                onUpdateTask(task.id, { completed: event.target.checked })
              }
            />
            <textarea
              value={task.contentMarkdown}
              onChange={(event) =>
                onUpdateTask(task.id, { contentMarkdown: event.target.value })
              }
              placeholder="输入待办内容"
            />
            <input
              type="datetime-local"
              value={toLocalInput(task.remindAt)}
              onChange={(event) =>
                onUpdateTask(task.id, {
                  remindAt: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : null,
                  reminded: false
                })
              }
            />
            <button onClick={() => onDeleteTask(task.id)} aria-label="删除任务">×</button>
          </div>
        ))}
        <button className="primary-button add-task-button" onClick={onAddTask}>
          ＋ 添加任务
        </button>
      </div>
      <span className="save-status">自动保存</span>
    </section>
  )
}
