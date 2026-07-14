import { useEffect, useState } from 'react'
import type { SiyuanSettings } from '../../../shared/electronApi'

export function SiyuanSettingsPanel({
  onBack
}: {
  onBack(): void
}): React.JSX.Element {
  const [settings, setSettings] = useState<SiyuanSettings | null>(null)
  const [endpoint, setEndpoint] = useState('http://127.0.0.1:6806')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.stickyApi.siyuan.getSettings().then((value) => {
      setSettings(value)
      setEndpoint(value.endpoint)
    }).catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : '读取思源设置失败')
    })
  }, [])

  async function saveAndTest(): Promise<void> {
    setBusy(true)
    setStatus('')
    try {
      const next = await window.stickyApi.siyuan.updateSettings({
        endpoint,
        ...(token ? { token } : {})
      })
      setSettings(next)
      setToken('')
      const connected = await window.stickyApi.siyuan.testConnection()
      setSettings({
        ...next,
        inboxNotebookId: connected.notebookId
      })
      setStatus(
        `已连接 SiYuan ${connected.version}，目标：${connected.notebookName}`
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '连接思源失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-panel">
      <header className="panel-header">
        <button className="icon-button no-drag" onClick={onBack} aria-label="返回">‹</button>
        <h1>思源笔记</h1>
        <span />
      </header>
      <div className="settings-card siyuan-settings-card">
        <label className="settings-field">
          <span><strong>服务地址</strong><small>思源本地 API 地址</small></span>
          <input
            aria-label="思源服务地址"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
        </label>
        <label className="settings-field">
          <span>
            <strong>API Token</strong>
            <small>{settings?.hasToken ? '已安全保存，留空表示不修改' : '可在思源“设置 - 关于”中查看'}</small>
          </span>
          <input
            aria-label="API Token"
            type="password"
            value={token}
            placeholder={settings?.hasToken ? '已保存' : '可选'}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <div className="settings-field settings-target-row">
          <span><strong>发送目标</strong><small>固定投递到根目录</small></span>
          <span>{settings?.inboxNotebookId ? '00 收件箱 · 已识别' : '00 收件箱'}</span>
        </div>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void saveAndTest()}
        >
          {busy ? '正在连接...' : '保存并测试'}
        </button>
      </div>
      {status && <p className="settings-note" role="status">{status}</p>}
    </section>
  )
}
