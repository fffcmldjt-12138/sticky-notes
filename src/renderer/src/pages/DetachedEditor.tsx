import { useCallback, useEffect, useState } from 'react'
import type { StickyItem, StickyItemPatch, TodoTaskPatch } from '../../../shared/models'
import { NoteEditor } from '../components/NoteEditor'
import { TodoEditor } from '../components/TodoEditor'

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
      if (changed.id === itemId) setItem(changed)
    })
    const removeDeleted = window.stickyApi.onItemDeleted((deletedId) => {
      if (deletedId === itemId) setError('便签已删除')
    })
    return () => {
      removeChanged()
      removeDeleted()
    }
  }, [itemId, load])

  async function save(patch: StickyItemPatch): Promise<void> {
    const updated = await window.stickyApi.notes.update(itemId, patch)
    if (updated) setItem(updated)
  }

  async function remove(): Promise<void> {
    if (!item || !window.confirm(`确定删除“${item.title}”吗？`)) return
    await window.stickyApi.notes.delete(item.id)
  }

  async function updateTask(taskId: string, patch: TodoTaskPatch): Promise<void> {
    const updated = await window.stickyApi.notes.updateTodoTask(itemId, taskId, patch)
    if (updated) setItem(updated)
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
        onSave={(patch) => void save(patch)}
        onBack={attach}
        onDelete={() => void remove()}
      />
    )
  }

  return (
    <TodoEditor
      detached
      item={item}
      onSave={(patch) => void save(patch)}
      onAddTask={async () => {
        await window.stickyApi.notes.addTodoTask(item.id)
        await load()
      }}
      onUpdateTask={(taskId, patch) => void updateTask(taskId, patch)}
      onDeleteTask={async (taskId) => {
        if (!window.confirm('确定删除这条任务吗？')) return
        const updated = await window.stickyApi.notes.deleteTodoTask(item.id, taskId)
        if (updated) setItem(updated)
      }}
      onReorderTasks={async (taskIds) => {
        const updated = await window.stickyApi.notes.reorderTodoTasks(item.id, taskIds)
        if (updated) setItem(updated)
      }}
      onBack={attach}
      onDelete={() => void remove()}
    />
  )
}
