import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type {
  AppConfig,
  FolderItem,
  NoteType,
  StickyItem,
  StickyItemPatch
} from '../../shared/models'
import type {
  DetachWindowOptions,
  ReminderAlertPayload
} from '../../shared/electronApi'
import { CreateMenu } from './components/CreateMenu'
import { FolderDialog } from './components/FolderDialog'
import { FolderContextMenu } from './components/FolderContextMenu'
import { CardContextMenu, type CardAction } from './components/CardContextMenu'
import { TitleDialog } from './components/TitleDialog'
import { TodoEditor } from './components/TodoEditor'
import { StickyPanel } from './pages/StickyPanel'
import { ReminderWindow } from './pages/ReminderWindow'
import { upsertItem } from './lib/itemList'
import { getItemTags, mergeTags } from '../../shared/tags'
import type { FolderTreeNode } from './lib/folderTree'

const NoteEditor = lazy(() =>
  import('./components/NoteEditor').then((module) => ({
    default: module.NoteEditor
  }))
)
const SettingsPanel = lazy(() =>
  import('./pages/SettingsPanel').then((module) => ({
    default: module.SettingsPanel
  }))
)
const DetachedEditor = lazy(() =>
  import('./pages/DetachedEditor').then((module) => ({
    default: module.DetachedEditor
  }))
)
const DetachedFolder = lazy(() =>
  import('./pages/DetachedFolder').then((module) => ({
    default: module.DetachedFolder
  }))
)

export default function App(): React.JSX.Element {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const id = params.get('id')
  if (mode === 'reminder') {
    const payload = parseReminderPayload(params.get('payload'))
    return payload
      ? <ReminderWindow payload={payload} />
      : <div className="detached-error">提醒内容无法读取</div>
  }
  let content: React.JSX.Element = <PanelApp />
  if (mode === 'folder' && id) content = <DetachedFolder folderId={id} />
  if (mode === 'detached' && id) content = <DetachedEditor itemId={id} />
  return <Suspense fallback={<div className="app-loading">正在加载...</div>}>
    {content}
  </Suspense>
}

function parseReminderPayload(value: string | null): ReminderAlertPayload | null {
  if (!value) return null
  try {
    const payload = JSON.parse(value) as ReminderAlertPayload
    return typeof payload.title === 'string' && typeof payload.body === 'string'
      ? payload
      : null
  } catch {
    return null
  }
}

