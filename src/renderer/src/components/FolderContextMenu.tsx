import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { NoteType } from '../../../shared/models'
import { clampFloatingPosition } from '../lib/floatingPosition'

export function FolderContextMenu({
  position,
  canCreateFolder,
  onCreate,
  onRename,
  onDelete,
  onClose
}: {
  position: { x: number; y: number }
  canCreateFolder: boolean
  onCreate(type: NoteType | 'folder'): void
  onRename(): void
  onDelete(): void
  onClose(): void
}): React.JSX.Element {
  const [menuPosition, setMenuPosition] = useState(position)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bounds = menuRef.current?.getBoundingClientRect()
    if (!bounds) return
    setMenuPosition(clampFloatingPosition(
      position,
      { width: bounds.width, height: bounds.height },
      { width: window.innerWidth, height: window.innerHeight }
    ))
  }, [position])

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
      ref={menuRef}
      className="card-context-menu"
      role="menu"
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button role="menuitem" onClick={onRename}>重命名</button>
      <button role="menuitem" onClick={() => onCreate('note')}>新建笔记</button>
      <button role="menuitem" onClick={() => onCreate('todo')}>新建待办</button>
      {canCreateFolder && (
        <button role="menuitem" onClick={() => onCreate('folder')}>
          新建子文件夹
        </button>
      )}
      <button className="danger-menu-item" role="menuitem" onClick={onDelete}>
        删除文件夹
      </button>
    </div>
  )
}
