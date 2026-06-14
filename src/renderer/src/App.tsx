import { useCallback, useEffect, useState } from 'react'
import type { AppConfig, NoteType, StickyItem, StickyItemPatch } from '../../shared/models'
import { CreateMenu } from './components/CreateMenu'
import { NoteEditor } from './components/NoteEditor'
import { TodoEditor } from './components/TodoEditor'
import { SettingsPanel } from './pages/SettingsPanel'
import { StickyPanel } from './pages/StickyPanel'

export default function App(): React.JSX.Element {
  const [items, setItems] = useState<StickyItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)

  const loadItems = useCallback(async () => setItems(await window.stickyApi.notes.list()), [])

  useEffect(() => {
    void loadItems()
    void window.stickyApi.config.get().then(setConfig)
  }, [loadItems])

  const createItem = useCallback(async (type: NoteType) => {
    const item = await window.stickyApi.notes.create(type)
    setItems((current) => [item, ...current])
    setSelectedId(item.id)
    setCreateOpen(false)
  }, [])

  useEffect(() => window.stickyApi.onOpenEditor((type) => void createItem(type)), [createItem])

  const selected = items.find((item) => item.id === selectedId) ?? null
  const suspendAutoHide = Boolean(selected || createOpen || settingsOpen)
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
        <TodoEditor item={selected} onSave={(patch) => void save(selected.id, patch)} onBack={() => setSelectedId(null)} onDelete={() => void remove(selected)} />
      )}
      {!selected && settingsOpen && config && (
        <SettingsPanel config={config} onChange={(patch) => void updateConfig(patch)} onBack={() => setSettingsOpen(false)} />
      )}
      {!selected && !settingsOpen && (
        <>
          <header className="panel-header">
            <div><h1>便签</h1><span>{items.length} 条记录</span></div>
            <div className="header-actions">
              <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="设置">⚙</button>
              <button className="primary-button" onClick={() => setCreateOpen((open) => !open)}>＋ 新建</button>
            </div>
          </header>
          {createOpen && <CreateMenu onCreate={(type) => void createItem(type)} onClose={() => setCreateOpen(false)} />}
          <StickyPanel
            items={items}
            onOpen={(item) => setSelectedId(item.id)}
            onToggleTodo={(item, completed) => void save(item.id, { completed })}
          />
        </>
      )}
    </div>
  )
}

