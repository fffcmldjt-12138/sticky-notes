import type { NoteItem } from '../../../shared/models'

export function NoteCard({
  item,
  onOpen
}: {
  item: NoteItem
  onOpen(): void
}): React.JSX.Element {
  return (
    <button className={`note-card body-${item.bodyTheme}`} onClick={onOpen}>
      <header className={`header-${item.headerColor}`}>
        <span className="type-badge">笔记</span>
        <span className="card-title">{item.title || '无标题笔记'}</span>
      </header>
      <div className="card-body">
        <p>{item.contentMarkdown || '点击开始记录 Markdown 内容...'}</p>
        <time>{new Date(item.updatedAt).toLocaleString('zh-CN', { dateStyle: 'short', timeStyle: 'short' })}</time>
      </div>
    </button>
  )
}

