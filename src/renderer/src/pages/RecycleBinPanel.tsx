import { useCallback, useEffect, useState } from 'react'
import type { RecycleContents } from '../../../shared/models'

const emptyContents: RecycleContents = { items: [], folders: [] }

export function RecycleBinPanel({
  onBack,
  onChanged
}: {
  onBack(): void
  onChanged(): void
}): React.JSX.Element {
  const [contents, setContents] = useState<RecycleContents>(emptyContents)

  const load = useCallback(async () => {
    setContents(await window.stickyApi.recycle.list())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function restoreItem(id: string): Promise<void> {
    if (!await window.stickyApi.recycle.restoreItem(id)) return
    setContents((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id)
    }))
    onChanged()
  }

  async function restoreFolder(id: string): Promise<void> {
    if (!await window.stickyApi.recycle.restoreFolder(id)) return
    setContents((current) => ({
      ...current,
      folders: current.folders.filter((folder) => folder.id !== id)
    }))
    onChanged()
  }

  async function empty(): Promise<void> {
    if (!window.confirm('确定永久清空回收站吗？此操作无法撤销。')) return
    await window.stickyApi.recycle.empty()
    setContents(emptyContents)
    onChanged()
  }

  const hasEntries = contents.items.length > 0 || contents.folders.length > 0

  return (
    <section className="settings-panel recycle-panel">
      <header className="panel-header">
        <button className="icon-button no-drag" onClick={onBack} aria-label="返回">
          ‹
        </button>
        <h1>回收站</h1>
        <button
          className="text-button danger-menu-item no-drag"
          onClick={() => void empty()}
          disabled={!hasEntries}
        >
          清空
        </button>
      </header>
      <p className="settings-note">删除的内容保留 7 天，之后会自动永久清理。</p>
      {!hasEntries && <div className="recycle-empty">回收站为空</div>}
      <div className="recycle-list">
        {contents.folders.map((folder) => (
          <div className="recycle-entry" key={folder.id}>
            <span><small>文件夹</small><strong>{folder.title}</strong></span>
            <button
              onClick={() => void restoreFolder(folder.id)}
              aria-label={`恢复 ${folder.title}`}
            >
              恢复
            </button>
          </div>
        ))}
        {contents.items.map((item) => (
          <div className="recycle-entry" key={item.id}>
            <span><small>{item.type === 'note' ? '笔记' : '待办'}</small><strong>{item.title || '无标题'}</strong></span>
            <button
              onClick={() => void restoreItem(item.id)}
              aria-label={`恢复 ${item.title || '无标题'}`}
            >
              恢复
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
