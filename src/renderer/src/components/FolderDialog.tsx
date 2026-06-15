import { useRef, useState } from 'react'

export function FolderDialog({
  initialTitle = '',
  onConfirm,
  onCancel
}: {
  initialTitle?: string
  onConfirm(title: string): Promise<void>
  onCancel(): void
}): React.JSX.Element {
  const [title, setTitle] = useState(initialTitle)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const trimmed = title.trim()

  return (
    <div className="dialog-backdrop">
      <form
        className="title-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-dialog-heading"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!trimmed || submittingRef.current) return
          submittingRef.current = true
          setSubmitting(true)
          try {
            await onConfirm(trimmed)
          } catch {
            submittingRef.current = false
            setSubmitting(false)
          }
        }}
      >
        <h2 id="folder-dialog-heading">
          {initialTitle ? '重命名文件夹' : '新建文件夹'}
        </h2>
        <label>
          文件夹名称
          <input
            aria-label="文件夹名称"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            maxLength={80}
          />
        </label>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>
            取消
          </button>
          <button
            className="primary-button"
            type="submit"
            disabled={!trimmed || submitting}
          >
            {submitting ? '保存中…' : '确认'}
          </button>
        </div>
      </form>
    </div>
  )
}
