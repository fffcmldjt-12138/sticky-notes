import { useEffect, useState } from 'react'
import type { BodyTheme, HeaderColor, StickyItem } from '../../../shared/models'

export type CardAction =
  | { type: 'edit' }
  | { type: 'detach' }
  | { type: 'rename' }
  | { type: 'color'; color: HeaderColor }
  | { type: 'theme'; theme: BodyTheme }
  | { type: 'add-task' }
  | { type: 'delete' }

export function CardContextMenu({
  item,
  position,
  onAction,
  onClose
}: {
  item: StickyItem
  position: { x: number; y: number }
  onAction(action: CardAction): void
  onClose(): void
}): React.JSX.Element | null {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const close = (): void => {
      setOpen(false)
      onClose()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', close))
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  if (!open) return null

  function act(action: CardAction): void {
    onAction(action)
    setOpen(false)
    onClose()
  }

  return (
    <div
      className="card-context-menu"
      role="menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button role="menuitem" onClick={() => act({ type: 'edit' })}>编辑</button>
      <button role="menuitem" onClick={() => act({ type: 'detach' })}>
        {item.detached ? '收回主面板' : '拖出为小窗'}
      </button>
      <button role="menuitem" onClick={() => act({ type: 'rename' })}>修改标题</button>
      <label className="context-color">
        修改头部颜色
        <input
          type="color"
          value={item.headerColor}
          onChange={(event) =>
            act({ type: 'color', color: event.target.value as HeaderColor })
          }
        />
      </label>
      <button
        role="menuitem"
        onClick={() =>
          act({
            type: 'theme',
            theme: item.bodyTheme === 'light' ? 'dark' : 'light'
          })
        }
      >
        切换正文黑/白主题
      </button>
      {item.type === 'todo' && (
        <button role="menuitem" onClick={() => act({ type: 'add-task' })}>
          新增任务
        </button>
      )}
      <button className="danger-menu-item" role="menuitem" onClick={() => act({ type: 'delete' })}>
        删除
      </button>
    </div>
  )
}

