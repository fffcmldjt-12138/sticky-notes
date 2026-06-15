import { useEffect } from 'react'

export function FolderContextMenu({
  position,
  onRename,
  onDelete,
  onClose
}: {
  position: { x: number; y: number }
  onRename(): void
  onDelete(): void
  onClose(): void
}): React.JSX.Element {
  useEffect(() => {
    const close = (): void => onClose()
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    const timer = window.setTimeout(() =>
      document.addEventListener('pointerdown', close)
    )
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="card-context-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button role="menuitem" onClick={onRename}>重命名</button>
      <button className="danger-menu-item" role="menuitem" onClick={onDelete}>
        删除文件夹
      </button>
    </div>
  )
}
