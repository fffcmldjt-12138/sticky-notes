import type {
  MutationResult,
  NoteItem,
  StickyItem,
  StickyItemPatch
} from '../../../shared/models'
import { extractTags } from '../../../shared/tags'
import { useEntitySaveCoordinator, type SaveState } from '../hooks/useEntitySaveCoordinator'
import { usePersistedField } from '../hooks/usePersistedField'
import { BodyThemeToggle } from './BodyThemeToggle'
import { HeaderColorPicker } from './HeaderColorPicker'
import { MarkdownEditor } from './MarkdownEditor'
import { SaveStatus } from './SaveStatus'
import { TagEditor } from './TagEditor'

interface Props {
  item: NoteItem
  onSave(
    expectedRevision: number,
    patch: StickyItemPatch
  ): Promise<MutationResult<StickyItem>>
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
  const coordinator = useEntitySaveCoordinator({
    remoteEntity: item,
    save: onSave
  })
  const title = usePersistedField({
    remoteValue: item.title,
    makePatch: (value: string): StickyItemPatch => ({ title: value }),
    coordinator
  })
  const content = usePersistedField({
    remoteValue: item.contentMarkdown,
    makePatch: (value: string): StickyItemPatch => ({ contentMarkdown: value }),
    coordinator
  })
  const headerColor = usePersistedField({
    remoteValue: item.headerColor,
    makePatch: (value: NoteItem['headerColor']): StickyItemPatch => ({
      headerColor: value
    }),
    coordinator
  })
  const bodyTheme = usePersistedField({
    remoteValue: item.bodyTheme,
    makePatch: (value: NoteItem['bodyTheme']): StickyItemPatch => ({
      bodyTheme: value
    }),
    coordinator
  })
  const tags = usePersistedField({
    remoteValue: JSON.stringify(item.tags),
    makePatch: (value: string): StickyItemPatch => ({
      tags: JSON.parse(value) as string[]
    }),
    coordinator
  })
  const fields = [title, content, headerColor, bodyTheme, tags]
  const saveState = combinedSaveState(
    coordinator.state,
    fields.map((field) => field.state)
  )

  function saveAndBack(): void {
    void Promise.all(fields.map((field) => field.flush()))
    onBack()
  }

  function discardLocal(): void {
    fields.forEach((field) => field.discardLocal())
  }

  return (
    <section className={`editor body-${bodyTheme.draft} ${detached ? 'detached-editor' : ''}`}>
      <div
        className={`editor-header ${detached ? 'detached-header' : ''}`}
        style={{ backgroundColor: headerColor.draft }}
      >
        {detached
          ? <span className="editor-header-spacer" />
          : <button className="icon-button" onClick={saveAndBack} aria-label="返回">‹</button>}
        <span className="editor-header-title">{title.draft || '无标题'}</span>
        {detached
          ? <button className="icon-button" onClick={saveAndBack} aria-label="关闭">×</button>
          : <button className="icon-button danger" onClick={onDelete} aria-label="删除">×</button>}
      </div>
      {!detached && (
        <>
          <div className="editor-toolbar editor-identity-toolbar">
            <HeaderColorPicker
              compact
              value={headerColor.draft}
              onChange={headerColor.change}
            />
            <input
              className="editor-title-input"
              aria-label="标题"
              value={title.draft}
              onChange={(event) => title.change(event.target.value)}
              onCompositionStart={title.onCompositionStart}
              onCompositionEnd={() => void title.onCompositionEnd()}
            />
            <BodyThemeToggle value={bodyTheme.draft} onChange={bodyTheme.change} />
          </div>
          <TagEditor
            value={JSON.parse(tags.draft) as string[]}
            contentTags={extractTags(content.draft)}
            onChange={(value) => tags.change(JSON.stringify(value))}
          />
        </>
      )}
      <MarkdownEditor
        value={content.draft}
        onChange={content.change}
        onCompositionStart={content.onCompositionStart}
        onCompositionEnd={() => void content.onCompositionEnd()}
        compact={detached}
      />
      {!detached && (
        <SaveStatus
          state={saveState}
          onRetry={() => void coordinator.retry()}
          onCopy={() => {
            void navigator.clipboard?.writeText(
              `${title.draft}\n\n${content.draft}`.trim()
            )
          }}
          onLoadLatest={discardLocal}
        />
      )}
    </section>
  )
}

function combinedSaveState(
  coordinatorState: SaveState,
  fieldStates: SaveState[]
): SaveState {
  for (const state of ['conflict', 'failed', 'saving', 'saved'] as const) {
    if (coordinatorState === state || fieldStates.includes(state)) return state
  }
  return 'idle'
}
