import { useEffect, useRef, useState } from 'react'
import type { NoteItem, StickyItemPatch } from '../../../shared/models'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'
import { MarkdownEditor } from './MarkdownEditor'

interface Props {
  item: NoteItem
  onSave(patch: StickyItemPatch): void
  onBack(): void
  onDelete(): void
  detached?: boolean
}

export function NoteEditor({
  item,
  onSave,
  onBack,
  onDelete,
  detached = false
}: Props): React.JSX.Element {
  const [draft, setDraft] = useState(item)
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
        bodyTheme: draft.bodyTheme
      })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  function saveAndBack(): void {
    onSaveRef.current({
      title: draft.title,
      contentMarkdown: draft.contentMarkdown,
      headerColor: draft.headerColor,
      bodyTheme: draft.bodyTheme
    })
    onBack()
  }

  return (
    <section className={`editor body-${draft.bodyTheme}`}>
      <div
        className={`editor-header ${detached ? 'detached-header' : ''}`}
        style={{ backgroundColor: draft.headerColor }}
      >
        {detached
          ? <span className="editor-header-spacer" />
          : <button className="icon-button" onClick={saveAndBack} aria-label="返回">‹</button>}
        <input
          aria-label="标题"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        {detached
          ? <button className="icon-button" onClick={saveAndBack} aria-label="关闭">×</button>
          : <button className="icon-button danger" onClick={onDelete} aria-label="删除">×</button>}
      </div>
      <div className="editor-toolbar">
        <HeaderColorPicker value={draft.headerColor} onChange={(headerColor) => setDraft({ ...draft, headerColor })} />
        <BodyThemeToggle value={draft.bodyTheme} onChange={(bodyTheme) => setDraft({ ...draft, bodyTheme })} />
      </div>
      <MarkdownEditor
        value={draft.contentMarkdown}
        onChange={(contentMarkdown) => setDraft({ ...draft, contentMarkdown })}
      />
      <span className="save-status">自动保存</span>
    </section>
  )
}
