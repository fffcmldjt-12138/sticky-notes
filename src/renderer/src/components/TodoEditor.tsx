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
  MutationResult,
  StickyItem,
  StickyItemPatch,
  TodoItem,
  TodoSubtaskPatch,
  TodoTask,
  TodoTaskPatch
} from '../../../shared/models'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'
import { TodoTaskRow } from './TodoTaskRow'
import { TagEditor } from './TagEditor'
import { extractTags } from '../../../shared/tags'
import { useEntitySaveCoordinator } from '../hooks/useEntitySaveCoordinator'

type TodoSaveOperation =
  | { kind: 'item'; patch: StickyItemPatch }
  | { kind: 'task'; taskId: string; patch: TodoTaskPatch }
  | {
      kind: 'subtask'
      taskId: string
      subtaskId: string
      patch: TodoSubtaskPatch
    }

interface TodoSaveBatch {
  operations: TodoSaveOperation[]
}

interface Props {
  item: TodoItem
  onSave(
    expectedRevision: number,
    patch: StickyItemPatch
  ): Promise<MutationResult<StickyItem>>
  onAddTask(): Promise<TodoTask | null> | TodoTask | null | void
  onUpdateTask(
    taskId: string,
    expectedRevision: number | null,
    patch: TodoTaskPatch
  ): Promise<MutationResult<TodoItem>>
  onDeleteTask(taskId: string): void
  onReorderTasks(taskIds: string[]): void
  onAddSubtask(taskId: string): void
  onUpdateSubtask(
    taskId: string,
    subtaskId: string,
    expectedRevision: number | null,
    patch: TodoSubtaskPatch
  ): Promise<MutationResult<TodoItem>>
  onDeleteSubtask(taskId: string, subtaskId: string): void
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
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onBack,
  onDelete,
  detached = false
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(item)
  const [pendingTasks, setPendingTasks] = useState<TodoTask[]>([])
  const lastSubmittedRef = useRef<StickyItemPatch | null>(null)
  const composingIdentityRef = useRef(false)
  const taskInputRefs = useRef(new Map<string, HTMLInputElement>())
  const previousTaskIdsRef = useRef(item.tasks.map((task) => task.id))
  const pendingFocusTaskIdRef = useRef<string | null>(null)
  const requestedInitialTaskRef = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const coordinator = useEntitySaveCoordinator<TodoSaveBatch, TodoItem>({
    remoteEntity: item,
    mergePatches: (current, incoming) => ({
      operations: [...current.operations, ...incoming.operations]
    }),
    recoverConflict: (current, failed) => {
      const operations = failed.operations.filter((operation) => {
        if (operation.kind === 'item') return true
        const task = current.tasks.find((entry) => entry.id === operation.taskId)
        if (!task) return false
        return operation.kind !== 'subtask' ||
          task.children.some((child) => child.id === operation.subtaskId)
      })
      if (operations.length === failed.operations.length) return undefined
      return operations.length > 0 ? { operations } : null
    },
    save: async (expectedRevision, batch) => {
      let revision = expectedRevision
      let latest: MutationResult<TodoItem> = { status: 'ok', value: item }
      for (const operation of batch.operations) {
        if (operation.kind === 'item') {
          const result = await onSave(revision, operation.patch)
          if (result.status !== 'ok') return result as MutationResult<TodoItem>
          if (result.value.type !== 'todo') return { status: 'not-found' }
          latest = { status: 'ok', value: result.value }
        } else if (operation.kind === 'task') {
          latest = await onUpdateTask(operation.taskId, revision, operation.patch)
        } else {
          latest = await onUpdateSubtask(
            operation.taskId,
            operation.subtaskId,
            revision,
            operation.patch
          )
        }
        if (latest.status !== 'ok') return latest
        revision = latest.value.revision
      }
      return latest
    }
  })

  function addTaskOptimistically(): void {
    const localTask = createOptimisticTask()
    pendingFocusTaskIdRef.current = localTask.id
    setPendingTasks((current) => [...current, localTask])
    void Promise.resolve(onAddTask()).then((persisted) => {
      if (!persisted) return
      setPendingTasks((current) =>
        current.map((task) =>
          task.id === localTask.id ? persisted : task
        )
      )
    })
  }

  const pendingOnly = pendingTasks.filter(
    (task) => !draft.tasks.some((saved) => saved.id === task.id)
  )
  const renderedTasks = [...draft.tasks, ...pendingOnly]

