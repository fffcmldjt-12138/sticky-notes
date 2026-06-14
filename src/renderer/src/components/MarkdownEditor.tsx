import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownEditor({
  value,
  onChange,
  preview
}: {
  value: string
  onChange(value: string): void
  preview: boolean
}): React.JSX.Element {
  if (preview) {
    return (
      <div className="markdown-preview">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || '*暂无内容*'}</ReactMarkdown>
      </div>
    )
  }

  return (
    <textarea
      className="markdown-input"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="支持 Markdown，例如：&#10;## 标题&#10;- 列表项"
      autoFocus
    />
  )
}

