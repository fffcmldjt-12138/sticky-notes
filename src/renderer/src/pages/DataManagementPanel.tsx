import { useEffect, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  DatabaseBackup,
  Download,
  FolderOpen,
  RefreshCw,
  Upload,
  X
} from 'lucide-react'
import type {
  BackupSummary,
  ImportSummary
} from '../../../shared/electronApi'

type Operation = 'backup' | 'restore' | 'export' | 'inspect' | 'cancel' | 'import' | 'open'

export function DataManagementPanel({
  onBack
}: {
  onBack(): void
}): React.JSX.Element {
  const [backups, setBackups] = useState<BackupSummary[]>([])
  const [pendingRestore, setPendingRestore] = useState<BackupSummary | null>(null)
  const [inspection, setInspection] = useState<ImportSummary | null>(null)
  const [busy, setBusy] = useState<Operation | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const refreshBackups = async (): Promise<void> => {
    setBackups(await window.stickyApi.data.listBackups())
  }

  useEffect(() => {
    void refreshBackups().catch((reason: unknown) => {
      setError(messageFrom(reason))
    })
  }, [])

  const run = async (
    operation: Operation,
    action: () => Promise<void>
  ): Promise<void> => {
    if (busy) return
    setBusy(operation)
    setStatus('')
    setError('')
    try {
      await action()
    } catch (reason) {
      setError(messageFrom(reason))
    } finally {
      setBusy(null)
    }
  }

  const cancelInspection = async (): Promise<void> => {
    if (!inspection) return
    await window.stickyApi.data.cancelImport(inspection.inspectionId)
    setInspection(null)
    setStatus('已取消导入')
  }

  return (
    <section className="settings-panel data-management-panel">
      <header className="panel-header">
        <button className="icon-button no-drag" onClick={onBack} aria-label="返回">
          <ArrowLeft size={18} />
        </button>
        <h1>数据与备份</h1>
        <span />
      </header>

      <div className="data-settings-list">
        <div className="data-settings-row">
          <DatabaseBackup size={18} />
          <span><strong>本地备份</strong><small>创建当前便签与文件夹快照</small></span>
          <button
            disabled={busy !== null}
            onClick={() => void run('backup', async () => {
              await window.stickyApi.data.createBackup()
              await refreshBackups()
              setStatus('备份已创建')
            })}
          >
            {busy === 'backup' ? <RefreshCw className="spin" size={15} /> : <Archive size={15} />}
            立即备份
          </button>
        </div>

        <div className="backup-list" aria-label="备份列表">
          {backups.length === 0 && <p>暂无可恢复备份</p>}
          {backups.map((backup) => (
            <div className="backup-entry" key={backup.id}>
              <span>
                <strong>{backupKindLabel(backup.kind)}</strong>
                <small>{formatDate(backup.createdAt)} · {formatBytes(backup.size)}</small>
              </span>
              <button
                disabled={busy !== null}
                onClick={() => setPendingRestore(backup)}
              >
                恢复此备份
              </button>
            </div>
          ))}
        </div>

        {pendingRestore && (
          <div className="data-confirmation" role="group" aria-label="恢复确认">
            <strong>将替换当前便签数据</strong>
            <small>恢复前会保留当前快照。窗口将在完成后重新载入。</small>
            <div>
              <button disabled={busy !== null} onClick={() => setPendingRestore(null)}>取消</button>
              <button
                className="danger-action"
                disabled={busy !== null}
                onClick={() => void run('restore', async () => {
                  await window.stickyApi.data.restoreBackup(pendingRestore.id)
                  setPendingRestore(null)
                  await refreshBackups()
                  setStatus('已从备份恢复')
                })}
              >确认恢复</button>
            </div>
          </div>
        )}

        <div className="data-settings-row">
          <Download size={18} />
          <span><strong>导出完整数据包</strong><small>包含便签、文件夹和本地图片</small></span>
          <button
            disabled={busy !== null}
            onClick={() => void run('export', async () => {
              if (await window.stickyApi.data.exportArchive()) setStatus('数据包已导出')
            })}
          ><Download size={15} />导出</button>
        </div>

        <div className="data-settings-row">
          <Upload size={18} />
          <span><strong>导入完整数据包</strong><small>先检查内容，再确认完整替换</small></span>
          <button
            disabled={busy !== null || inspection !== null}
            onClick={() => void run('inspect', async () => {
              const next = await window.stickyApi.data.inspectImport()
              if (next) setInspection(next)
            })}
          ><Upload size={15} />选择导入文件</button>
        </div>

        {inspection && (
          <div className="import-inspection">
            <div className="import-counts">
              <span>{inspection.itemCount} 项内容</span>
              <span>{inspection.folderCount} 个文件夹</span>
              <span>{inspection.assetCount} 个附件</span>
              <span>{inspection.orphanAssetCount} 个未引用附件</span>
            </div>
            <small>确认后将完整替换当前数据；未引用附件也会保留。</small>
            <div>
              <button
                disabled={busy !== null}
                onClick={() => void run('cancel', cancelInspection)}
              ><X size={15} />取消导入</button>
              <button
                className="danger-action"
                disabled={busy !== null}
                onClick={() => void run('import', async () => {
                  await window.stickyApi.data.confirmImport(inspection.inspectionId)
                  setInspection(null)
                  await refreshBackups()
                  setStatus('数据已导入')
                })}
              ><Upload size={15} />确认导入</button>
            </div>
          </div>
        )}

        <div className="data-settings-row">
          <FolderOpen size={18} />
          <span><strong>数据目录</strong><small>查看本机数据、备份和附件</small></span>
          <button
            disabled={busy !== null}
            onClick={() => void run('open', async () => {
              await window.stickyApi.data.openDirectory()
              setStatus('已打开数据目录')
            })}
          ><FolderOpen size={15} />打开</button>
        </div>
      </div>

      {(status || error) && (
        <p className={error ? 'data-status error' : 'data-status'} role="status">
          {error || status}
        </p>
      )}
    </section>
  )
}

function backupKindLabel(kind: BackupSummary['kind']): string {
  if (kind === 'protected') return '手动或保护备份'
  if (kind === 'daily') return '每日备份'
  return '变更备份'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function messageFrom(reason: unknown): string {
  return reason instanceof Error ? reason.message : '操作失败，请重试'
}
