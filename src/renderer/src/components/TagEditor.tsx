import { useState } from 'react'
import { mergeTags, normalizeTag } from '../../../shared/tags'

export function TagEditor({
  value,
  contentTags,
  onChange
}: {
  value: string[]
  contentTags: string[]
  onChange(tags: string[]): void
}): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const manualTags = value ?? []
  const allTags = mergeTags(manualTags, contentTags)

  function addDraft(): void {
    const tag = normalizeTag(draft)
    if (tag) onChange(mergeTags(manualTags, [tag]))
    setDraft('')
  }

  return (
    <div className="tag-editor">
      <div className="tag-chip-list">
        {allTags.map((tag) => {
          const manual = manualTags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              className={`tag-chip ${manual ? 'manual' : 'content'}`}
              title={manual ? '点击移除手动标签' : '内容中识别的标签'}
              onClick={() => {
                if (manual) {
                  onChange(manualTags.filter((candidate) => candidate !== tag))
                }
              }}
            >
              #{tag}{manual ? ' ×' : ''}
            </button>
          )
        })}
      </div>
      <input
        aria-label="添加标签"
        value={draft}
        placeholder="添加标签"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            addDraft()
          }
        }}
        onBlur={addDraft}
      />
    </div>
  )
}
