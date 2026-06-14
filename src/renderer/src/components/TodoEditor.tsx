import { useEffect, useRef, useState } from 'react'
import type { StickyItemPatch, TodoItem } from '../../../shared/models'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'
import { MarkdownEditor } from './MarkdownEditor'

interface Props {
  item: TodoItem
  onSave(patch: StickyItemPatch): void
  onBack(): void
  onDelete(): void
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TodoEditor({ item, onSave, onBack, onDelete }: Props): React.JSX.Element {
  const [draft, setDraft] = useState(item)
  const [preview, setPreview] = useState(false)
  const onSaveRef = useRef(onSave)

  useEffect(() => setDraft(item), [item])
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onSaveRef.current({
        title: draft.title,
        contentMarkdown: draft.contentMarkdown,
        headerColor: draft.headerColor,
        bodyTheme: draft.bodyTheme,
        completed: draft.completed,
        remindAt: draft.remindAt
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  function saveAndBack(): void {
    onSaveRef.current({
      title: draft.title,
      contentMarkdown: draft.contentMarkdown,
      headerColor: draft.headerColor,
      bodyTheme: draft.bodyTheme,
      completed: draft.completed,
      remindAt: draft.remindAt
    })
    onBack()
  }

  return (
    <section className={`editor body-${draft.bodyTheme}`}>
      <div className={`editor-header header-${draft.headerColor}`}>
        <button className="icon-button" onClick={saveAndBack} aria-label="返回">‹</button>
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        <button className="icon-button danger" onClick={onDelete} aria-label="删除">×</button>
      </div>
      <div className="todo-controls">
        <label><input type="checkbox" checked={draft.completed} onChange={(event) => setDraft({ ...draft, completed: event.target.checked })} /> 已完成</label>
        <label className="reminder-field">提醒时间<input type="datetime-local" value={toLocalInput(draft.remindAt)} onChange={(event) => setDraft({ ...draft, remindAt: event.target.value ? new Date(event.target.value).toISOString() : null, reminded: false })} /></label>
      </div>
      <div className="editor-toolbar">
        <HeaderColorPicker value={draft.headerColor} onChange={(headerColor) => setDraft({ ...draft, headerColor })} />
        <BodyThemeToggle value={draft.bodyTheme} onChange={(bodyTheme) => setDraft({ ...draft, bodyTheme })} />
      </div>
      <div className="segmented preview-toggle">
        <button className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>编辑</button>
        <button className={preview ? 'active' : ''} onClick={() => setPreview(true)}>预览</button>
      </div>
      <MarkdownEditor value={draft.contentMarkdown} onChange={(contentMarkdown) => setDraft({ ...draft, contentMarkdown })} preview={preview} />
      <span className="save-status">自动保存</span>
    </section>
  )
}
