import { useState } from 'react'
import type { NoteType } from '../../../shared/models'

export function TitleDialog({
  type,
  initialTitle = '',
  onConfirm,
  onCancel
}: {
  type: NoteType
  initialTitle?: string
  onConfirm(title: string): void
  onCancel(): void
}): React.JSX.Element {
  const [title, setTitle] = useState(initialTitle)
  const trimmed = title.trim()

  return (
    <div className="dialog-backdrop">
      <form
        className="title-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="title-dialog-heading"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed) onConfirm(trimmed)
        }}
      >
        <h2 id="title-dialog-heading">
          {initialTitle ? '修改标题' : `新建${type === 'note' ? '笔记' : '待办'}标题`}
        </h2>
        <label>
          标题
          <input
            aria-label="标题"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            maxLength={80}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>取消</button>
          <button className="primary-button" type="submit" disabled={!trimmed}>
            确认
          </button>
        </div>
      </form>
    </div>
  )
}
