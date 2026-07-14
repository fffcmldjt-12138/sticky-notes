import type { SaveState } from '../hooks/useEntitySaveCoordinator'

interface SaveStatusProps {
  state: SaveState
  onRetry?(): void
  onCopy?(): void
  onLoadLatest?(): void
}

export function SaveStatus({
  state,
  onRetry,
  onCopy,
  onLoadLatest
}: SaveStatusProps): React.JSX.Element | null {
  if (state === 'idle') return null
  if (state === 'saving') return <span className="save-status">保存中...</span>
  if (state === 'saved') return <span className="save-status">已保存</span>

  return (
    <div className="save-status save-status-recovery" role="status">
      <span>{state === 'conflict' ? '发现较新的内容' : '保存失败'}</span>
      <button type="button" onClick={onRetry}>重试</button>
      <button type="button" onClick={onCopy}>复制</button>
      <button type="button" onClick={onLoadLatest}>载入最新</button>
    </div>
  )
}
