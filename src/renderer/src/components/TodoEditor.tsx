import { useEffect, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import type {
  StickyItemPatch,
  TodoItem,
  TodoTaskPatch
} from '../../../shared/models'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'
import { TodoTaskRow } from './TodoTaskRow'
import { TagEditor } from './TagEditor'
import { extractTags } from '../../../shared/tags'

interface Props {
  item: TodoItem
  onSave(patch: StickyItemPatch): void
  onAddTask(): void
  onUpdateTask(taskId: string, patch: TodoTaskPatch): void
  onDeleteTask(taskId: string): void
  onReorderTasks(taskIds: string[]): void
  onBack(): void
  onDelete(): void
  detached?: boolean
}

export function TodoEditor({
  item,
  onSave,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onBack,
  onDelete,
  detached = false
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(item)
  const onSaveRef = useRef(onSave)
  const lastSubmittedRef = useRef<StickyItemPatch | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const submitted = lastSubmittedRef.current
    if (
      submitted &&
      submitted.title === item.title &&
      submitted.headerColor === item.headerColor &&
      submitted.bodyTheme === item.bodyTheme
      && JSON.stringify(submitted.tags) === JSON.stringify(item.tags)
    ) {
      setDraft((current) => ({ ...current, tasks: item.tasks }))
      return
    }
    setDraft(item)
  }, [item])
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const patch = {
        title: draft.title,
        headerColor: draft.headerColor,
        bodyTheme: draft.bodyTheme
        , tags: draft.tags
      } satisfies StickyItemPatch
      lastSubmittedRef.current = patch
      onSaveRef.current(patch)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = draft.tasks.findIndex((task) => task.id === active.id)
    const newIndex = draft.tasks.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorderTasks(arrayMove(draft.tasks, oldIndex, newIndex).map((task) => task.id))
  }

  function saveAndBack(): void {
    const patch = {
      title: draft.title,
      headerColor: draft.headerColor,
      bodyTheme: draft.bodyTheme
      , tags: draft.tags
    } satisfies StickyItemPatch
    lastSubmittedRef.current = patch
    onSaveRef.current(patch)
    onBack()
  }

  return (
    <section className={`editor body-${draft.bodyTheme}`}>
      <div
        className={`editor-header ${detached ? 'detached-header' : ''}`}
        style={{ backgroundColor: draft.headerColor }}
      >
        {detached
          ? <span className="editor-header-spacer" />
          : <button className="icon-button" onClick={saveAndBack} aria-label="返回">‹</button>}
        <span className="editor-header-title">{draft.title || '无标题'}</span>
        {detached
          ? <button className="icon-button" onClick={saveAndBack} aria-label="关闭">×</button>
          : <button className="icon-button danger" onClick={onDelete} aria-label="删除">×</button>}
      </div>
      <div className="editor-toolbar editor-identity-toolbar">
        <HeaderColorPicker
          compact
          value={draft.headerColor}
          onChange={(headerColor) => setDraft({ ...draft, headerColor })}
        />
        <input
          className="editor-title-input"
          aria-label="标题"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <BodyThemeToggle
          value={draft.bodyTheme}
          onChange={(bodyTheme) => setDraft({ ...draft, bodyTheme })}
        />
      </div>
      <TagEditor
        value={draft.tags}
        contentTags={draft.tasks.flatMap((task) => extractTags(task.contentMarkdown))}
        onChange={(tags) => setDraft({ ...draft, tags })}
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={draft.tasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="todo-task-list">
            {draft.tasks.map((task) => (
              <TodoTaskRow
                key={task.id}
                task={task}
                onUpdate={(patch) => onUpdateTask(task.id, patch)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
            <button className="primary-button add-task-button" onClick={onAddTask}>
              ＋ 添加任务
            </button>
          </div>
        </SortableContext>
      </DndContext>
      <span className="save-status">自动保存</span>
    </section>
  )
}
