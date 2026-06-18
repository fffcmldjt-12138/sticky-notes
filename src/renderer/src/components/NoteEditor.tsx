import { useEffect, useRef, useState } from 'react'
import type { NoteItem, StickyItemPatch } from '../../../shared/models'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'
import { MarkdownEditor } from './MarkdownEditor'
import { TagEditor } from './TagEditor'
import { extractTags } from '../../../shared/tags'

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
  const lastSubmittedRef = useRef<StickyItemPatch | null>(null)

  useEffect(() => {
    const submitted = lastSubmittedRef.current
    if (
      submitted &&
      submitted.title === item.title &&
      submitted.contentMarkdown === item.contentMarkdown &&
      submitted.headerColor === item.headerColor &&
      submitted.bodyTheme === item.bodyTheme
      && JSON.stringify(submitted.tags) === JSON.stringify(item.tags)
    ) {
      return
    }
    if (document.activeElement?.closest('.editor')) return
    setDraft(item)
  }, [item])
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const patch = {
        title: draft.title,
        contentMarkdown: draft.contentMarkdown,
        headerColor: draft.headerColor,
        bodyTheme: draft.bodyTheme
        , tags: draft.tags
      } satisfies StickyItemPatch
      lastSubmittedRef.current = patch
      onSaveRef.current(patch)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draft])

  function saveAndBack(): void {
    const patch = {
      title: draft.title,
      contentMarkdown: draft.contentMarkdown,
      headerColor: draft.headerColor,
      bodyTheme: draft.bodyTheme
      , tags: draft.tags
    } satisfies StickyItemPatch
    lastSubmittedRef.current = patch
    onSaveRef.current(patch)
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
        <span className="editor-header-title">{draft.title || '无标题'}</span>
        {detached
          ? <button className="icon-button" onClick={saveAndBack} aria-label="关闭">×</button>
          : <button className="icon-button danger" onClick={onDelete} aria-label="删除">×</button>}
      </div>
      <div className="editor-toolbar editor-identity-toolbar">
        <HeaderColorPicker
          compact
          value={draft.headerColor}
          onChange={(headerColor) => setDraft({ ...draft, headerColor })}
        />
        <input
          className="editor-title-input"
          aria-label="标题"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <BodyThemeToggle value={draft.bodyTheme} onChange={(bodyTheme) => setDraft({ ...draft, bodyTheme })} />
      </div>
      <TagEditor
        value={draft.tags}
        contentTags={extractTags(draft.contentMarkdown)}
        onChange={(tags) => setDraft({ ...draft, tags })}
      />
      <MarkdownEditor
        value={draft.contentMarkdown}
        onChange={(contentMarkdown) => setDraft({ ...draft, contentMarkdown })}
      />
      <span className="save-status">自动保存</span>
    </section>
  )
}
