import { useState } from 'react'
import type { AppConfig } from '../../../shared/models'
import { RecycleBinPanel } from './RecycleBinPanel'

export function SettingsPanel({
  config,
  onChange,
  onBack,
  onDataChanged
}: {
  config: AppConfig
  onChange(patch: Partial<Omit<AppConfig, 'version'>>): void
  onBack(): void
  onDataChanged(): void
}): React.JSX.Element {
  const [recycleOpen, setRecycleOpen] = useState(false)

  if (recycleOpen) {
    return (
      <RecycleBinPanel
        onBack={() => setRecycleOpen(false)}
        onChanged={onDataChanged}
      />
    )
  }

  return (
    <section className="settings-panel">
      <header className="panel-header">
        <button className="icon-button no-drag" onClick={onBack} aria-label="返回">‹</button>
        <h1>设置</h1>
        <span />
      </header>
      <div className="settings-card">
        <label>
          <span><strong>开机自启</strong><small>登录 Windows 后自动启动</small></span>
          <input
            type="checkbox"
            checked={config.autoLaunch}
            onChange={(event) => onChange({ autoLaunch: event.target.checked })}
          />
        </label>
        <label>
          <span><strong>窗口置顶</strong><small>让便签面板保持桌面可见</small></span>
          <input
            type="checkbox"
            checked={config.alwaysOnTop}
            onChange={(event) => onChange({ alwaysOnTop: event.target.checked })}
          />
        </label>
        <button className="settings-row" onClick={() => setRecycleOpen(true)}>
          <span><strong>回收站</strong><small>恢复最近 7 天删除的内容</small></span>
          <span>›</span>
        </button>
        <button
          className="settings-row"
          onClick={() => {
            void window.stickyApi.recycle.cleanUnusedImages().then((count) => {
              window.alert(
                count
                  ? `已将 ${count} 张未使用图片移入图片回收区`
                  : '没有发现未使用图片'
              )
            })
          }}
        >
          <span><strong>清理未使用图片</strong><small>保留便签和回收站仍在引用的图片</small></span>
          <span>›</span>
        </button>
      </div>
      <p className="settings-note">面板位置固定在屏幕右侧。数据仅保存在本机。</p>
    </section>
  )
}
