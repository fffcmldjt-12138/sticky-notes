import { describe, expect, it } from 'vitest'
import { extractTags, mergeTags } from '../src/shared/tags'

describe('tags', () => {
  it('extracts inline hashtags without treating Markdown headings as tags', () => {
    expect(
      extractTags('# 标题\n记录 #工作 和 #重要事项\n## 二级标题\n#WORK')
    ).toEqual(['工作', '重要事项', 'work'])
  })

  it('merges manual and content tags case-insensitively', () => {
    expect(mergeTags(['Work', '个人'], ['work', '临时'])).toEqual([
      'work',
      '个人',
      '临时'
    ])
  })
})
