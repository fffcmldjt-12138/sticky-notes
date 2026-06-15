import { useCallback, useEffect, useState } from 'react'
import type {
  AppConfig,
  FolderItem,
  NoteType,
  StickyItem,
  StickyItemPatch
} from '../../shared/models'
import { CreateMenu } from './components/CreateMenu'
import { CardContextMenu, type CardAction } from './components/CardContextMenu'
import { NoteEditor } from './components/NoteEditor'
import { TitleDialog } from './components/TitleDialog'
import { TodoEditor } from './components/TodoEditor'
import { SettingsPanel } from './pages/SettingsPanel'
import { StickyPanel } from './pages/StickyPanel'
import { DetachedEditor } from './pages/DetachedEditor'
import { upsertItem } from './lib/itemList'
import { getItemTags, mergeTags } from '../../shared/tags'
import type { FolderTreeNode } from './lib/folderTree'

export default function App(): React.JSX.Element {
  const params = new URLSearchParams(window.location.search)
  const detachedId = params.get('mode') === 'detached' ? params.get('id') : null
  return detachedId ? <DetachedEditor itemId={detachedId} /> : <PanelApp />
}

function PanelApp(): React.JSX.Element {
  const [items, setItems] = useState<StickyItem[]>([])
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [pendingRename, setPendingRename] = useState<StickyItem | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    item: StickyItem
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

  const createItem = useCallback(async (type: NoteType, title?: string) => {
    const item = await window.stickyApi.notes.create(type, title)
    setItems((current) => upsertItem(current, item))
    setSelectedId(item.id)
    setCreateOpen(false)
  }, [])

  const createFolder = useCallback(async () => {
    const title = window.prompt('文件夹名称', '新建文件夹')
    if (title === null) return
    const folder = await window.stickyApi.folders.create(title)
    setFolders((current) => [...current, folder])
    setCreateOpen(false)
  }, [])

  useEffect(
    () => window.stickyApi.onOpenEditor((type) => void createItem(type)),
    [createItem]
  )

  const selected = items.find((item) => item.id === selectedId) ?? null
  const allTags = mergeTags(...items.map(getItemTags))
  const visibleItems = activeTag
    ? items.filter((item) => getItemTags(item).includes(activeTag))
    : items
  const suspendAutoHide = Boolean(
    selected ||
    createOpen ||
    settingsOpen ||
    pendingRename ||
    contextMenu
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
              <button className="primary-button" onClick={() => setCreateOpen((open) => !open)}>＋ 新建</button>
            </div>
          </header>
          {createOpen && (
            <CreateMenu
              onCreate={(type) => {
                void createItem(type)
              }}
              onCreateFolder={() => void createFolder()}
              onClose={() => setCreateOpen(false)}
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
            onContextMenu={(item, event) =>
              setContextMenu({ item, x: event.clientX, y: event.clientY })
            }
            onDetach={(item) => void window.stickyApi.window.detach(item.id)}
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
            onMoveItem={(itemId, folderId) => {
              void window.stickyApi.folders
                .moveItem(itemId, folderId)
                .then((updated) => {
                  if (!updated) return
                  setItems((current) =>
                    current.map((entry) => entry.id === updated.id ? updated : entry)
                  )
                })
                .catch((error: unknown) =>
                  window.alert(error instanceof Error ? error.message : '移动便签失败')
                )
            }}
            onMoveFolder={(folderId, parentFolderId) => {
              void window.stickyApi.folders
                .update(folderId, { parentFolderId })
                .then((updated) => {
                  if (!updated) return
                  setFolders((current) =>
                    current.map((entry) => entry.id === updated.id ? updated : entry)
                  )
                })
                .catch((error: unknown) =>
                  window.alert(error instanceof Error ? error.message : '移动文件夹失败')
                )
            }}
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
    </div>
  )
}