function PanelApp(): React.JSX.Element {
  const [items, setItems] = useState<StickyItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTargetFolderId, setCreateTargetFolderId] =
    useState<string | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [pendingFolderParentId, setPendingFolderParentId] =
    useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [pendingRename, setPendingRename] = useState<StickyItem | null>(null)
  const [pendingFolderRename, setPendingFolderRename] =
    useState<FolderItem | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [treeDragActive, setTreeDragActive] = useState(false)
  const [activeReminder, setActiveReminder] =
    useState<ReminderAlertPayload | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    item: StickyItem
    x: number
    y: number
  } | null>(null)
  const [folderContextMenu, setFolderContextMenu] = useState<{
    folder: FolderItem
    x: number
    y: number
  } | null>(null)

  const loadItems = useCallback(async () => setItems(await window.stickyApi.notes.list()), [])
  const loadFolders = useCallback(
    async () => setFolders(await window.stickyApi.folders.list()),
    []
  )

  useEffect(() => {
    void loadItems()
    void loadFolders()
    void window.stickyApi.config.get().then(setConfig)
  }, [loadFolders, loadItems])

  useEffect(() => {
    const removeChanged = window.stickyApi.onItemChanged((changed) => {
      setItems((current) => upsertItem(current, changed))
    })
    const removeDeleted = window.stickyApi.onItemDeleted((itemId) => {
      setItems((current) => current.filter((item) => item.id !== itemId))
      setSelectedId((current) => current === itemId ? null : current)
    })
    return () => {
      removeChanged()
      removeDeleted()
    }
  }, [])

  useEffect(() => {
    const removeChanged = window.stickyApi.onFolderChanged?.((changed) => {
      setFolders((current) => {
        const index = current.findIndex((folder) => folder.id === changed.id)
        if (index < 0) return [...current, changed]
        return current.map((folder) => folder.id === changed.id ? changed : folder)
      })
    })
    const removeDeleted = window.stickyApi.onFolderDeleted?.((folderId) => {
      setFolders((current) => current.filter((folder) => folder.id !== folderId))
    })
    return () => {
      removeChanged?.()
      removeDeleted?.()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.stickyApi.onReminderFired?.((payload) => {
      setActiveReminder(payload)
      window.stickyApi.window.cancelCollapse()
      window.stickyApi.window.expand()
    })
    return unsubscribe ?? (() => undefined)
  }, [])

  const createItem = useCallback(async (
    type: NoteType,
    title?: string,
    parentFolderId: string | null = null
  ) => {
    const item = await window.stickyApi.notes.create(type, title, parentFolderId)
    setItems((current) => upsertItem(current, item))
    setSelectedId(item.id)
    setCreateOpen(false)
    setCreateTargetFolderId(null)
  }, [])

  const createFolder = useCallback(async (title: string) => {
    const folder = await window.stickyApi.folders.create(
      title,
      pendingFolderParentId
    )
    setFolders((current) => [...current, folder])
    setPendingFolderParentId(null)
    setFolderDialogOpen(false)
    setCreateOpen(false)
  }, [pendingFolderParentId])

  useEffect(
    () => window.stickyApi.onOpenEditor((type) => void createItem(type)),
    [createItem]
  )

  useEffect(
    () => window.stickyApi.onOpenItem?.((itemId) => {
      setSettingsOpen(false)
      setSelectedId(itemId)
    }) ?? (() => undefined),
    []
  )

  const selected = items.find((item) => item.id === selectedId) ?? null
  const allTags = mergeTags(...items.map(getItemTags))
  const visibleItems = activeTag
    ? items.filter((item) => getItemTags(item).includes(activeTag))
    : items
  const suspendAutoHide = Boolean(
    selected ||
    createOpen ||
    folderDialogOpen ||
    settingsOpen ||
    pendingRename ||
    pendingFolderRename ||
    contextMenu ||
    folderContextMenu
    || treeDragActive
    || activeReminder
  )
  useEffect(() => {
    window.stickyApi.window.suspendAutoHide(suspendAutoHide)
  }, [suspendAutoHide])

  const save = useCallback(async (id: string, patch: StickyItemPatch) => {
    const updated = await window.stickyApi.notes.update(id, patch)
    if (updated) setItems((current) => current.map((item) => item.id === id ? updated : item))
  }, [])

  async function remove(item: StickyItem): Promise<void> {
    if (!window.confirm(`确定删除“${item.title || '无标题'}”吗？`)) return
    if (await window.stickyApi.notes.delete(item.id)) {
      setItems((current) => current.filter((entry) => entry.id !== item.id))
      setSelectedId(null)
    }
  }

  async function updateConfig(patch: Partial<Omit<AppConfig, 'version'>>): Promise<void> {
    setConfig(await window.stickyApi.config.update(patch))
  }

  async function handleCardAction(item: StickyItem, action: CardAction): Promise<void> {
    if (action.type === 'edit') setSelectedId(item.id)
    if (action.type === 'rename') setPendingRename(item)
    if (action.type === 'color') await save(item.id, { headerColor: action.color })
    if (action.type === 'theme') await save(item.id, { bodyTheme: action.theme })
    if (action.type === 'pin') await save(item.id, { pinned: action.pinned })
    if (action.type === 'add-task' && item.type === 'todo') {
      await window.stickyApi.notes.addTodoTask(item.id)
      await loadItems()
      setSelectedId(item.id)
    }
    if (action.type === 'delete') await remove(item)
    if (action.type === 'detach') {
      if (item.detached) await window.stickyApi.window.attach(item.id)
      else await window.stickyApi.window.detach(item.id)
      await loadItems()
    }
  }

  return (
    <div
      className="app-shell"
      onMouseEnter={() => {
        window.stickyApi.window.cancelCollapse()
        window.stickyApi.window.expand()
      }}
      onMouseLeave={() => window.stickyApi.window.scheduleCollapse()}
    >
      {activeReminder && (
        <div className="reminder-alert reminder-alert-strong" role="alert">
          <div>
            <em>待办强提醒</em>
            <strong>{activeReminder.title}</strong>
            <span>{activeReminder.body}</span>
          </div>
          <div className="reminder-alert-actions">
            {activeReminder.itemId && (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(activeReminder.itemId ?? null)
                  setSettingsOpen(false)
                  setActiveReminder(null)
                }}
              >
                查看
              </button>
            )}
            <button type="button" onClick={() => setActiveReminder(null)}>
              知道了
            </button>
          </div>
        </div>
      )}
      {selected?.type === 'note' && (
        <NoteEditor item={selected} onSave={(patch) => void save(selected.id, patch)} onBack={() => setSelectedId(null)} onDelete={() => void remove(selected)} />
      )}
      {selected?.type === 'todo' && (
        <TodoEditor
          item={selected}
          onSave={(patch) => void save(selected.id, patch)}
          onAddTask={async () => {
            await window.stickyApi.notes.addTodoTask(selected.id)
            await loadItems()
          }}
          onUpdateTask={async (taskId, patch) => {
            const updated = await window.stickyApi.notes.updateTodoTask(
              selected.id,
              taskId,
              patch
            )
            if (updated) {
              setItems((current) =>
                current.map((item) => item.id === updated.id ? updated : item)
              )
            }
          }}
          onDeleteTask={async (taskId) => {
            if (!window.confirm('确定删除这条任务吗？')) return
            const updated = await window.stickyApi.notes.deleteTodoTask(
              selected.id,
              taskId
            )
            if (updated) {
              setItems((current) =>
                current.map((item) => item.id === updated.id ? updated : item)
              )
            }
          }}
          onReorderTasks={async (taskIds) => {
            const updated = await window.stickyApi.notes.reorderTodoTasks(
              selected.id,
              taskIds
            )
            if (updated) {
              setItems((current) =>
                current.map((item) => item.id === updated.id ? updated : item)
              )
            }
          }}
          onAddSubtask={async (taskId) => {
            await window.stickyApi.notes.addTodoSubtask(selected.id, taskId)
            await loadItems()
          }}
          onUpdateSubtask={async (taskId, subtaskId, patch) => {
            const updated = await window.stickyApi.notes.updateTodoSubtask(
              selected.id,
              taskId,
              subtaskId,
              patch
            )
            if (updated) {
              setItems((current) =>
                current.map((item) => item.id === updated.id ? updated : item)
              )
            }
          }}
          onDeleteSubtask={async (taskId, subtaskId) => {
            const updated = await window.stickyApi.notes.deleteTodoSubtask(
              selected.id,
              taskId,
              subtaskId
            )
            if (updated) {
              setItems((current) =>
                current.map((item) => item.id === updated.id ? updated : item)
              )
            }
          }}
          onBack={() => setSelectedId(null)}
          onDelete={() => void remove(selected)}
        />
      )}
      {!selected && settingsOpen && config && (
        <SettingsPanel
          config={config}
          onChange={(patch) => void updateConfig(patch)}
          onBack={() => setSettingsOpen(false)}
          onDataChanged={() => {
            void loadItems()
            void loadFolders()
          }}
        />
      )}
      {!selected && !settingsOpen && (
        <>
          <header className="panel-header">
            <div>
              <h1>便签</h1>
              <span>{items.length} 条记录</span>
              <div className="panel-tag-filters">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={activeTag === tag ? 'active' : ''}
                    onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="header-actions">
              <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="设置">⚙</button>
              <button
                className="primary-button"
                onClick={() => {
                  setCreateTargetFolderId(null)
                  setCreateOpen((open) => !open)
                }}
              >
                ＋ 新建
              </button>
            </div>
          </header>
          {createOpen && (
            <CreateMenu
              onCreate={(type) => {
                void createItem(type, undefined, createTargetFolderId)
              }}
              canCreateFolder={
                !createTargetFolderId ||
                folderDepth(folders, createTargetFolderId) < 3
              }
              onCreateFolder={() => {
                setCreateOpen(false)
                setPendingFolderParentId(createTargetFolderId)
                setFolderDialogOpen(true)
              }}
              onClose={() => {
                setCreateOpen(false)
                setCreateTargetFolderId(null)
              }}
            />
          )}
          <StickyPanel
            items={visibleItems}
            folders={folders}
            onOpen={(item) => setSelectedId(item.id)}
            onToggleTodo={async (item, taskId, completed) => {
              if (item.type !== 'todo') return
              const updated = await window.stickyApi.notes.updateTodoTask(
                item.id,
                taskId,
                { completed }
              )
              if (updated) {
                setItems((current) =>
                  current.map((entry) => entry.id === updated.id ? updated : entry)
                )
              }
            }}
            onToggleTodoSubtask={async (item, taskId, subtaskId, completed) => {
              if (item.type !== 'todo') return
              const updated = await window.stickyApi.notes.updateTodoSubtask(
                item.id,
                taskId,
                subtaskId,
                { completed }
              )
              if (updated) {
                setItems((current) =>
                  current.map((entry) => entry.id === updated.id ? updated : entry)
                )
              }
            }}
            onToggleTodoExpanded={(item, panelExpanded) => {
              void save(item.id, { panelExpanded })
            }}
            onContextMenu={(item, event) =>
              setContextMenu({ item, x: event.clientX, y: event.clientY })
            }
            onDetach={(item, options?: DetachWindowOptions) =>
              void window.stickyApi.window.detach(item.id, options)
            }
            onToggleFolder={(folder: FolderTreeNode) => {
              void window.stickyApi.folders
                .update(folder.id, { collapsed: !folder.collapsed })
                .then((updated) => {
                  if (!updated) return
                  setFolders((current) =>
                    current.map((entry) => entry.id === updated.id ? updated : entry)
                  )
                })
            }}
            onFolderContextMenu={(folder, event) =>
              setFolderContextMenu({
                folder,
                x: event.clientX,
                y: event.clientY
              })
            }
            onCreateInFolder={(folder) => {
              setCreateTargetFolderId(folder.id)
              setCreateOpen(true)
            }}
            onDetachFolder={(folder, options?: DetachWindowOptions) => {
              void window.stickyApi.window.detachFolder(folder.id, options)
            }}
            onReorder={(parentFolderId, orderedNodes) => {
              void window.stickyApi.folders
                .reorderChildren(parentFolderId, orderedNodes)
                .then(() => {
                  void loadItems()
                  void loadFolders()
                })
                .catch((error: unknown) =>
                  window.alert(error instanceof Error ? error.message : '移动失败')
                )
            }}
            onBeginDrag={() => {
              setContextMenu(null)
              setFolderContextMenu(null)
              setCreateOpen(false)
            }}
            onDragStateChange={setTreeDragActive}
          />
        </>
      )}
      {contextMenu && (
        <CardContextMenu
          item={contextMenu.item}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onAction={(action) => void handleCardAction(contextMenu.item, action)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {folderContextMenu && (
        <FolderContextMenu
          position={{ x: folderContextMenu.x, y: folderContextMenu.y }}
          canCreateFolder={folderDepth(folders, folderContextMenu.folder.id) < 3}
          onCreate={(type) => {
            const targetId = folderContextMenu.folder.id
            setFolderContextMenu(null)
            if (type === 'folder') {
              setPendingFolderParentId(targetId)
              setFolderDialogOpen(true)
              return
            }
            void createItem(type, undefined, targetId)
          }}
          onRename={() => {
            setPendingFolderRename(folderContextMenu.folder)
            setFolderContextMenu(null)
          }}
          onDelete={() => {
            const folder = folderContextMenu.folder
            setFolderContextMenu(null)
            if (!window.confirm(`确定删除“${folder.title}”吗？其中内容会移到上一级。`)) {
              return
            }
            void window.stickyApi.folders.delete(folder.id).then(() => {
              void loadItems()
              void loadFolders()
            })
          }}
          onClose={() => setFolderContextMenu(null)}
        />
      )}
      {pendingRename && (
        <TitleDialog
          type={pendingRename.type}
          initialTitle={pendingRename.title}
          onConfirm={(title) => {
            void save(pendingRename.id, { title })
            setPendingRename(null)
          }}
          onCancel={() => setPendingRename(null)}
        />
      )}
      {folderDialogOpen && (
        <FolderDialog
          onConfirm={createFolder}
          onCancel={() => {
            setFolderDialogOpen(false)
            setPendingFolderParentId(null)
          }}
        />
      )}
      {pendingFolderRename && (
        <FolderDialog
          initialTitle={pendingFolderRename.title}
          onConfirm={async (title) => {
            await window.stickyApi.folders.update(pendingFolderRename.id, {
              title
            })
            setPendingFolderRename(null)
            await loadFolders()
          }}
          onCancel={() => setPendingFolderRename(null)}
        />
      )}
    </div>
  )
}

function folderDepth(folders: FolderItem[], folderId: string): number {
  let depth = 0
  let current: string | null = folderId
  while (current) {
    depth += 1
    current = folders.find((folder) => folder.id === current)?.parentFolderId ?? null
  }
  return depth
}
