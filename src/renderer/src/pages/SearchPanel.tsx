import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FolderItem, StickyItem } from '../../../shared/models'
import {
  emptySearchQuery,
  searchLocalData,
  type SearchQuery,
  type SearchResult,
  type SearchTime
} from '../../../shared/search'

export function SearchPanel({
  items,
  folders,
  onClose,
  onOpenResult
}: {
  items: StickyItem[]
  folders: FolderItem[]
  onClose(): void
  onOpenResult(result: SearchResult): void
}): React.JSX.Element {
  const [query, setQuery] = useState<SearchQuery>(emptySearchQuery)
  const results = useMemo(
    () => searchLocalData(items, folders, query),
    [folders, items, query]
  )

  const set = <K extends keyof SearchQuery>(key: K, value: SearchQuery[K]) =>
    setQuery((current) => ({ ...current, [key]: value }))

  return (
    <section className="search-panel" aria-label="搜索便签">
      <header className="search-header">
        <label className="search-input-wrap">
          <Search size={17} aria-hidden="true" />
          <input
            autoFocus
            value={query.text}
            onChange={(event) => set('text', event.target.value)}
            placeholder="搜索标题、正文、标签和待办"
            aria-label="搜索内容"
          />
          {query.text && (
            <button type="button" className="icon-button compact" onClick={() => set('text', '')} aria-label="清空搜索">
              <X size={15} />
            </button>
          )}
        </label>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭搜索" title="关闭搜索">
          <X size={18} />
        </button>
      </header>

      <div className="search-filter-row" aria-label="搜索筛选">
        <FilterSelect label="类型" value={query.kind} onChange={(value) => set('kind', value as SearchQuery['kind'])} options={[
          ['all', '全部'], ['note', '笔记'], ['todo', '待办'], ['folder', '文件夹']
        ]} />
        <FilterSelect label="状态" value={query.completion} onChange={(value) => set('completion', value as SearchQuery['completion'])} options={[
          ['all', '全部状态'], ['open', '未完成'], ['completed', '已完成']
        ]} />
        <FilterSelect label="时间" value={query.time} onChange={(value) => set('time', value as SearchTime)} options={[
          ['all', '全部时间'], ['today', '今天'], ['overdue', '已逾期'], ['next-seven-days', '未来 7 天']
        ]} />
        <button type="button" className={query.importantOnly ? 'filter-chip active' : 'filter-chip'} onClick={() => set('importantOnly', !query.importantOnly)}>重要</button>
        <button type="button" className={query.pinnedOnly ? 'filter-chip active' : 'filter-chip'} onClick={() => set('pinnedOnly', !query.pinnedOnly)}>置顶</button>
      </div>

      <div className="search-result-summary">{results.length} 条结果</div>
      <div className="search-results">
        {results.map((result) => (
          <button key={result.key} type="button" className="search-result" onClick={() => onOpenResult(result)}>
            <span className="search-result-kind">{kindLabel(result.kind)}</span>
            <strong>{result.title}</strong>
            <span>{result.snippet}</span>
          </button>
        ))}
        {!results.length && (
          <div className="search-empty">没有找到匹配内容</div>
        )}
      </div>
    </section>
  )
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange(value: string): void
}) {
  return <label className="search-select"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>
}

function kindLabel(kind: SearchResult['kind']): string {
  if (kind === 'note') return '笔记'
  if (kind === 'folder') return '文件夹'
  return kind === 'todo-task' ? '待办' : '子待办'
}
