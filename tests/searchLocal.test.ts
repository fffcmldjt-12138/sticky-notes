import { describe, expect, it } from 'vitest'
import { emptySearchQuery, normalizeSearchText, searchLocalData } from '../src/shared/search'
import type { FolderItem, NoteItem, TodoItem } from '../src/shared/models'

const base = {
  revision: 1, headerColor: '#f2c94c' as const, bodyTheme: 'light' as const,
  pinned: false, detached: false, windowBounds: null, parentFolderId: null,
  tags: [], order: 0, deletedAt: null, createdAt: '2026-07-14T00:00:00.000Z',
  updatedAt: '2026-07-14T00:00:00.000Z'
}
const note: NoteItem = { ...base, id: 'n1', type: 'note', title: 'C# 复习', contentMarkdown: '## 默认构造函数', siyuanDelivery: null }
const todo: TodoItem = { ...base, id: 't1', type: 'todo', title: '作业', panelExpanded: false, tasks: [{
  id: 'task1', contentMarkdown: '提交交互设计', completed: false, tags: ['课程'],
  importance: 'important', urgency: 'urgent', schedule: null,
  children: [{ id: 'sub1', contentMarkdown: '检查图片', completed: false, tags: [], importance: 'normal', urgency: 'normal', schedule: null }]
}] }
const folder: FolderItem = { revision: 1, id: 'f1', title: '课程资料', parentFolderId: null, order: 0, collapsed: false, detached: false, windowBounds: null, deletedAt: null, createdAt: base.createdAt, updatedAt: base.updatedAt }

describe('local search', () => {
  it('normalizes full-width text and whitespace', () => {
    expect(normalizeSearchText('  Ｃ＃\n 复习 ')).toBe('c# 复习')
  })

  it('searches notes, tasks, subtasks and folders with AND terms', () => {
    expect(searchLocalData([note, todo], [folder], { ...emptySearchQuery, text: '默认 构造' }).map((result) => result.key)).toEqual(['note:n1'])
    expect(searchLocalData([note, todo], [folder], { ...emptySearchQuery, text: '交互' })[0].taskId).toBe('task1')
    expect(searchLocalData([note, todo], [folder], { ...emptySearchQuery, text: '图片' })[0].subtaskId).toBe('sub1')
    expect(searchLocalData([note, todo], [folder], { ...emptySearchQuery, text: '课程资料' })[0].folderId).toBe('f1')
  })

  it('applies open and important filters', () => {
    const results = searchLocalData([todo], [], { ...emptySearchQuery, completion: 'open', importantOnly: true })
    expect(results.map((result) => result.taskId)).toEqual(['task1'])
  })
})
