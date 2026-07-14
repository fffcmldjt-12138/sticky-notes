import { useCallback, useEffect, useState } from 'react'
import type { StickyItem, StickyItemPatch, TodoTaskPatch } from '../../../shared/models'
import { NoteEditor } from '../components/NoteEditor'
import { TodoEditor } from '../components/TodoEditor'
import { acceptNewer } from '../lib/entityEvents'

export function DetachedEditor({ itemId }: { itemId: string }): React.JSX.Element {
  const [item, setItem] = useState<StickyItem | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const found = (await window.stickyApi.notes.list()).find((entry) => entry.id === itemId)
    if (found) setItem(found)
    else setError('便签不存在或已被删除')
  }, [itemId])

  useEffect(() => {
    void load()
    const removeChanged = window.stickyApi.onItemChanged((changed) => {
      if (changed.id === itemId) {
        setItem((current) => acceptNewer(current ?? undefined, changed))
      }
    })
    const removeDeleted = window.stickyApi.onItemDeleted((deletedId) => {
      if (deletedId === itemId) {
        setItem(null)
        setError('便签已删除')
      }
    })
    const removeReloaded = window.stickyApi.onDataReloaded(() => void load())
    return () => {
      removeChanged()
      removeDeleted()
      removeReloaded()
    }
  }, [itemId, load])

  async function save(expectedRevision: number, patch: StickyItemPatch) {
    const updated = await window.stickyApi.notes.update(
      itemId, expectedRevision, patch
    )
    if (updated.status === 'ok') setItem(updated.value)
    return updated
  }

  async function remove(): Promise<void> {
    if (!item || !window.confirm(`确定删除“${item.title}”吗？`)) return
    await window.stickyApi.notes.delete(item.id)
  }

  async function updateTask(
    taskId: string,
    expectedRevision: number | null,
    patch: TodoTaskPatch
  ) {
    if (!item || item.type !== 'todo') return { status: 'not-found' as const }
    const updated = await window.stickyApi.notes.updateTodoTask(
      itemId,
      taskId,
      expectedRevision,
      patch
    )
    if (updated.status === 'ok') setItem(updated.value)
    return updated
  }

  if (error) return <div className="detached-error">{error}</div>
  if (!item) return <div className="detached-loading">正在加载...</div>

  const attach = (): void => {
    void window.stickyApi.window.attach(item.id)
  }

  if (item.type === 'note') {
    return (
      <NoteEditor
        detached
        item={item}
        onSave={save}
        onBack={attach}
        onDelete={() => void remove()}
      />
    )
  }

  return (
    <TodoEditor
      detached
      item={item}
      onSave={save}
      onAddTask={() => window.stickyApi.notes.addTodoTask(item.id)}
      onUpdateTask={updateTask}
      onDeleteTask={async (taskId) => {
        if (!window.confirm('确定删除这条任务吗？')) return
        const updated = await window.stickyApi.notes.deleteTodoTask(item.id, taskId)
        if (updated.status === 'ok') setItem(updated.value)
      }}
      onReorderTasks={async (taskIds) => {
        const updated = await window.stickyApi.notes.reorderTodoTasks(item.id, taskIds)
        if (updated.status === 'ok') setItem(updated.value)
      }}
      onAddSubtask={async (taskId) => {
        await window.stickyApi.notes.addTodoSubtask(item.id, taskId)
        await load()
      }}
      onUpdateSubtask={async (taskId, subtaskId, expectedRevision, patch) => {
        const updated = await window.stickyApi.notes.updateTodoSubtask(
          item.id,
          taskId,
          subtaskId,
          expectedRevision,
          patch
        )
        if (updated.status === 'ok') setItem(updated.value)
        return updated
      }}
      onDeleteSubtask={async (taskId, subtaskId) => {
        const updated = await window.stickyApi.notes.deleteTodoSubtask(
          item.id,
          taskId,
          subtaskId
        )
        if (updated.status === 'ok') setItem(updated.value)
      }}
      onBack={attach}
      onDelete={() => void remove()}
    />
  )
}