  useEffect(() => {
    if (!item.tasks.length && !requestedInitialTaskRef.current) {
      requestedInitialTaskRef.current = true
      addTaskOptimistically()
    }
  }, [item.tasks.length, onAddTask])
  useEffect(() => {
    setPendingTasks((current) => {
      const pending = current.filter(
        (task) => !item.tasks.some((saved) => saved.id === task.id)
      )
      return pending.length === current.length ? current : pending
    })
  }, [item.tasks])
  useEffect(() => {
    const previousTaskIds = previousTaskIdsRef.current
    const nextTaskIds = item.tasks.map((task) => task.id)
    const addedTaskId = nextTaskIds.find((id) => !previousTaskIds.includes(id))
    previousTaskIdsRef.current = nextTaskIds
    if (addedTaskId) {
      pendingFocusTaskIdRef.current = addedTaskId
    }

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
    if (document.activeElement?.closest('.editor')) {
      if (
        addedTaskId ||
        JSON.stringify(draft.tasks.map((task) => task.id)) !==
          JSON.stringify(nextTaskIds)
      ) {
        setDraft((current) => ({ ...current, tasks: item.tasks }))
      }
      return
    }
    setDraft(item)
  }, [draft.tasks, item])
  useEffect(() => {
    const taskId = pendingFocusTaskIdRef.current
    const firstEmptyTaskId =
      taskId ??
      renderedTasks.find((task) => !task.contentMarkdown.trim())?.id ??
      null
    if (!firstEmptyTaskId) return
    const input = taskId
      ? taskInputRefs.current.get(taskId)
      : taskInputRefs.current.get(firstEmptyTaskId)
    if (!input) return
    input.focus()
    pendingFocusTaskIdRef.current = null
  }, [renderedTasks.map((task) => task.id).join('|')])
  useEffect(() => {
    if (composingIdentityRef.current) return
    const timer = window.setTimeout(() => {
      const patch = {
        title: draft.title,
        headerColor: draft.headerColor,
        bodyTheme: draft.bodyTheme
        , tags: draft.tags
      } satisfies StickyItemPatch
      if (
        patch.title === item.title &&
        patch.headerColor === item.headerColor &&
        patch.bodyTheme === item.bodyTheme &&
        JSON.stringify(patch.tags) === JSON.stringify(item.tags)
      ) return
      lastSubmittedRef.current = patch
      void coordinator.enqueue({ operations: [{ kind: 'item', patch }] })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [
    coordinator.enqueue,
    draft.bodyTheme,
    draft.headerColor,
    draft.tags,
    draft.title,
    item.bodyTheme,
    item.headerColor,
    item.tags,
    item.title
  ])

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = renderedTasks.findIndex((task) => task.id === active.id)
    const newIndex = renderedTasks.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorderTasks(arrayMove(renderedTasks, oldIndex, newIndex).map((task) => task.id))
  }

  function saveAndBack(): void {
    const patch = {
      title: draft.title,
      headerColor: draft.headerColor,
      bodyTheme: draft.bodyTheme
      , tags: draft.tags
    } satisfies StickyItemPatch
    lastSubmittedRef.current = patch
    void coordinator.enqueue({ operations: [{ kind: 'item', patch }] })
    onBack()
  }

  return (
    <section className={`editor body-${draft.bodyTheme} ${detached ? 'detached-editor' : ''}`}>
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
      {!detached && (
        <>
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
              onCompositionStart={() => {
                composingIdentityRef.current = true
              }}
              onCompositionEnd={() => {
                composingIdentityRef.current = false
                void coordinator.enqueue({
                  operations: [{ kind: 'item', patch: { title: draft.title } }]
                })
              }}
            />
            <BodyThemeToggle
              value={draft.bodyTheme}
              onChange={(bodyTheme) => setDraft({ ...draft, bodyTheme })}
            />
          </div>
          <TagEditor
            value={draft.tags}
            contentTags={renderedTasks.flatMap((task) => extractTags(task.contentMarkdown))}
            onChange={(tags) => setDraft({ ...draft, tags })}
          />
        </>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={renderedTasks.map((task) => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="todo-task-list">
            {renderedTasks.map((task) => (
              <TodoTaskRow
                key={task.id}
                task={task}
                bodyTheme={draft.bodyTheme}
                onUpdate={(patch) => {
                  if (Object.hasOwn(patch, 'contentMarkdown')) {
                    void coordinator.enqueue({
                      operations: [{ kind: 'task', taskId: task.id, patch }]
                    })
                  } else {
                    void onUpdateTask(task.id, null, patch)
                  }
                }}
                onDelete={() => onDeleteTask(task.id)}
                onAddSubtask={() => onAddSubtask(task.id)}
                onUpdateSubtask={(subtaskId, patch) => {
                  if (Object.hasOwn(patch, 'contentMarkdown')) {
                    void coordinator.enqueue({
                      operations: [{
                        kind: 'subtask',
                        taskId: task.id,
                        subtaskId,
                        patch
                      }]
                    })
                  } else {
                    void onUpdateSubtask(task.id, subtaskId, null, patch)
                  }
                }}
                onDeleteSubtask={(subtaskId) =>
                  onDeleteSubtask(task.id, subtaskId)
                }
                inputRef={(element) => {
                  if (element) {
                    taskInputRefs.current.set(task.id, element)
                  } else {
                    taskInputRefs.current.delete(task.id)
                  }
                }}
              />
            ))}
            <button className="primary-button add-task-button" onClick={addTaskOptimistically}>
              ＋ 添加任务
            </button>
          </div>
        </SortableContext>
      </DndContext>
      {!detached && <span className="save-status">自动保存</span>}
    </section>
  )
}

function createOptimisticTask(): TodoTask {
  return {
    id: `local_${crypto.randomUUID()}`,
    contentMarkdown: '',
    completed: false,
    tags: [],
    importance: 'normal',
    urgency: 'normal',
    children: [],
    schedule: null
  }
}
