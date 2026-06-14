import type { AppConfig } from '../../../shared/models'

export function SettingsPanel({
  config,
  onChange,
  onBack
}: {
  config: AppConfig
  onChange(patch: Partial<Omit<AppConfig, 'version'>>): void
  onBack(): void
}): React.JSX.Element {
  return (
    <section className="settings-panel">
      <header className="panel-header">
        <button className="icon-button" onClick={onBack}>‹</button>
        <h1>设置</h1>
        <span />
      </header>
      <div className="settings-card">
        <label><span><strong>开机自启</strong><small>登录 Windows 后自动启动</small></span><input type="checkbox" checked={config.autoLaunch} onChange={(event) => onChange({ autoLaunch: event.target.checked })} /></label>
        <label><span><strong>窗口置顶</strong><small>让便签面板保持桌面可见</small></span><input type="checkbox" checked={config.alwaysOnTop} onChange={(event) => onChange({ alwaysOnTop: event.target.checked })} /></label>
      </div>
      <p className="settings-note">面板位置固定在屏幕右侧。数据仅保存在本机。</p>
    </section>
  )
}

