import type { FolderItem, StickyItem, TodoSchedule } from './models'

export type SearchKind = 'note' | 'todo-task' | 'todo-subtask' | 'folder'
export type SearchTime = 'all' | 'today' | 'overdue' | 'next-seven-days'

export interface SearchQuery {
  text: string
  kind: 'all' | 'note' | 'todo' | 'folder'
  completion: 'all' | 'open' | 'completed'
  time: SearchTime
  pinnedOnly: boolean
  importantOnly: boolean
}

export interface SearchResult {
  key: string
  kind: SearchKind
  itemId?: string
  taskId?: string
  subtaskId?: string
  folderId?: string
  title: string
  snippet: string
  updatedAt: string
  score: number
}

export const emptySearchQuery: SearchQuery = {
  text: '',
  kind: 'all',
  completion: 'all',
  time: 'all',
  pinnedOnly: false,
  importantOnly: false
}

export function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()
}

export function markdownToSearchText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/gu, '$1 $2')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, '$1 $2')
    .replace(/```[^]*?```/gu, ' ')
    .replace(/[`*_~>#-]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function searchLocalData(
  items: StickyItem[],
  folders: FolderItem[],
  query: SearchQuery,
  now = new Date()
): SearchResult[] {
  const terms = normalizeSearchText(query.text).split(' ').filter(Boolean)
  const results: SearchResult[] = []

  for (const folder of folders) {
    if (folder.deletedAt || (query.kind !== 'all' && query.kind !== 'folder')) continue
    if (query.pinnedOnly || query.importantOnly || query.completion !== 'all' || query.time !== 'all') continue
    const match = scoreMatch(folder.title, '', [], terms)
    if (!match) continue
    results.push({
      key: `folder:${folder.id}`,
      kind: 'folder',
      folderId: folder.id,
      title: folder.title || '无标题文件夹',
      snippet: '文件夹',
      updatedAt: folder.updatedAt,
      score: match.score
    })
  }

  for (const item of items) {
    if (item.deletedAt || (query.pinnedOnly && !item.pinned)) continue
    const tags = item.tags
    if (item.type === 'note') {
      if (query.kind !== 'all' && query.kind !== 'note') continue
      if (query.completion !== 'all' || query.time !== 'all' || query.importantOnly) continue
      const body = markdownToSearchText(item.contentMarkdown)
      const match = scoreMatch(item.title, body, tags, terms)
      if (!match) continue
      results.push({
        key: `note:${item.id}`,
        kind: 'note',
        itemId: item.id,
        title: item.title || '无标题笔记',
        snippet: makeSnippet(match.fieldText, terms),
        updatedAt: item.updatedAt,
        score: match.score + (item.pinned ? 100 : 0)
      })
      continue
    }

    if (query.kind !== 'all' && query.kind !== 'todo') continue
    for (const task of item.tasks) {
      if (!matchesCompletion(task.completed, query.completion)) continue
      if (!matchesTime(task.schedule, task.deadlineAt ?? task.remindAt, query.time, now)) continue
      if (query.importantOnly && task.importance !== 'important') continue
      const body = markdownToSearchText(task.contentMarkdown)
      const match = scoreMatch(item.title, body, [...tags, ...task.tags], terms)
      if (match) {
        results.push({
          key: `task:${item.id}:${task.id}`,
          kind: 'todo-task',
          itemId: item.id,
          taskId: task.id,
          title: body || item.title || '未命名待办',
          snippet: item.title || '待办',
          updatedAt: item.updatedAt,
          score: match.score + (item.pinned ? 100 : 0) + priorityScore(task.importance, task.urgency)
        })
      }
      for (const child of task.children) {
        if (!matchesCompletion(child.completed, query.completion)) continue
        if (!matchesTime(child.schedule, null, query.time, now)) continue
        if (query.importantOnly && child.importance !== 'important') continue
        const childBody = markdownToSearchText(child.contentMarkdown)
        const childMatch = scoreMatch(item.title, childBody, [...tags, ...task.tags, ...child.tags], terms)
        if (!childMatch) continue
        results.push({
          key: `subtask:${item.id}:${task.id}:${child.id}`,
          kind: 'todo-subtask',
          itemId: item.id,
          taskId: task.id,
          subtaskId: child.id,
          title: childBody || '未命名子待办',
          snippet: body || item.title || '子待办',
          updatedAt: item.updatedAt,
          score: childMatch.score + (item.pinned ? 100 : 0) + priorityScore(child.importance, child.urgency)
        })
      }
    }
  }

  return results.sort((left, right) =>
    right.score - left.score ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.key.localeCompare(right.key)
  ).slice(0, 200)
}

function scoreMatch(title: string, body: string, tags: string[], terms: string[]) {
  const normalizedTitle = normalizeSearchText(title)
  const normalizedBody = normalizeSearchText(body)
  const normalizedTags = normalizeSearchText(tags.join(' '))
  if (!terms.every((term) => normalizedTitle.includes(term) || normalizedTags.includes(term) || normalizedBody.includes(term))) {
    return null
  }
  if (terms.some((term) => normalizedTitle.includes(term))) return { score: 30, fieldText: title }
  if (terms.some((term) => normalizedTags.includes(term))) return { score: 20, fieldText: tags.join(' ') }
  return { score: 10, fieldText: body }
}

function makeSnippet(value: string, terms: string[]): string {
  const text = value.trim()
  if (!text) return '无内容'
  const normalized = normalizeSearchText(text)
  const index = terms.length ? normalized.indexOf(terms[0]) : 0
  const start = Math.max(0, index - 24)
  const snippet = text.slice(start, start + 72)
  return `${start ? '…' : ''}${snippet}${start + 72 < text.length ? '…' : ''}`
}

function matchesCompletion(completed: boolean, filter: SearchQuery['completion']): boolean {
  return filter === 'all' || (filter === 'completed' ? completed : !completed)
}

function matchesTime(
  schedule: TodoSchedule | null,
  fallback: string | null | undefined,
  filter: SearchTime,
  now: Date
): boolean {
  if (filter === 'all') return true
  const raw = schedule?.endAt ?? schedule?.startAt ?? fallback
  if (!raw) return false
  const value = new Date(raw)
  if (Number.isNaN(value.getTime())) return false
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(start)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (filter === 'today') return value >= start && value < tomorrow
  if (filter === 'overdue') return value < now
  const nextWeek = new Date(start)
  nextWeek.setDate(nextWeek.getDate() + 8)
  return value >= start && value < nextWeek
}

function priorityScore(importance: string, urgency: string): number {
  return (importance === 'important' ? 6 : 0) + (urgency === 'urgent' ? 3 : 0)
}
